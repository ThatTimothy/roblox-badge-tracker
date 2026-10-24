import {
	CacheType,
	Client,
	Events,
	Interaction,
	MessageFlags,
	time,
	TimestampStyles,
} from "discord.js"
import Config from "./util/config"
import { getStored, initializeStored, store } from "./util/store"
import { readButtons, readCommands, readSelects } from "./util/parser"
import { trackBadges, trackGames } from "./util/track"
import API from "./util/api"
import logger, { getLogChannel } from "./util/log"
import { sleep } from "./util/sleep"
import { createFailEmbed, createSuccessEmbed } from "./util/embeds"
import { parseArgs } from "node:util"

let running = true

async function track(client: Client<true>) {
	async function trackGamesLoop() {
		const start = Date.now()
		await trackGames(client)
		if (running)
			await sleep(Config.GAME_LOOP_INTERVAL_MS - (Date.now() - start))
	}
	async function trackBadgesLoop() {
		const start = Date.now()
		await trackBadges(client)
		if (running)
			await sleep(Config.BADGE_LOOP_INTERVAL_MS - (Date.now() - start))
	}

	while (running) {
		try {
			await Promise.allSettled([trackGamesLoop(), trackBadgesLoop()])
		} catch (e) {
			logger.error(e)
		}
	}
}

async function ready(client: Client<true>) {
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

	const stored = getStored()
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

	setInterval(() => {
		store().catch(logger.error)
	}, Config.STORE_INTERVAL_MS)

	const commands = await readCommands()
	const buttons = await readButtons()
	const selects = await readSelects()

	async function handleInteraction(interaction: Interaction<CacheType>) {
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
		} else if (interaction.isAnySelectMenu()) {
			const base = interaction.customId.split(":")[0]
			const select = selects[base]
			if (!select) {
				logger.error(`No select matching ${base} was found.`)
				return
			}

			try {
				await select.execute(interaction)
			} catch (error) {
				logger.error(error)
			}
		}
	}
	client.on(Events.InteractionCreate, (interaction) => {
		handleInteraction(interaction).catch(logger.error)
	})

	logger.success("Setup complete!")

	// Tracking
	const trackLoopPromise = track(client)

	// Shutdown handling
	async function shutdown() {
		if (!running) return
		running = false

		logger.error("Shutting down...")
		process.stdin.setRawMode(false)
		process.stdin.pause()

		// Wait for track loop to finish
		await trackLoopPromise
		logger.success("Track loop finished")

		stored.lastLogout = Date.now()
		await store()

		logger.success("Logging out, stopping...")
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

		process.exit(0)
	}

	process.once("SIGINT", () => {
		shutdown().catch(logger.error)
	})
	process.once("SIGTERM", () => {
		shutdown().catch(logger.error)
	})
	process.once("SIGQUIT", () => {
		shutdown().catch(logger.error)
	})

	// Shortcuts
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true)
		process.stdin.setEncoding("utf-8")
		process.stdin.resume()
		process.stdin.on("data", (key) => {
			// Ctrl+C or Ctrl+D or q for shutdown
			if (key === "\u0003" || key === "\u0004" || key === "q") {
				shutdown().catch(logger.error)
			} else if (key == "s") {
				// s for save
				store().catch(logger.error)
			}
		})
	}
}

async function main() {
	const { values } = parseArgs({
		options: {
			dev: { type: "boolean", default: false },
		},
	})
	if (values.dev) {
		logger.success("Development mode enabled!")
	}

	await initializeStored(values.dev)

	const client = new Client({
		intents: [],
	})

	client.once(Events.ClientReady, (readyClient) => {
		ready(readyClient).catch(logger.error)
	})

	client.login(Config.BOT_TOKEN).catch(logger.error)
}

main().catch(logger.error)
