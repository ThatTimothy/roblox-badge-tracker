import { Client, SendableChannels } from "discord.js"
import {
	Badge,
	getBadge,
	getBadgeIcons,
	getBadges,
	getPlaceDetails,
	getUniverseIcons,
} from "./api"
import { getImageColor } from "./color"
import { getStored } from "./store"
import Config from "./config"
import { batchEmbedReply, createBadgeEmbed, createSuccessEmbed } from "./embeds"
import { sleep } from "./sleep"

export async function updatedTrackedBadges(
	badges: Badge[],
	maxAwarded: number
) {
	const stored = await getStored()
	// Only track badges that are new or meet the maxAwarded count
	// maxAwarded < 0 means no requirement for awarded
	const toTrack = badges.filter(
		(badge) =>
			!stored.badgeData[badge.id] &&
			(maxAwarded < 0 || badge.statistics.awardedCount <= maxAwarded)
	)

	if (toTrack.length === 0) {
		return []
	}

	const badgeIcons = await getBadgeIcons(toTrack.map((badge) => badge.id))
	for (let i = 0; i < toTrack.length; i++) {
		const badge = toTrack[i]
		const imageUrl = badgeIcons[i].imageUrl
		const imageColor = await getImageColor(imageUrl)
		stored.badgeData[badge.id] = {
			imageUrl,
			imageColor,
			...badge,
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
	const place = stored.trackingGames[id]
	const maxAwarded = place.maxAwarded

	const badges = await getBadges(id)
	const toTrack = await updatedTrackedBadges(badges, maxAwarded)

	if (toTrack.length > 0) {
		console.log(`Found new badges for game ${id}`)
		const embeds = [
			createSuccessEmbed(
				`New Badges For ${place.name}`,
				`Now tracking ${toTrack.length}${maxAwarded === null ? "" : ` (threshold <= ${maxAwarded.toLocaleString()} awarded)`}\n`
			),
			...toTrack.map((badge) =>
				createBadgeEmbed(stored.badgeData[badge.id])
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
		(place) => place.universeId
	)

	if (queue.length === 0) {
		return
	}

	console.log("Refetching game details...")
	const games = await getPlaceDetails(
		Object.values(stored.trackingGames).map((game) => game.placeId)
	)
	const icons = await getUniverseIcons(games.map((game) => game.universeId))

	for (let i = 0; i < games.length; i++) {
		const game = games[i]
		const imageUrl = icons[i].imageUrl
		const imageColor = await getImageColor(imageUrl)

		stored.trackingGames[game.universeId] = {
			...stored.trackingGames[game.universeId],
			...game,
			imageUrl,
			imageColor,
		}
	}
	console.log("Updated game details")

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.trackingGames[id]) {
			console.log(`Fetching game ${id} (${queue.length} left in queue)`)
			await fetchGame(client, id)
			await sleep(Config.CHECK_INTERVAL_MS)
		}
	}
}

async function fetchBadge(client: Client, id: number) {
	const badge = await getBadge(id)

	const stored = await getStored()
	const previous = stored.badgeData[id]
	if (badge.statistics.awardedCount > previous.statistics.awardedCount) {
		stored.badgeData[id] = {
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
	const queue = Object.values(stored.badgeData).map((badge) => badge.id)

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.badgeData[id]) {
			console.log(`Fetching badge ${id} (${queue.length} left in queue)`)
			await fetchBadge(client, id)
			await sleep(Config.CHECK_INTERVAL_MS)
		}
	}
}
