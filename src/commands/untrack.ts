import {
	ApplicationCommandOptionChoiceData,
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
} from "discord.js"
import { getStored } from "../util/store"
import { getPlaceDetails } from "../util/api"
import { createSuccessEmbed } from "../util/embeds"

export const data = new SlashCommandBuilder()
	.setName("untrack")
	.setDescription("Stops tracking a game or badge")
	.addSubcommand(
		new SlashCommandSubcommandBuilder()
			.setName("game")
			.setDescription("Stops tracking a game")
			.addStringOption((option) =>
				option
					.setName("link")
					.setDescription("The link to the game")
					.setRequired(true)
					.setAutocomplete(true)
			)
	)
	.addSubcommand(
		new SlashCommandSubcommandBuilder()
			.setName("badge")
			.setDescription("Stops tracking a badge")
			.addStringOption((option) =>
				option
					.setName("link")
					.setDescription("The id or link to the badge")
					.setRequired(true)
					.setAutocomplete(true)
			)
	)

export async function execute(interaction: ChatInputCommandInteraction) {
	const subcommand = interaction.options.getSubcommand()
	if (subcommand === "game") {
		const link = interaction.options.getString("link", true)
		const match = link.match(/(\d+)/)

		if (!match) {
			return await interaction.reply("Invalid link!")
		}

		const id = parseInt(match[0])
		const stored = await getStored()
		const place = (await getPlaceDetails([id]))[0]
		if (!place || !stored.trackingGames[place.universeId]) {
			return await interaction.reply("Not tracking that game!")
		}

		const badges = Object.values(stored.badgeData).filter(
			(badge) => badge.awardingUniverse.rootPlaceId === id
		)

		delete stored.trackingGames[place.universeId]
		badges.forEach((badge) => delete stored.badgeData[badge.id])

		interaction.reply({
			embeds: [
				createSuccessEmbed(
					`Stopped Tracking ${place.name}`,
					`Stopped tracking ${badges.length} badges from [${place.name}](https://roblox.com/games/${id})`
				),
			],
		})
	} else {
		const link = interaction.options.getString("link", true)
		const match = link.match(/(\d+)/)

		if (!match) {
			return await interaction.reply("Invalid link!")
		}

		const id = parseInt(match[0])
		const stored = await getStored()
		if (!stored.badgeData[id]) {
			return await interaction.reply("Not tracking that badge!")
		}

		const badge = stored.badgeData[id]
		delete stored.badgeData[id]

		interaction.reply({
			embeds: [
				createSuccessEmbed(
					`Stopped Tracking ${badge.name}`,
					`Stopped tracking [${badge.name}](<https://roblox.com/badges/${badge.id}>) (in [${badge.awardingUniverse.name}](https://roblox.com/games/${badge.awardingUniverse.rootPlaceId}))`
				),
			],
		})
	}
}

export async function autocomplete(interaction: AutocompleteInteraction) {
	const search = interaction.options.getFocused()
	const subcommand = interaction.options.getSubcommand()
	if (subcommand === "game") {
		const stored = await getStored()
		const choices: ApplicationCommandOptionChoiceData[] = Object.values(
			stored.trackingGames
		).map((game) => ({
			name: game.name,
			value: game.placeId.toString(),
		}))

		const top25 = choices
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, 25)
			.filter((choice) =>
				choice.name.toLowerCase().includes(search.toLowerCase())
			)

		interaction.respond(top25)
	} else {
		const stored = await getStored()
		const choices: ApplicationCommandOptionChoiceData[] = Object.values(
			stored.badgeData
		).map((badge) => ({
			name: badge.name,
			value: badge.id.toString(),
		}))

		const top25 = choices
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, 25)
			.filter((choice) =>
				choice.name.toLowerCase().includes(search.toLowerCase())
			)

		interaction.respond(top25)
	}
}
