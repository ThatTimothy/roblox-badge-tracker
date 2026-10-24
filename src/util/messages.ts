import {
	APIEmbed,
	APIEmbedField,
	ChatInputCommandInteraction,
	Client,
	EmbedBuilder,
	JSONEncodable,
	RestOrArray,
	roleMention,
	SendableChannels,
	time,
	userMention,
} from "discord.js"
import { BadgeData, GameData, getStored, StoredNotification } from "./store"
import { TimestampStyles } from "discord.js"

function format(u: unknown) {
	if (
		typeof u === "boolean" ||
		typeof u === "number" ||
		typeof u === "string"
	) {
		return u.toString()
	} else if (typeof u === "object" && u instanceof Date) {
		return time(u, TimestampStyles.RelativeTime)
	} else {
		return `${u}`
	}
}

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

export function createGameUpdatedEmbed(
	gameData: GameData,
	updates: [string, unknown, unknown][]
) {
	return new EmbedBuilder()
		.setTitle(gameData.name)
		.setURL(`https://roblox.com/games/${gameData.rootPlaceId}`)
		.setDescription(
			`was updated ${time(new Date(gameData.updated), TimestampStyles.RelativeTime)}` +
				(updates.length === 1 && updates[0][0] === "imageUrl"
					? `, image was updated ${time(new Date(), TimestampStyles.RelativeTime)}`
					: "")
		)
		.setThumbnail(gameData.imageUrl)
		.setColor(gameData.color)
		.addFields(
			updates.map(([name, curr, next]) => ({
				name: name.charAt(0).toUpperCase() + name.slice(1),
				value: `${`${format(curr)}`.slice(0, 500)} → ${`${format(next)}`.slice(0, 500)}`,
			}))
		)
}

export function createBadgeEmbed(
	badgeData: BadgeData,
	updatedCount?: number,
	newBadge?: boolean,
	firstAward?: boolean
) {
	const previousCount = badgeData.statistics.awardedCount
	const awardingUniverse = badgeData.awardingUniverse
	return new EmbedBuilder()
		.setTitle(badgeData.name)
		.setURL(`https://roblox.com/badges/${badgeData.id}`)
		.setDescription(
			(newBadge ? "__**NEW BADGE**__ " : "") +
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

export function createBadgeUpdatedEmbed(
	badgeData: BadgeData,
	updates: [string, unknown, unknown][]
) {
	return new EmbedBuilder()
		.setTitle(badgeData.name)
		.setURL(`https://roblox.com/badges/${badgeData.id}`)
		.setDescription(
			`in [**${badgeData.awardingUniverse.name}**](https://roblox.com/games/${badgeData.awardingUniverse.rootPlaceId})` +
				` was updated ${time(new Date(badgeData.updated), TimestampStyles.RelativeTime)}`
		)
		.setThumbnail(badgeData.imageUrl)
		.setColor(badgeData.color)
		.addFields(
			updates.map(([name, curr, next]) => ({
				name: name.charAt(0).toUpperCase() + name.slice(1),
				value: `${`${format(curr)}`.slice(0, 500)} → ${`${format(next)}`.slice(0, 500)}`,
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
	interaction: ChatInputCommandInteraction,
	allEmbeds: Embeds
) {
	for (let i = 0; i < allEmbeds.length; i += 10) {
		const embeds = allEmbeds.slice(i, i + 10)
		const message = {
			embeds,
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

// Gets the content to mention users & roles (deduplicated) for a specific set of notifications
export function getNotificationContent(notifications: StoredNotification[]) {
	const stored = getStored()
	const mentions = new Set<string>()
	for (const notification of notifications) {
		const storedNotification = stored.notifications[notification]
		if (storedNotification) {
			for (const user of storedNotification.users) {
				mentions.add(userMention(user))
			}
			for (const role of storedNotification.roles) {
				mentions.add(roleMention(role))
			}
		}
	}

	if (mentions.size > 0) {
		return [...mentions].join(" ")
	}
}

export async function getLogChannel(
	client: Client
): Promise<SendableChannels | undefined> {
	const stored = getStored()
	if (!stored.channels.logChannel) return
	const channel =
		client.channels.cache.get(stored.channels.logChannel) ||
		(await client.channels.fetch(stored.channels.logChannel))
	if (!channel) return
	if (!channel.isSendable()) return
	return channel
}
