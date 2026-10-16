import {
	APIEmbed,
	APIEmbedField,
	ChatInputCommandInteraction,
	EmbedBuilder,
	JSONEncodable,
	RestOrArray,
	time,
} from "discord.js"
import { BadgeData, GameData } from "./store"
import { Badge } from "./api"
import { TimestampStyles } from "discord.js"

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
			{
				name: "Last Checked",
				value: `${time(Math.round(gameData.lastChecked / 1000), TimestampStyles.RelativeTime)}`,
			},
			{
				name: "Last Updated",
				value: `${time(new Date(gameData.updated), TimestampStyles.LongDateShortTime)}`,
			},
		])
}

export function createGameUpdateEmbed(
	gameData: GameData,
	updates: [string, unknown, unknown][],
	currUpdated: Date | null
) {
	return new EmbedBuilder()
		.setTitle(gameData.name)
		.setURL(`https://roblox.com/games/${gameData.rootPlaceId}`)
		.setDescription(
			`was updated ${currUpdated ? time(currUpdated, TimestampStyles.RelativeTime) : ""}`
		)
		.setThumbnail(gameData.imageUrl)
		.setColor(gameData.color)
		.addFields(
			updates.map(([name, old, curr]) => ({
				name: name.charAt(0).toUpperCase() + name.slice(1),
				value: `${`${old}`.slice(0, 500)} → ${`${curr}`.slice(0, 500)}`,
			}))
		)
}

export function createBadgeEmbed(badgeData: BadgeData, updated?: Badge) {
	const previousCount = badgeData.statistics.awardedCount
	const updatedCount = updated?.statistics.awardedCount
	const awardingUniverse = (updated || badgeData).awardingUniverse
	return new EmbedBuilder()
		.setTitle(badgeData.name)
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
						? `${previousCount.toLocaleString()} → ${updatedCount.toLocaleString()}` +
							` (+${(updatedCount - previousCount).toLocaleString()})` +
							` since ${time(Math.round(badgeData.awardHistory[badgeData.awardHistory.length - 2][0] / 1000), TimestampStyles.RelativeTime)}`
						: previousCount.toLocaleString(),
			},
		])
}

export function createBadgeUpdateEmbed(
	badgeData: BadgeData,
	updates: [string, unknown, unknown][],
	currUpdated: Date | null
) {
	return new EmbedBuilder()
		.setTitle(badgeData.name)
		.setURL(`https://roblox.com/badges/${badgeData.id}`)
		.setDescription(
			`was updated ${currUpdated ? time(currUpdated, TimestampStyles.RelativeTime) : ""}`
		)
		.setThumbnail(badgeData.imageUrl)
		.setColor(badgeData.color)
		.addFields(
			updates.map(([name, old, curr]) => ({
				name: name.charAt(0).toUpperCase() + name.slice(1),
				value: `${`${old}`.slice(0, 500)} → ${`${curr}`.slice(0, 500)}`,
			}))
		)
}

export function createSuccessEmbed(
	title: string,
	description: string,
	...fields: RestOrArray<APIEmbedField>
) {
	return new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setColor("Green")
		.addFields(...fields)
}

export function createFailEmbed(
	title: string,
	description: string,
	...fields: RestOrArray<APIEmbedField>
) {
	return new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setColor("Red")
		.addFields(...fields)
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
