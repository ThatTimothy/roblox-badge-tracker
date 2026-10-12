import { Client, SendableChannels, time, TimestampStyles } from "discord.js"
import API, { Badge, Universe } from "./api"
import { getImageColor } from "./color"
import { getStored } from "./store"
import {
	batchEmbedReply,
	createBadgeEmbed,
	createBadgeUpdateEmbed,
	createGameUpdateEmbed,
	createSuccessEmbed,
} from "./embeds"
import logger from "./log"

const UNIVERSE_TRACKING_PROPERTIES: (keyof Universe)[] = [
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
]

const BADGE_TRACKING_PROPERTIES: (keyof Badge)[] = [
	"name",
	"description",
	"enabled",
	"iconImageId",
	"created",
	"updated",
]

async function getLogChannel(
	client: Client
): Promise<SendableChannels | undefined> {
	const stored = await getStored()
	if (!stored.logChannel) return
	const channel = await client.channels.fetch(stored.logChannel)
	if (!channel) return
	if (!channel.isSendable()) return
	return channel
}

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

		const channel = await getLogChannel(client)
		if (channel) {
			batchEmbedReply((embeds) => channel.send({ embeds }), embeds)
			logger.logGame(`Logged new badges for ${id}`)
		}
	} else {
		logger.logGame(`No updates for ${id}`)
	}

	// Ensure still tracking, then update existing badges for next iteration
	if (stored.trackingGames[id]) {
		stored.trackingGames[id].existingBadges = badges.map(
			(badge) => badge.id
		)
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
	if (timeSinceLastUpdate >= 0) {
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

	const embeds = []
	for (const universe of universes) {
		const imageUrl = icons[universe.id]
		const color = await getImageColor(imageUrl)

		// Ensure still tracking game before updating
		if (stored.trackingGames[universe.id]) {
			stored.trackingGames[universe.id] = {
				...stored.trackingGames[universe.id],
				color,
				imageUrl,
			}

			const result = getUpdates(
				stored.trackingGames[universe.id],
				universe,
				UNIVERSE_TRACKING_PROPERTIES
			)
			if (result) {
				const { updates, currUpdated } = result
				// Only if a meaningful update
				if (updates.length > 0) {
					logger.logGame(`Updated ${universe.id}`)
					embeds.push(
						createGameUpdateEmbed(
							stored.trackingGames[universe.id],
							updates,
							currUpdated
						)
					)
				}

				stored.trackingGames[universe.id] = {
					...stored.trackingGames[universe.id],
					...universe,
				}
			}
		}
	}

	if (embeds.length > 0) {
		const channel = await getLogChannel(client)
		if (channel) {
			batchEmbedReply((embeds) => channel.send({ embeds }), embeds)
			logger.logGame("Logged updates for games")
		}
	} else {
		logger.logGame("No updates for games")
	}

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.trackingGames[id]) {
			logger.logGame(
				`Fetching badges for ${id} (${queue.length} left in queue)`
			)
			await checkNewGameBadges(client, id)
		}
	}
}

async function fetchBadge(client: Client, id: number) {
	const badge = await API.getBadge(id)

	const stored = await getStored()
	const previous = stored.trackingBadges[id]
	// Should always be true if still tracking badge
	if (!previous) {
		return
	}

	const embeds = []
	const result = getUpdates(previous, badge, BADGE_TRACKING_PROPERTIES)
	if (result) {
		const { updates, currUpdated } = result
		// Only if a meaningful update
		if (updates.length > 0) {
			logger.logBadge(`Updated ${id}`)
			embeds.push(
				createBadgeUpdateEmbed(
					stored.trackingBadges[id],
					updates,
					currUpdated
				)
			)
		}

		stored.trackingBadges[id] = {
			...previous,
			...badge,
		}
	}

	if (badge.statistics.awardedCount > previous.statistics.awardedCount) {
		logger.logBadge(
			`Updated award count for ${id} - ${previous.statistics.awardedCount} -> ${badge.statistics.awardedCount}`
		)
		embeds.push(createBadgeEmbed(previous, badge))
	}

	if (embeds.length > 0) {
		const channel = await getLogChannel(client)
		if (channel) {
			batchEmbedReply((embeds) => channel.send({ embeds }), embeds)
			logger.logBadge(`Logged ${id}`)
		}
	} else {
		logger.logBadge(`No updates for ${id}`)
	}
}

export async function trackBadges(client: Client) {
	const stored = await getStored()
	const queue = Object.values(stored.trackingBadges).map((badge) => badge.id)

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.trackingBadges[id]) {
			logger.logBadge(`Fetching ${id} (${queue.length} left in queue)`)
			await fetchBadge(client, id)
		}
	}
}
