import { Client, Events, MessageFlags } from "discord.js"
import Config from "./util/config"
import { getStored, store } from "./util/store"
import { readCommands } from "./util/commands"
import { trackBadges, trackGames } from "./util/track"

const client = new Client({
	intents: [],
})

async function track() {
	await trackGames(client)
	for (let i = 0; i < Config.BADGE_TRACKS_PER_GAME_TRACK; i++) {
		await trackBadges(client)
	}
	setTimeout(track)
}

client.once(Events.ClientReady, async (readyClient) => {
	console.log("Successfully logged in!")
	const stored = await getStored()
	stored.lastLogin = Date.now()

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
	readyClient.on(Events.InteractionCreate, async (interaction) => {
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
	track()
})

client.login(Config.BOT_TOKEN)
