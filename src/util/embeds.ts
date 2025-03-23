import {
	APIEmbed,
	ChatInputCommandInteraction,
	EmbedBuilder,
	JSONEncodable,
} from "discord.js"
import { BadgeData, PlaceData } from "./store"
import { Badge } from "./api"

export function createGameEmbed(place: PlaceData) {
	return new EmbedBuilder()
		.setTitle(place.name)
		.setURL(`https://roblox.com/games/${place.placeId}`)
		.setThumbnail(place.imageUrl)
		.setColor(place.imageColor)
}

export function createBadgeEmbed(badge: BadgeData, updated?: Badge) {
	return new EmbedBuilder()
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
				value: updated
					? `${badge.statistics.awardedCount} → ${updated.statistics.awardedCount} (+${updated.statistics.awardedCount - badge.statistics.awardedCount})`
					: badge.statistics.awardedCount.toString(),
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
		| ChatInputCommandInteraction
		| ((embeds: Embeds) => Promise<unknown>),
	allEmbeds: Embeds,
	edit?: boolean
) {
	for (let i = 0; i < allEmbeds.length; i += 10) {
		const embeds = allEmbeds.slice(i, i + 10)

		if (typeof interaction === "function") {
			return await interaction(embeds)
		}

		if (i === 0) {
			if (edit) {
				await interaction.editReply({ embeds })
			} else {
				await interaction.reply({ embeds })
			}
		} else {
			await interaction.followUp({ embeds })
		}
	}
}
