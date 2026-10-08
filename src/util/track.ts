import { Client, SendableChannels } from "discord.js"
import API, { Badge } from "./api"
import { getImageColor } from "./color"
import { getStored } from "./store"
import { batchEmbedReply, createBadgeEmbed, createSuccessEmbed } from "./embeds"

export async function updatedTrackedBadges(
	badges: Badge[],
	maxAwarded: number
) {
	const stored = await getStored()
	// Only track badges that are new or meet the maxAwarded count
	// maxAwarded < 0 means no requirement for awarded
	const toTrack = badges.filter(
		(badge) =>
			!stored.trackingBadges[badge.id] &&
			(maxAwarded < 0 || badge.statistics.awardedCount <= maxAwarded)
	)

	if (toTrack.length === 0) {
		return []
	}

	const badgeIcons = await API.getBadgeIcons(toTrack.map((badge) => badge.id))
	for (const badge of toTrack) {
		const imageUrl = badgeIcons[badge.id]
		const color = await getImageColor(imageUrl)
		stored.trackingBadges[badge.id] = {
			...badge,
			imageUrl,
			color,
		}
	}

	return toTrack
}

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

async function fetchGame(client: Client, id: number) {
	const stored = await getStored()
	const trackingGame = stored.trackingGames[id]
	const maxAwarded = trackingGame.maxAwarded

	const badges = await API.getBadges(id)
	const toTrack = await updatedTrackedBadges(badges, maxAwarded)

	if (toTrack.length > 0) {
		console.log(`Found new badges for game ${id}`)
		const embeds = [
			createSuccessEmbed(
				`New Badges For ${trackingGame.name}`,
				`Now tracking ${toTrack.length}${maxAwarded === null ? "" : ` (threshold <= ${maxAwarded.toLocaleString()} awarded)`}\n`
			),
			...toTrack.map((badge) =>
				createBadgeEmbed(stored.trackingBadges[badge.id])
			),
		]

		const channel = await getLogChannel(client)
		if (channel) {
			batchEmbedReply((embeds) => channel.send({ embeds }), embeds)
			console.log(`Logged new badges for game ${id}`)
		}
	} else {
		console.log(`No updates for game ${id}`)
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

	console.log("Refetching game details...")
	const universes = await API.getUniverseDetails(
		Object.values(stored.trackingGames).map((game) => game.id)
	)
	const icons = await API.getUniverseIcons(
		universes.map((universe) => universe.id)
	)

	for (const universe of universes) {
		const imageUrl = icons[universe.id]
		const color = await getImageColor(imageUrl)

		stored.trackingGames[universe.id] = {
			...stored.trackingGames[universe.id],
			...universe,
			color,
			imageUrl,
		}
	}
	console.log("Updated game details")

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.trackingGames[id]) {
			console.log(`Fetching game ${id} (${queue.length} left in queue)`)
			await fetchGame(client, id)
		}
	}
}

async function fetchBadge(client: Client, id: number) {
	const badge = await API.getBadge(id)

	const stored = await getStored()
	const previous = stored.trackingBadges[id]
	if (badge.statistics.awardedCount > previous.statistics.awardedCount) {
		stored.trackingBadges[id] = {
			...previous,
			...badge,
		}
		console.log(`Updated badge ${id}`)
		const channel = await getLogChannel(client)
		if (channel) {
			await channel.send({
				embeds: [createBadgeEmbed(previous, badge)],
			})
			console.log(`Logged badge ${id}`)
		}
	} else {
		console.log(`No updates for badge ${id}`)
	}
}

export async function trackBadges(client: Client) {
	const stored = await getStored()
	const queue = Object.values(stored.trackingBadges).map((badge) => badge.id)

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.trackingBadges[id]) {
			console.log(`Fetching badge ${id} (${queue.length} left in queue)`)
			await fetchBadge(client, id)
		}
	}
}
