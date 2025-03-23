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
import { getBadge } from "./util/api"
import { createBadgeEmbed } from "./util/embeds"

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

async function fetchBadge(id: number) {
	console.log(`Fetching ${id} (${queue.length} left in queue)`)
	const badge = await getBadge(id)

	const stored = await getStored()
	const previous = stored.badgeData[id]
	if (badge.statistics.awardedCount > previous.statistics.awardedCount) {
		stored.badgeData[id] = {
			...previous,
			...badge,
		}
		console.log(`Updated ${id}`)
		const channel = await getLogChannel()
		if (channel) {
			await channel.send({
				embeds: [createBadgeEmbed(previous, badge)],
			})
			console.log(`Logged ${id}`)
		}
	} else {
		console.log(`No updates for ${id}`)
	}
}

let queue: number[] = []
async function track() {
	const stored = await getStored()

	if (queue.length === 0) {
		queue = Object.values(stored.badgeData).map((badge) => badge.id)
	}

	const id = queue.pop()
	if (id && stored.badgeData[id]) {
		await fetchBadge(id)
	}

	setTimeout(track, Config.CHECK_INTERVAL_MS)
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
