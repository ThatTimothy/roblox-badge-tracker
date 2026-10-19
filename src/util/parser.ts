// ref: https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands

import {
	AnySelectMenuInteraction,
	AutocompleteInteraction,
	ButtonInteraction,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js"
import { readdir } from "fs/promises"
import path from "path"
import logger from "./log"

interface Command {
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>
	autocomplete?: (iteration: AutocompleteInteraction) => Promise<void>
	data: SlashCommandBuilder
}

export interface Button {
	execute: (interaction: ButtonInteraction) => Promise<void>
}

export interface Select {
	execute: (interaction: AnySelectMenuInteraction) => Promise<void>
}

function hasProps<T>(exec: unknown, required: (keyof T & string)[]): exec is T {
	if (typeof exec !== "object" || exec === null) {
		return false
	}
	for (const prop of required) {
		if (!(prop in exec)) {
			return false
		}
	}
	return true
}

async function parse<T extends Command | Button | Select>(
	dir: string,
	required: (keyof T & string)[]
): Promise<Record<string, T>> {
	const parsed: Record<string, T> = {}

	const foldersPath = path.join(__dirname, "..", dir)
	const files = await readdir(foldersPath)
	const execFiles = files.filter((file) => file.endsWith(".js"))

	for (const file of execFiles) {
		const filePath = path.join(foldersPath, file)
		// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const exec = require(filePath) as unknown
		if (!hasProps(exec, required)) {
			logger.error(
				`${filePath} is missing a required property, should have: ${required}.`
			)
			process.exit(1)
		}
		parsed[
			"data" in exec
				? (exec as Command).data["name"]
				: file.substring(0, file.length - 3)
		] = exec
	}

	return parsed
}

export async function readCommands(): Promise<Record<string, Command>> {
	return parse<Command>("commands", ["data", "execute"])
}

export async function readButtons(): Promise<Record<string, Button>> {
	return parse<Button>("buttons", ["execute"])
}

export async function readSelects(): Promise<Record<string, Select>> {
	return parse<Select>("selects", ["execute"])
}
