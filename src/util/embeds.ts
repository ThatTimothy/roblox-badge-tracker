import {
	APIEmbed,
	APIEmbedField,
	BaseMessageOptionsWithPoll,
	ChatInputCommandInteraction,
	EmbedBuilder,
	JSONEncodable,
	RestOrArray,
	roleMention,
	time,
	userMention,
} from "discord.js"
import { BadgeData, GameData, getStored, StoredNotification } from "./store"
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

export function createBadgeEmbed(
	badgeData: BadgeData,
	updated?: Badge,
	firstAward?: boolean
) {
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
							(firstAward ? ` __**(First!)**__` : "") +
							` since ${time(Math.round(badgeData.awardHistory[badgeData.awardHistory.length - 1][0] / 1000), TimestampStyles.RelativeTime)}`
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

// Gets the content to mention users & roles for a specific set of notifications
export async function getNotificationContent(
	notifications: StoredNotification[]
) {
	const stored = await getStored()
	const mentions = []
	for (const notification of notifications) {
		const storedNotification = stored.notifications[notification]
		if (storedNotification) {
			mentions.push(...storedNotification.users.map(userMention))
			mentions.push(...storedNotification.roles.map(roleMention))
		}
	}

	if (mentions.length > 0) {
		return mentions.join(" ")
	}
}

type Embeds = (APIEmbed | JSONEncodable<APIEmbed>)[]
export async function batchEmbedReply(
	interaction:
		| ChatInputCommandInteraction
		| ((message: BaseMessageOptionsWithPoll) => Promise<unknown>),
	allEmbeds: Embeds,
	notifications?: StoredNotification[]
) {
	for (let i = 0; i < allEmbeds.length; i += 10) {
		const content =
			notifications && i == 0
				? await getNotificationContent(notifications)
				: undefined
		const embeds = allEmbeds.slice(i, i + 10)
		const message = {
			content,
			embeds,
		}

		if (typeof interaction === "function") {
			return await interaction(message)
		}

		if (!interaction.replied) {
			if (interaction.deferred) {
				await interaction.editReply(message)
			} else {
				await interaction.reply(message)
			}
		} else {
			await interaction.followUp(message)
		}
	}
}
