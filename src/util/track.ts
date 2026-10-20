import { Client, EmbedBuilder, time, TimestampStyles } from "discord.js"
import API from "./api"
import { getImageColor } from "./color"
import { BadgeData, GameData, getStored, StoredNotification } from "./store"
import {
	batchEmbedReply,
	createBadgeEmbed,
	createBadgeUpdateEmbed,
	createGameUpdateEmbed,
	createSuccessEmbed,
} from "./embeds"
import logger, { getLogChannel } from "./log"
import { sleep } from "./sleep"
import Config from "./config"

const GAME_TRACKING_PROPERTIES: (keyof GameData)[] = [
	"name",
	"description",
	"copyingAllowed",
	"maxPlayers",
	"created",
	"updated",
	"studioAccessToApisAllowed",
	"createVipServersAllowed",
	"universeAvatarType",
	"genre",
	"genre_l1",
	"imageUrl",
]

const BADGE_TRACKING_PROPERTIES: (keyof BadgeData)[] = [
	"name",
	"description",
	"enabled",
	"iconImageId",
	"created",
	"updated",
	"imageUrl",
]

async function checkNewGameBadges(client: Client, id: number) {
	const stored = await getStored()
	const trackingGame = stored.trackingGames[id]

	const badges = await API.getBadges(id)
	const existingBadges = trackingGame.existingBadges
	const toTrack = badges.filter((badge) => !existingBadges.includes(badge.id))

	if (toTrack.length > 0) {
		const badgeIcons = await API.getBadgeIcons(
			toTrack.map((badge) => badge.id)
		)
		for (const badge of toTrack) {
			const imageUrl = badgeIcons[badge.id]
			const color = await getImageColor(imageUrl)

			// If we tracking the root game, should abort here
			if (!stored.trackingGames[id]) {
				return
			}

			stored.trackingBadges[badge.id] = {
				...badge,
				imageUrl,
				color,
				awardHistory: [[Date.now(), badge.statistics.awardedCount]],
			}
		}

		const totalBadgesTracked = Object.values(stored.trackingBadges).filter(
			(trackingBadge) => trackingBadge.awardingUniverse.id == id
		).length
		logger.logGame(`Found ${toTrack.length} new badges for ${id}`)
		const embeds = [
			createSuccessEmbed(
				`New Badges For ${trackingGame.name}`,
				`Now tracking ${totalBadgesTracked} (+${toTrack.length})\n`
			),
			...toTrack.map((badge) =>
				createBadgeEmbed(stored.trackingBadges[badge.id])
			),
		]
		const notifications: StoredNotification[] = ["newBadge"]

		const channel = await getLogChannel(client)
		if (channel) {
			// Send in background
			batchEmbedReply(
				(message) => channel.send(message),
				embeds,
				notifications
			).catch(logger.error)
			logger.logGame(`Logged new badges for ${id}`)
		}
	} else {
		logger.logGame(`No updates for ${id}`)
	}

	// Ensure still tracking, then update existing badges for next iteration
	if (stored.trackingGames[id]) {
		// We use a set to combine existing with retrieved badges - since when a badge is disabled it will cease to appear on game page
		// However, that does not mean we stopped tracking it as we can still fetch it individually
		// If we just used badges directly, a disable and re-enabled badge logs as a new badge vs update
		const newExistingBadges = new Set([
			...existingBadges,
			...badges.map((badge) => badge.id),
		])
		stored.trackingGames[id].existingBadges = [...newExistingBadges]
	}
}

// Gets all updates for a given old and current object for which updated is provided
// This works for Universe and Badge currently to avoid duplicating time logic
function getUpdates<T extends { updated: string }>(
	old: T,
	current: T,
	tracking: (keyof T & string)[]
) {
	const updates: [string, unknown, unknown][] = []
	const oldUpdated = new Date(old.updated)
	const currUpdated = new Date(current.updated)

	for (const prop of tracking) {
		const oldProp = old[prop]
		const currentProp = current[prop]
		if (currentProp != oldProp) {
			if (prop === "updated") {
				updates.push([
					prop,
					time(oldUpdated, TimestampStyles.LongDateShortTime),
					time(currUpdated, TimestampStyles.LongDateShortTime),
				])
			} else {
				updates.push([prop, oldProp, currentProp])
			}
		}
	}

	// Ignore stale data
	const timeSinceLastUpdate =
		oldUpdated &&
		currUpdated &&
		currUpdated.getTime() - oldUpdated.getTime()
	if (updates.length > 0 && timeSinceLastUpdate >= 0) {
		return {
			updates,
			currUpdated,
		}
	}
}

export async function trackGames(client: Client) {
	const stored = await getStored()
	const queue = Object.values(stored.trackingGames).map(
		(trackingGame) => trackingGame.id
	)

	if (queue.length === 0) {
		return
	}

	logger.logGame("Refetching game details...")
	const universes = await API.getUniverseDetails(
		Object.values(stored.trackingGames).map((game) => game.id)
	)
	const icons = await API.getUniverseIcons(
		universes.map((universe) => universe.id)
	)

	const embeds: EmbedBuilder[] = []
	const notifications: StoredNotification[] = []
	for (const universe of universes) {
		// Ensure still tracking game before updating
		if (!stored.trackingGames[universe.id]) {
			continue
		}
		const imageUrl = icons[universe.id]
		const previous = stored.trackingGames[universe.id]
		const merged = { ...previous, ...universe, imageUrl }
		const result = getUpdates(previous, merged, GAME_TRACKING_PROPERTIES)
		stored.trackingGames[universe.id] = {
			...stored.trackingGames[universe.id],
			lastChecked: Date.now(),
		}
		// Only if an update
		if (result) {
			const { updates, currUpdated } = result
			let color = previous.color
			// Update color (if image changed)
			if (imageUrl !== previous.imageUrl) {
				color = await getImageColor(imageUrl)
			}
			// Ensure still tracking game before updating
			if (!stored.trackingGames[universe.id]) {
				continue
			}

			stored.trackingGames[universe.id] = {
				...stored.trackingGames[universe.id],
				...universe,
				imageUrl,
				color,
			}

			// Log & embed
			if (!notifications.includes("update")) {
				notifications.push("update")
			}
			logger.logGame(`Updated ${universe.id}`)
			embeds.push(
				createGameUpdateEmbed(
					stored.trackingGames[universe.id],
					updates,
					currUpdated
				)
			)
		}
	}

	if (embeds.length > 0) {
		const channel = await getLogChannel(client)
		if (channel) {
			// Send in background
			batchEmbedReply(
				(message) => channel.send(message),
				embeds,
				notifications
			).catch(logger.error)
			logger.logGame("Logged updates for games")
		}
	} else {
		logger.logGame("No updates for games")
	}

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.trackingGames[id]) {
			const start = Date.now()
			logger.logGame(
				`Fetching badges for ${id} (${queue.length} left in queue)`
			)
			await checkNewGameBadges(client, id)
			await sleep(
				Config.GAME_CHECK_NEW_BADGES_INTERVAL_MS - (Date.now() - start)
			)
		}
	}
}

async function fetchBadge(client: Client, id: number, imageUrl: string) {
	const badge = await API.getBadge(id)

	const stored = await getStored()
	const previous = stored.trackingBadges[id]
	// Should always be true if still tracking badge
	if (!previous) {
		return
	}

	const embeds: EmbedBuilder[] = []
	const notifications: StoredNotification[] = []
	const merged = { ...previous, ...badge, imageUrl }
	const result = getUpdates(previous, merged, BADGE_TRACKING_PROPERTIES)
	// Only if a meaningful update
	if (result) {
		const { updates, currUpdated } = result
		let color = previous.color
		// Update image color (if image changed)
		if (imageUrl !== previous.imageUrl) {
			color = await getImageColor(imageUrl)
		}

		// Ensure we are still tracking
		if (!stored.trackingBadges[id]) {
			return
		}

		stored.trackingBadges[id] = {
			...stored.trackingBadges[id],
			...badge,
			imageUrl,
			color,
		}

		// Log & embed
		notifications.push("update")
		logger.logBadge(`Updated ${id}`)
		embeds.push(
			createBadgeUpdateEmbed(
				stored.trackingBadges[id],
				updates,
				currUpdated
			)
		)
	}

	if (badge.statistics.awardedCount > previous.statistics.awardedCount) {
		stored.trackingBadges[id] = {
			...stored.trackingBadges[id],
			statistics: badge.statistics,
			awardHistory: [
				...stored.trackingBadges[id].awardHistory,
				[Date.now(), badge.statistics.awardedCount],
			],
		}
		const firstAward = stored.trackingBadges[id].awardHistory.length <= 2
		if (firstAward) {
			notifications.push("firstAward")
		}
		logger.logBadge(
			`Updated award count for ${id} - ${previous.statistics.awardedCount} -> ${badge.statistics.awardedCount}`
		)
		embeds.push(createBadgeEmbed(previous, badge, firstAward))
	}

	if (embeds.length > 0) {
		const channel = await getLogChannel(client)
		if (channel) {
			// Send in background
			batchEmbedReply(
				(message) => channel.send(message),
				embeds,
				notifications
			).catch(logger.error)
			logger.logBadge(`Logged ${id}`)
		}
	} else {
		logger.logBadge(`No updates for ${id}`)
	}
}

export async function trackBadges(client: Client) {
	const stored = await getStored()
	const queue = Object.values(stored.trackingBadges).map((badge) => badge.id)
	const badgeIcons = await API.getBadgeIcons(queue)

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.trackingBadges[id]) {
			const start = Date.now()
			logger.logBadge(`Fetching ${id} (${queue.length} left in queue)`)
			await fetchBadge(client, id, badgeIcons[id])
			await sleep(Config.BADGE_FETCH_INTERVAL_MS - (Date.now() - start))
		}
	}
}
