import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js"
import Config from "./util/config"
import { getStored, store } from "./util/store"
import { readCommands } from "./util/commands"
import { getBadge } from "./util/api"

const client = new Client({
	intents: [GatewayIntentBits.GuildMessages],
})

let queue: number[] = []
async function track() {
	const stored = await getStored()
	if (!stored.logChannel) return
	const channel = await client.channels.fetch(stored.logChannel)
	if (!channel) return
	if (!channel.isSendable()) return

	if (queue.length === 0) {
		queue = Object.keys(stored.tracking).map((s) => parseInt(s))
	}

	const id = queue.pop() as number
	console.log(`Fetching ${id} (${queue.length} left in queue)`)
	const badge = await getBadge(id)

	const previous = stored.badgeAwardData[id]
	const now = badge.statistics.awardedCount
	stored.tracking[id] = Date.now()
	if (previous != now) {
		stored.badgeAwardData[id] = now
		await channel.send(
			`Updated stats for [${badge.name}](<https://roblox.com/badges/${badge.id}>) ([${badge.awardingUniverse.name}](<https://roblox.com/games/${badge.awardingUniverse.rootPlaceId}>)): ${previous} -> ${now} awarded`
		)
	}
	console.log(`Logged ${id}...`)

	setTimeout(track, Config.CHECK_INTERVAL_MS)
}

client.once(Events.ClientReady, async (_readyClient) => {
	console.log("Successfully logged in!")
	const stored = await getStored()
	stored.lastLogin = Date.now()

	if (stored.logChannel) {
		client.channels.fetch(stored.logChannel)
	}

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
