import { Client } from "discord.js"
import API from "./api"
import { getImageColor } from "./color"
import { BadgeData, GameData, getStored } from "./store"
import {
	createBadgeEmbed,
	createBadgeUpdateEmbed,
	createGameUpdateEmbed,
	getNotificationContent,
} from "./embeds"
import logger, { getLogChannel } from "./log"
import { sleep } from "./sleep"
import Config from "./config"

export const GAME_TRACKING_PROPERTIES = [
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
] as const satisfies (keyof GameData)[]

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
	const stored = getStored()
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

		logger.logGame(`Found ${toTrack.length} new badges for ${id}`)

		const channel = await getLogChannel(client)
		if (channel) {
			// Send in background
			Promise.all(
				toTrack.map(async (badge) =>
					channel.send({
						content: getNotificationContent(["newBadge"]),
						embeds: [
							createBadgeEmbed(
								stored.trackingBadges[badge.id],
								undefined,
								true
							),
						],
					})
				)
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

// Gets all updates for a given current and next object for which updated is provided
// Handles case where update does not change in updated time but property is added
// `newPrevious` is set when a previous update is confirmed and should be stored (to prevent flicker)
// This works for Universe and Badge currently to avoid duplicating time logic
function getUpdates<T extends { updated: string; previous?: Partial<T> }>(
	current: T,
	next: T,
	tracking: (keyof T & string)[]
) {
	const updates: [keyof T & string, unknown, unknown][] = []
	const currentUpdated = new Date(current.updated)
	const nextUpdated = new Date(next.updated)

	for (const prop of tracking) {
		const currentProp = current[prop]
		const nextProp = next[prop]
		if (nextProp !== currentProp) {
			if (prop === "updated") {
				updates.push([prop, currentUpdated, nextUpdated])
			} else {
				updates.push([prop, currentProp, nextProp])
			}
		}
	}

	// Ignore stale data
	const timeSinceLastUpdate =
		currentUpdated &&
		nextUpdated &&
		nextUpdated.getTime() - currentUpdated.getTime()
	if (updates.length === 0 || timeSinceLastUpdate < 0) {
		return {
			updates: [],
		}
	}

	// If a new update timestamp, accept updates
	if (timeSinceLastUpdate > 0) {
		// newPrevious is tracked properties of current version, before overridden by updated
		const newPrevious: Partial<T> = {}
		for (const prop of tracking) {
			newPrevious[prop] = current[prop]
		}
		return { updates, newPrevious }
	}

	// timeSinceLastUpdate === 0 here
	// API updates flicker between old and new version as update propagates
	// For example, if name is updated from A -> B, the API might return A or B for a short while
	// We need to prevent this - as it would create a bunch of fake update notifications
	// Additionally, we cannot just accept the first update, as sometimes the update happens partially
	// For example, updated goes from 0 -> 1, several requests later name finally goes from A -> B
	// This is still a valid update - as we don't want to miss things
	// Therefore, if the update timestamp is IDENTICAL (0 diff), check against previous update (previous updated timestamp)
	// We do this by filtering out any update for which the value is identical to the previous update
	return {
		updates: updates.filter(([prop, _currProp, nextProp]) => {
			const prevProp = current.previous?.[prop]
			// If no previous ignore
			if (prevProp === undefined) {
				return true
			}

			return nextProp !== prevProp
		}),
	}
}

export async function trackGames(client: Client) {
	const stored = getStored()
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

	for (const universe of universes) {
		// Ensure still tracking game before updating
		if (!stored.trackingGames[universe.id]) {
			continue
		}
		const current = stored.trackingGames[universe.id]

		// For some reason, a game icon updating does not cause the game's updated property to change
		// so, we handle imageUrl separately for game
		// Only use new imageUrl if not any of the previous ones (with expiry in case actually swapped back)
		const icon = icons[universe.id]
		const imageUrl =
			current.previousImageUrls &&
			current.previousImageUrls.find(
				({ url, expiry }) => url === icon && Date.now() < expiry
			)
				? current.imageUrl
				: icon
		const imageUrlChanged = imageUrl !== current.imageUrl
		const next = { ...current, ...universe }
		const { updates, newPrevious } = getUpdates(
			current,
			next,
			GAME_TRACKING_PROPERTIES
		)
		stored.trackingGames[universe.id] = {
			...stored.trackingGames[universe.id],
			lastChecked: Date.now(),
		}
		// Only if an update (or image changed)
		if (updates.length > 0 || imageUrlChanged) {
			let color = current.color
			// Update image & color (if image changed)
			if (imageUrlChanged) {
				color = await getImageColor(imageUrl)
				updates.push(["imageUrl", current.imageUrl, imageUrl])
			}
			// Ensure still tracking game before updating
			if (!stored.trackingGames[universe.id]) {
				continue
			}

			stored.trackingGames[universe.id] = {
				...next,
				imageUrl,
				previousImageUrls: [
					...(next.previousImageUrls
						? next.previousImageUrls.filter(
								({ expiry }) => Date.now() < expiry
							)
						: []),
					{
						url: current.imageUrl,
						expiry: Date.now() + Config.GAME_IMAGE_URL_EXPIRY_MS,
					},
				],
				color,
				previous: newPrevious ? newPrevious : next.previous,
			}

			// Log & embed
			logger.logGame(`Updated ${universe.id}`)

			const channel = await getLogChannel(client)
			if (channel) {
				logger.logGame("Logged updates for games")
				// Send in background
				await channel
					.send({
						content: getNotificationContent(["update"]),
						embeds: [
							createGameUpdateEmbed(
								stored.trackingGames[universe.id],
								updates
							),
						],
					})
					.catch(logger.error)
				logger.logBadge(`Logged update for ${universe.id}`)
			}
		} else {
			logger.logBadge(`No updates for ${universe.id}`)
		}
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

	const stored = getStored()
	const current = stored.trackingBadges[id]
	// Should always be true if still tracking badge
	if (!current) {
		return
	}

	const next = { ...current, ...badge, imageUrl }
	const { updates, newPrevious } = getUpdates(
		current,
		next,
		BADGE_TRACKING_PROPERTIES
	)
	// Only if a meaningful update
	if (updates.length > 0) {
		let color = current.color
		// Update image color (if image changed)
		if (imageUrl !== current.imageUrl) {
			color = await getImageColor(imageUrl)
		}

		// Ensure we are still tracking
		if (!stored.trackingBadges[id]) {
			return
		}

		stored.trackingBadges[id] = {
			...next,
			color,
			previous: newPrevious ? newPrevious : next.previous,
		}

		// Log & embed
		logger.logBadge(`Updated ${id}`)
		const channel = await getLogChannel(client)
		if (channel) {
			await channel.send({
				content: getNotificationContent(["update"]),
				embeds: [
					createBadgeUpdateEmbed(stored.trackingBadges[id], updates),
				],
			})
			logger.logBadge(`Logged update for ${id}`)
		}
	} else {
		logger.logBadge(`No updates for ${id}`)
	}

	if (badge.statistics.awardedCount > current.statistics.awardedCount) {
		stored.trackingBadges[id] = {
			...stored.trackingBadges[id],
			statistics: badge.statistics,
			awardHistory: [
				...stored.trackingBadges[id].awardHistory,
				[Date.now(), badge.statistics.awardedCount],
			],
		}
		const firstAward = stored.trackingBadges[id].awardHistory.length <= 2
		const channel = await getLogChannel(client)
		logger.logBadge(
			`Updated award count for ${id} - ${current.statistics.awardedCount} -> ${badge.statistics.awardedCount}`
		)
		if (channel) {
			await channel.send({
				content: firstAward
					? getNotificationContent(["firstAward"])
					: undefined,
				embeds: [createBadgeEmbed(current, badge, false, firstAward)],
			})
			logger.logBadge(`Logged award update for ${id}`)
		}
	} else {
		logger.logBadge(`No award updates for ${id}`)
	}
}

export async function trackBadges(client: Client) {
	const stored = getStored()
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
