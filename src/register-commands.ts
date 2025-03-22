import { readCommands } from "./util/commands"
import Config from "./util/config"
import { REST, Routes } from "discord.js"

// ref: https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands

async function main() {
	const commands = await readCommands()
	const body = Object.values(commands).map((command) => command.data.toJSON())
	const rest = new REST().setToken(Config.BOT_TOKEN)

	console.log(`Started refreshing ${body.length} application (/) commands.`)

	// The put method is used to fully refresh all commands in the guild with the current set
	const data = (await rest.put(
		Routes.applicationGuildCommands(Config.CLIENT_ID, Config.GUILD_ID),
		{ body }
	)) as unknown[]

	console.log(
		`Successfully reloaded ${data.length} application (/) commands.`
	)
}

main()
