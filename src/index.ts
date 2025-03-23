import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js"
import Config from "./util/config"
import { getStored, store } from "./util/store"
import { readCommands } from "./util/commands"
import { track } from "./util/track"

const client = new Client({
	intents: [GatewayIntentBits.GuildMessages],
})

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
		if (interaction.isChatInputCommand()) {
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
						content:
							"There was an error while executing this command!",
						flags: MessageFlags.Ephemeral,
					})
				} else {
					await interaction.reply({
						content:
							"There was an error while executing this command!",
						flags: MessageFlags.Ephemeral,
					})
				}
			}
		} else if (interaction.isAutocomplete()) {
			const command = commands[interaction.commandName]

			if (!command || !command.autocomplete) {
				console.error(
					`No command matching ${interaction.commandName} was found.`
				)
				return
			}

			try {
				await command.autocomplete(interaction)
			} catch (error) {
				console.error(error)
			}
		}
	})

	// Tracking
	track(client)
})

client.login(Config.BOT_TOKEN)
