import { readCommands } from "./util/parser"
import Config, { requireEnv } from "./util/config"
import { REST, Routes } from "discord.js"
import { parseArgs } from "util"

// ref: https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands

async function main() {
	const {
		values: { dev },
	} = parseArgs({
		options: {
			dev: { type: "boolean", default: false },
		},
	})

	const commands = await readCommands()
	const body = Object.values(commands).map((command) => command.data.toJSON())
	const rest = new REST().setToken(Config.BOT_TOKEN)

	console.log(`Started refreshing ${body.length} application (/) commands.`)

	// The put method is used to fully refresh all commands in the guild with the current set
	if (dev) {
		const GUILD_ID = requireEnv("GUILD_ID")
		const data = (await rest.put(
			Routes.applicationGuildCommands(Config.CLIENT_ID, GUILD_ID),
			{ body }
		)) as unknown[]

		console.log(
			`Successfully reloaded ${data.length} application (/) commands for guild ${GUILD_ID}.`
		)
	} else {
		const data = (await rest.put(
			Routes.applicationCommands(Config.CLIENT_ID),
			{ body }
		)) as unknown[]

		console.log(
			`Successfully reloaded ${data.length} application (/) commands globally.`
		)

		const GUILD_ID = process.env["GUILD_ID"]
		if (GUILD_ID) {
			// Remove dev commands
			console.log("Removing guild commands...")
			await rest.put(
				Routes.applicationGuildCommands(Config.CLIENT_ID, GUILD_ID),
				{ body: [] }
			)
			console.log("Successfully removed guild commands.")
		}
	}
}

main().catch(console.error)
