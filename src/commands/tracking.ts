import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
} from "discord.js"
import { getStored } from "../util/store"
import {
	batchEmbedReply,
	createBadgeEmbed,
	createFailEmbed,
	createGameEmbed,
} from "../util/embeds"

export const data = new SlashCommandBuilder()
	.setName("tracking")
	.setDescription("List the games or badges that are being tracked")
	.addSubcommand(
		new SlashCommandSubcommandBuilder()
			.setName("games")
			.setDescription("Lists the games being tracked")
	)
	.addSubcommand(
		new SlashCommandSubcommandBuilder()
			.setName("badges")
			.setDescription("Lists the badges being tracked")
	)

export async function execute(interaction: ChatInputCommandInteraction) {
	const subcommand = interaction.options.getSubcommand()
	if (subcommand === "games") {
		const stored = getStored()
		const badges = Object.values(stored.trackingBadges)
		const allEmbeds = Object.values(stored.trackingGames).map((gameData) =>
			createGameEmbed(
				gameData,
				badges.filter(
					(badge) => badge.awardingUniverse.id == gameData.id
				).length
			)
		)

		if (allEmbeds.length === 0) {
			return await interaction.reply({
				embeds: [
					createFailEmbed(
						"Not Tracking Any Games",
						"No games are currently being tracked, track one with `/track game [link]`!"
					),
				],
			})
		}

		await batchEmbedReply(interaction, allEmbeds)
	} else {
		const stored = getStored()
		const badges = Object.values(stored.trackingBadges)
		const allEmbeds = badges.map((badge) => createBadgeEmbed(badge))

		if (allEmbeds.length === 0) {
			return await interaction.reply({
				embeds: [
					createFailEmbed(
						"Not Tracking Any Badges",
						"No badges are currently being tracked, track one with `/track badge [link]`!"
					),
				],
			})
		}

		await batchEmbedReply(interaction, allEmbeds)
	}
}
