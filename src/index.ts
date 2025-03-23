import {
	Client,
	Events,
	GatewayIntentBits,
	MessageFlags,
	SendableChannels,
} from "discord.js"
import Config from "./util/config"
import { getStored, store } from "./util/store"
import { readCommands } from "./util/commands"
import {
	getBadge,
	getBadges,
	getPlaceDetails,
	getUniverseIcons,
} from "./util/api"
import {
	batchEmbedReply,
	createBadgeEmbed,
	createSuccessEmbed,
} from "./util/embeds"
import { sleep } from "./util/sleep"
import { updatedTrackedBadges } from "./util/track"
import { getImageColor } from "./util/color"

const client = new Client({
	intents: [GatewayIntentBits.GuildMessages],
})

async function getLogChannel(): Promise<SendableChannels | undefined> {
	const stored = await getStored()
	if (!stored.logChannel) return
	const channel = await client.channels.fetch(stored.logChannel)
	if (!channel) return
	if (!channel.isSendable()) return
	return channel
}

async function fetchGame(id: number) {
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

		const channel = await getLogChannel()
		if (channel) {
			batchEmbedReply((embeds) => channel.send({ embeds }), embeds)
			console.log(`Logged new badges for game ${id}`)
		}
	} else {
		console.log(`No updates for game ${id}`)
	}
}

async function trackGames() {
	const stored = await getStored()
	const queue = Object.values(stored.trackingGames).map(
		(place) => place.universeId
	)

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
			await fetchGame(id)
			await sleep(Config.CHECK_INTERVAL_MS)
		}
	}
}

async function fetchBadge(id: number) {
	const badge = await getBadge(id)

	const stored = await getStored()
	const previous = stored.badgeData[id]
	if (badge.statistics.awardedCount > previous.statistics.awardedCount) {
		stored.badgeData[id] = {
			...previous,
			...badge,
		}
		console.log(`Updated badge ${id}`)
		const channel = await getLogChannel()
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

async function trackBadges() {
	const stored = await getStored()
	const queue = Object.values(stored.badgeData).map((badge) => badge.id)

	while (queue.length > 0) {
		const id = queue.pop()
		if (id && stored.badgeData[id]) {
			console.log(`Fetching badge ${id} (${queue.length} left in queue)`)
			await fetchBadge(id)
			await sleep(Config.CHECK_INTERVAL_MS)
		}
	}
}

async function track() {
	await trackGames()
	for (let i = 0; i < Config.BADGE_TRACKS_PER_GAME_TRACK; i++) {
		await trackBadges()
	}
	setTimeout(track)
}

client.once(Events.ClientReady, async (_readyClient) => {
	console.log("Successfully logged in!")
	const stored = await getStored()
	stored.lastLogin = Date.now()

	if (stored.logChannel) {
		client.channels.fetch(stored.logChannel)
	}

	setInterval(store, Config.STORE_INTERVAL_MS)

	let running = true
	async function shutdown() {
		if (!running) return
		running = false

		await store()

		process.exit(0)
	}

	process.once("SIGINT", shutdown)
	process.once("SIGTERM", shutdown)
	process.once("SIGQUIT", shutdown)

	const commands = await readCommands()
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isChatInputCommand()) return

		const command = commands[interaction.commandName]

		if (!command) {
			console.error(
				`No command matching ${interaction.commandName} was found.`
			)
			return
		}

		try {
			await command.execute(interaction)
		} catch (error) {
			console.error(error)
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: "There was an error while executing this command!",
					flags: MessageFlags.Ephemeral,
				})
			} else {
				await interaction.reply({
					content: "There was an error while executing this command!",
					flags: MessageFlags.Ephemeral,
				})
			}
		}
	})

	// Tracking
	track()
})

client.login(Config.BOT_TOKEN)
