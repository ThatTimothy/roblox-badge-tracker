// ref: https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands

import { ButtonInteraction } from "discord.js"
import { readdir } from "fs/promises"
import path from "path"
import logger from "./log"

export interface Button {
	execute: (interaction: ButtonInteraction) => Promise<void>
}

export async function readButtons(): Promise<Record<string, Button>> {
	const buttons: Record<string, Button> = {}

	const foldersPath = path.join(__dirname, "..", "buttons")
	const files = await readdir(foldersPath)
	const commandFiles = files.filter((file) => file.endsWith(".js"))

	for (const file of commandFiles) {
		const filePath = path.join(foldersPath, file)
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const button = require(filePath)
		const execute = button.execute
		if (execute) {
			buttons[file.substring(0, file.length - 3)] = {
				execute,
			}
		} else {
			logger.error(
				`The button at ${filePath} is missing the required "execute" property.`
			)
			process.exit(1)
		}
	}

	return buttons
}
