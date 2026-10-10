import {
	APIEmbed,
	ChatInputCommandInteraction,
	EmbedBuilder,
	JSONEncodable,
} from "discord.js"
import { BadgeData, GameData } from "./store"
import { Badge } from "./api"

export function createGameEmbed(gameData: GameData, badges: number) {
	return new EmbedBuilder()
		.setTitle(gameData.name)
		.setURL(`https://roblox.com/games/${gameData.rootPlaceId}`)
		.setThumbnail(gameData.imageUrl)
		.setColor(gameData.color)
		.addFields([
			{
				name: "Tracking",
				value: `${badges} badge${badges !== 1 ? "s" : ""}`,
			},
		])
}

export function createBadgeEmbed(badgeData: BadgeData, updated?: Badge) {
	const previousCount = badgeData.statistics.awardedCount
	const updatedCount = updated?.statistics.awardedCount
	const awardingUniverse = (updated || badgeData).awardingUniverse
	return new EmbedBuilder()
		.setTitle(updated?.name || badgeData.name)
		.setURL(`https://roblox.com/badges/${badgeData.id}`)
		.setDescription(
			`in [**${awardingUniverse.name}**](https://roblox.com/games/${awardingUniverse.rootPlaceId})`
		)
		.setThumbnail(badgeData.imageUrl)
		.setColor(badgeData.color)
		.addFields([
			{
				name: "Awarded",
				value:
					updatedCount !== undefined && updatedCount != previousCount
						? `${previousCount.toLocaleString()} → ${updatedCount.toLocaleString()} (+${(updatedCount - previousCount).toLocaleString()})`
						: previousCount.toString(),
			},
		])
}

export function createSuccessEmbed(title: string, description: string) {
	return new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setColor("Green")
}

export function createErrorEmbed(title: string, description: string) {
	return new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setColor("Red")
}

type Embeds = (APIEmbed | JSONEncodable<APIEmbed>)[]
export async function batchEmbedReply(
	interaction:
		ChatInputCommandInteraction | ((embeds: Embeds) => Promise<unknown>),
	allEmbeds: Embeds
) {
	for (let i = 0; i < allEmbeds.length; i += 10) {
		const embeds = allEmbeds.slice(i, i + 10)

		if (typeof interaction === "function") {
			return await interaction(embeds)
		}

		if (!interaction.replied) {
			if (interaction.deferred) {
				await interaction.editReply({ embeds })
			} else {
				await interaction.reply({ embeds })
			}
		} else {
			await interaction.followUp({ embeds })
		}
	}
}
