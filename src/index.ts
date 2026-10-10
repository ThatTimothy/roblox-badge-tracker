import { Client, Events, MessageFlags } from "discord.js"
import Config from "./util/config"
import { getStored, store } from "./util/store"
import { readCommands } from "./util/commands"
import { trackBadges, trackGames } from "./util/track"
import API from "./util/api"
import logger from "./util/log"
import { readButtons } from "./util/buttons"

const client = new Client({
	intents: [],
})

async function track() {
	try {
		await Promise.all([trackGames(client), trackBadges(client)])
	} catch (e) {
		logger.error(e)
	}

	setTimeout(track)
}

client.once(Events.ClientReady, async (readyClient) => {
	logger.success("Successfully logged into Discord!")

	const verified = await API.verify()
	if ("message" in verified) {
		logger.error(
			`Roblox API key is not valid - ${JSON.stringify(verified)}`
		)
		process.exit(1)
	}
	if (verified.expired) {
		logger.error("Roblox API key is expired - please update!")
		process.exit(1)
	}
	if (!verified.enabled) {
		logger.error("Roblox API key is disabled - please enable!")
		process.exit(1)
	}
	logger.success(
		`Roblox API key '${verified.name}' by ${verified.authorizedUserId} is verified!`
	)

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
	const buttons = await readButtons()
	readyClient.on(Events.InteractionCreate, async (interaction) => {
		if (interaction.isChatInputCommand()) {
			const command = commands[interaction.commandName]

			if (!command) {
				logger.error(
					`No command matching ${interaction.commandName} was found.`
				)
				return
			}

			try {
				await command.execute(interaction)
			} catch (error) {
				logger.error(error)
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
				logger.error(
					`No command matching ${interaction.commandName} was found.`
				)
				return
			}

			try {
				await command.autocomplete(interaction)
			} catch (error) {
				logger.error(error)
			}
		} else if (interaction.isButton()) {
			const base = interaction.customId.split(":")[0]
			const button = buttons[base]
			if (!button) {
				logger.error(`No button matching ${base} was found.`)
				return
			}

			try {
				await button.execute(interaction)
			} catch (error) {
				logger.error(error)
			}
		}
	})

	logger.success("Setup complete!")

	// Tracking
	track()
})

client.login(Config.BOT_TOKEN)
