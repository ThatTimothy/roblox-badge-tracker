import {
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
} from "discord.js"
import { getStored } from "../util/store"

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
		const stored = await getStored()
		const places = Object.values(stored.trackingGames)
		const badges = Object.values(stored.badgeData)
		const allEmbeds = places.map((place) =>
			new EmbedBuilder()
				.setTitle(place.name)
				.setURL(`https://roblox.com/games/${place.placeId}`)
				.setDescription(`Tracking ${badges.length} badges`)
				.setThumbnail(place.imageUrl)
				.setColor(place.imageColor)
		)

		for (let i = 0; i < allEmbeds.length; i += 10) {
			const embeds = allEmbeds.slice(i, i + 10)
			await (i === 0
				? interaction.reply({ embeds })
				: interaction.followUp({ embeds }))
		}
	} else {
		const stored = await getStored()
		const badges = Object.values(stored.badgeData)
		const allEmbeds = badges.map((badge) =>
			new EmbedBuilder()
				.setTitle(badge.name)
				.setURL(`https://roblox.com/badges/${badge.id}`)
				.setDescription(
					`in [**${badge.awardingUniverse.name}**](https://roblox.com/games/${badge.awardingUniverse.rootPlaceId})`
				)
				.setThumbnail(badge.imageUrl)
				.setColor(badge.imageColor)
				.addFields([
					{
						name: "Awarded",
						value: badge.statistics.awardedCount.toString(),
					},
				])
		)

		for (let i = 0; i < allEmbeds.length; i += 10) {
			const embeds = allEmbeds.slice(i, i + 10)
			await (i === 0
				? interaction.reply({ embeds })
				: interaction.followUp({ embeds }))
		}
	}
}
