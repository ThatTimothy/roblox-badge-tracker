import { Client, SendableChannels } from "discord.js"
import API from "./api"
import { getImageColor } from "./color"
import { getStored } from "./store"
import { batchEmbedReply, createBadgeEmbed, createSuccessEmbed } from "./embeds"
import logger from "./log"

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

	for (const universe of universes) {
		const imageUrl = icons[universe.id]
		const color = await getImageColor(imageUrl)

		// Ensure still tracking game before updating
		if (stored.trackingGames[universe.id]) {
			stored.trackingGames[universe.id] = {
				...stored.trackingGames[universe.id],
				...universe,
				color,
				imageUrl,
			}
		}
	}
	logger.logGame("Updated game details")

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.trackingGames[id]) {
			logger.logGame(`Fetching ${id} (${queue.length} left in queue)`)
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
	if (badge.statistics.awardedCount > previous.statistics.awardedCount) {
		stored.trackingBadges[id] = {
			...previous,
			...badge,
		}
		logger.logBadge(`Updated ${id}`)
		const channel = await getLogChannel(client)
		if (channel) {
			await channel.send({
				embeds: [createBadgeEmbed(previous, badge)],
			})
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
