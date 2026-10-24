import {
	APIEmbed,
	APIEmbedField,
	ChannelType,
	ChatInputCommandInteraction,
	Client,
	EmbedBuilder,
	JSONEncodable,
	RestOrArray,
	roleMention,
	TextChannel,
	time,
	userMention,
} from "discord.js"
import {
	AwardedMessage,
	BadgeData,
	GameData,
	getStored,
	StoredNotification,
	UpdatedMessage,
} from "./store"
import { TimestampStyles } from "discord.js"

const AWARDED_TIMESPANS: [string, number][] = [
	["last 5 minutes", 5 * 60 * 1000],
	["last 15 minutes", 15 * 60 * 1000],
	["last 30 minutes", 30 * 60 * 1000],
	["last hour", 60 * 60 * 1000],
	["last 2 hours", 2 * 60 * 60 * 1000],
	["last 4 hours", 4 * 60 * 60 * 1000],
	["last 8 hours", 8 * 60 * 60 * 1000],
	["last 16 hours", 16 * 60 * 60 * 1000],
	["last day", 24 * 60 * 60 * 1000],
]

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

// Embed that contains all previous badge information summarized nicely
export function mergedBadgeEmbed(badgeData: BadgeData) {
	const {
		awardHistory,
		statistics: { awardedCount },
	} = badgeData
	const earliest = awardHistory[0]
	const latest = awardHistory[awardHistory.length - 1]
	const timespan = latest[0] - earliest[0]

	return createBadgeEmbed(badgeData).setFields([
		{
			name: "First Award",
			value: `${earliest[1].toLocaleString()} (${time(Math.round(earliest[0] / 1000), TimestampStyles.RelativeTime)})`,
		},
		{
			name: "Awarded",
			value: `${awardedCount.toLocaleString()} as of ${time(Math.round(latest[0] / 1000), TimestampStyles.RelativeTime)}`,
		},
		...AWARDED_TIMESPANS.filter(([_, length]) => timespan > length).map(
			([name, length]) => {
				const cutoff = latest[0] - length

				let closest = earliest
				for (const entry of awardHistory) {
					if (entry[0] <= cutoff) {
						closest = entry
					} else {
						break
					}
				}

				const start = closest[1]
				const end = latest[1]

				return {
					name: `Awarded (${name})`,
					value:
						`${start.toLocaleString()} → ${end.toLocaleString()}` +
						` (+${(end - start).toLocaleString()})`,
				}
			}
		),
		...(earliest[1] > 0
			? [
					{
						name: "Awarded (all time)",
						value:
							`${earliest[1].toLocaleString()} → ${latest[1].toLocaleString()}` +
							` (+${(latest[1] - earliest[1]).toLocaleString()})`,
					},
				]
			: []),
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

export function mergeUpdatedEmbed(existing: APIEmbed, newer: EmbedBuilder) {
	// Merge fields with existing, putting existing first, newer with timestamp
	const fields = [
		...(existing.fields ?? []),
		...(newer.data.fields?.map((embed) => ({
			...embed,
			name:
				embed.name +
				` (as of ${time(new Date(), TimestampStyles.RelativeTime)})`,
		})) ?? []),
	]
	newer.setFields(fields)

	return newer
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
): Promise<TextChannel | undefined> {
	const stored = getStored()
	if (!stored.channels.logChannel) return
	const channel =
		client.channels.cache.get(stored.channels.logChannel) ||
		(await client.channels.fetch(stored.channels.logChannel))
	if (!channel) return
	if (channel.type !== ChannelType.GuildText) return
	return channel
}

// If a previous updatedMessage, edits that one into a merged version
// Otherwise, just sends the embed directly
// Returns the updated message to be stored for future calls
export async function handleUpdatedMessage<T extends BadgeData | GameData>(
	channel: TextChannel,
	data: T,
	embed: EmbedBuilder
): Promise<UpdatedMessage> {
	if (data.updatedMessage && data.updatedMessage.updated === data.updated) {
		const newEmbed = mergeUpdatedEmbed(data.updatedMessage.embed, embed)
		await channel.messages.edit(data.updatedMessage.id, {
			embeds: [newEmbed],
		})
		return {
			...data.updatedMessage,
			embed: newEmbed.toJSON(),
		}
	}

	const message = await channel.send({
		content: getNotificationContent(["updated"]),
		embeds: [embed],
	})

	return {
		id: message.id,
		embed: embed.toJSON(),
		updated: data.updated,
	}
}

// If a previous awardedMessage, edits that into merged version
// Otherwise, creates the appropriate embed and sends it
// Returns the awardedMessage to be stored for future calls
export async function handleAwardedMessage(
	channel: TextChannel,
	current: BadgeData,
	updated: BadgeData
): Promise<AwardedMessage> {
	if (updated.awardedMessage) {
		const newEmbed = mergedBadgeEmbed(updated)
		await channel.messages.edit(updated.awardedMessage.id, {
			embeds: [newEmbed],
		})
		return {
			...updated.awardedMessage,
			embed: newEmbed.toJSON(),
		}
	}

	const firstAward = updated.awardHistory.length <= 2
	const embed = createBadgeEmbed(
		current,
		updated.statistics.awardedCount,
		false,
		firstAward
	)
	const message = await channel.send({
		content: firstAward
			? getNotificationContent(["firstAward"])
			: undefined,
		embeds: [embed],
	})

	return { id: message.id, embed: embed.toJSON() }
}
