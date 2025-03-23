import { EmbedBuilder } from "discord.js"
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
