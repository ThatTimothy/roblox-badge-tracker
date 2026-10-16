import { Client, Events, MessageFlags, time, TimestampStyles } from "discord.js"
import Config from "./util/config"
import { getStored, store } from "./util/store"
import { readCommands } from "./util/commands"
import { trackBadges, trackGames } from "./util/track"
import API from "./util/api"
import logger, { getLogChannel } from "./util/log"
import { readButtons } from "./util/buttons"
import { sleep } from "./util/sleep"
import { createFailEmbed, createSuccessEmbed } from "./util/embeds"
import { stdout } from "process"

const client = new Client({
	intents: [],
})

async function track() {
	async function trackGamesLoop() {
		const start = Date.now()
		await trackGames(client)
		await sleep(Config.GAME_LOOP_INTERVAL_MS - (Date.now() - start))
	}
	async function trackBadgesLoop() {
		const start = Date.now()
		await trackBadges(client)
		await sleep(Config.BADGE_LOOP_INTERVAL_MS - (Date.now() - start))
	}

	try {
		await Promise.allSettled([trackGamesLoop(), trackBadgesLoop()])
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
	const logIn = Date.now()
	logger.log(`Last logout: ${stored.lastLogout}, now ${logIn}`)

	const logChannel = await getLogChannel(client)
	if (logChannel) {
		const fields = []
		if (stored.lastLogout) {
			fields.push({
				name: "Logged Out",
				value: time(
					new Date(stored.lastLogout),
					TimestampStyles.RelativeTime
				),
			})
		}
		fields.push({
			name: "Logged In",
			value: time(new Date(logIn), TimestampStyles.RelativeTime),
		})
		await logChannel.send({
			embeds: [
				createSuccessEmbed(
					"Bot Started",
					stored.lastLogout
						? "Resuming from last log out"
						: "Starting fresh!",
					fields
				),
			],
		})
	}

	setInterval(store, Config.STORE_INTERVAL_MS)

	let running = true
	async function shutdown() {
		if (!running) return
		running = false

		logger.error("Shutting down...")

		stored.lastLogout = Date.now()
		await store()

		const logChannel = await getLogChannel(client)
		if (logChannel) {
			await logChannel.send({
				embeds: [
					createFailEmbed(
						"Bot Stopped",
						"Will resume tracking when started again",
						{
							name: "Logged Out",
							value: time(
								new Date(stored.lastLogout),
								TimestampStyles.RelativeTime
							),
						}
					),
				],
			})
		}

		await client.destroy()

		logger.success("Logged out, stopping...")

		// Write len 0 to force flush
		await new Promise<void>((res) => process.stdout.write("", () => res()))

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
