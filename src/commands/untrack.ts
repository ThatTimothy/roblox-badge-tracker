import {
	ActionRowBuilder,
	ApplicationCommandOptionChoiceData,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
} from "discord.js"
import { getStored } from "../util/store"
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

export async function untrackGame(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	id: number
) {
	const stored = await getStored()
	const trackingGame = Object.values(stored.trackingGames).find(
		(trackingGame) => trackingGame.rootPlaceId == id
	)
	if (!trackingGame) {
		return await interaction.reply("Not tracking that game!")
	}

	const badges = Object.values(stored.trackingBadges).filter(
		(badge) => badge.awardingUniverse.rootPlaceId === id
	)

	delete stored.trackingGames[trackingGame.id]
	badges.forEach((badge) => delete stored.trackingBadges[badge.id])

	interaction.reply({
		embeds: [
			createSuccessEmbed(
				`Stopped Tracking ${trackingGame.name}`,
				`Stopped tracking ${badges.length} badges from [${trackingGame.name}](https://roblox.com/games/${id})`
			),
		],
	})
}

export async function execute(interaction: ChatInputCommandInteraction) {
	const subcommand = interaction.options.getSubcommand()
	if (subcommand === "game") {
		const link = interaction.options.getString("link", true)
		const match = link.match(/(\d+)/)

		if (!match) {
			return await interaction.reply("Invalid link!")
		}

		const id = parseInt(match[0])
		await untrackGame(interaction, id)
	} else {
		const link = interaction.options.getString("link", true)
		const match = link.match(/(\d+)/)

		if (!match) {
			return await interaction.reply("Invalid link!")
		}

		const id = parseInt(match[0])
		const stored = await getStored()
		if (!stored.trackingBadges[id]) {
			return await interaction.reply("Not tracking that badge!")
		}

		const badge = stored.trackingBadges[id]
		delete stored.trackingBadges[id]

		const showUntrackButton =
			badge.awardingUniverse.id in stored.trackingGames
		const untrackButton = new ButtonBuilder()
			.setCustomId(`untrack-game:${badge.awardingUniverse.rootPlaceId}`)
			.setLabel(
				`Untrack Game ${badge.awardingUniverse.name}`.slice(0, 80)
			)
			.setStyle(ButtonStyle.Danger)
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			untrackButton
		)
		const components = showUntrackButton ? [row] : undefined

		interaction.reply({
			embeds: [
				createSuccessEmbed(
					`Stopped Tracking ${badge.name}`,
					`Stopped tracking [${badge.name}](<https://roblox.com/badges/${badge.id}>) (in [${badge.awardingUniverse.name}](https://roblox.com/games/${badge.awardingUniverse.rootPlaceId}))`
				),
			],
			components,
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
			value: game.rootPlaceId.toString(),
		}))

		const top25 = choices
			.sort((a, b) => a.name.localeCompare(b.name))
			.filter((choice) =>
				choice.name.toLowerCase().includes(search.toLowerCase())
			)
			.slice(0, 25)

		interaction.respond(top25)
	} else {
		const stored = await getStored()
		const choices: ApplicationCommandOptionChoiceData[] = Object.values(
			stored.trackingBadges
		).map((badge) => ({
			name: badge.name,
			value: badge.id.toString(),
		}))

		const top25 = choices
			.sort((a, b) => a.name.localeCompare(b.name))
			.filter((choice) =>
				choice.name.toLowerCase().includes(search.toLowerCase())
			)
			.slice(0, 25)

		interaction.respond(top25)
	}
}
