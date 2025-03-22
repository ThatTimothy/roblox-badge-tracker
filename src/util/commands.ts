// ref: https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands

import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import { readdir } from "fs/promises"
import path from "path"

interface Command {
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>
	data: SlashCommandBuilder
}

export async function readCommands(): Promise<Record<string, Command>> {
	const commands: Record<string, Command> = {}

	const foldersPath = path.join(__dirname, "..", "commands")
	const files = await readdir(foldersPath)
	const commandFiles = files.filter((file) => file.endsWith(".js"))

	for (const file of commandFiles) {
		const filePath = path.join(foldersPath, file)
		// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const command = require(filePath)
		const data = command.data as SlashCommandBuilder
		const execute = command.execute
		if (data && execute) {
			commands[data.name] = {
				execute,
				data,
			}
		} else {
			console.log(
				`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
			)
		}
	}

	return commands
}
