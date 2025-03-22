import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
} from "discord.js"
import { getStored } from "../util/store"
import {
	getBadge,
	getBadgeIcons,
	getBadges,
	getPlaceDetails,
} from "../util/api"
import Config from "../util/config"
import { getImageColor } from "../util/color"

export const data = new SlashCommandBuilder()
	.setName("track")
	.setDescription("Track a game's badges or a specific badge")
	.addSubcommand(
		new SlashCommandSubcommandBuilder()
			.setName("game")
			.setDescription("Tracks a game")
			.addStringOption((option) =>
				option
					.setName("link")
					.setDescription("The link to the game")
					.setRequired(true)
			)
	)
	.addSubcommand(
		new SlashCommandSubcommandBuilder()
			.setName("badge")
			.setDescription("Tracks a badge")
			.addStringOption((option) =>
				option
					.setName("link")
					.setDescription("The id or link to the badge")
					.setRequired(true)
			)
	)

export async function execute(interaction: ChatInputCommandInteraction) {
	const subcommand = interaction.options.getSubcommand()
	if (subcommand === "game") {
		const link = interaction.options.getString("link", true)
		const match = link.match(/(\d+)/)

		if (!match) {
			return await interaction.reply("Invalid link!")
		}

		await interaction.deferReply()

		const id = parseInt(match[0])
		const place = await getPlaceDetails(id)
		const badges = await getBadges(place.universeId)
		const toTrack = badges.filter(
			(badge) =>
				badge.statistics.awardedCount <= Config.MAX_AWARDED_TO_TRACK
		)
		const icons = await getBadgeIcons(toTrack.map((badge) => badge.id))

		const stored = await getStored()
		stored.trackingGames[place.universeId] = Date.now()
		toTrack.forEach(async (badge, i) => {
			const imageUrl = icons[i].imageUrl
			const imageColor = await getImageColor(imageUrl)
			stored.badgeData[badge.id] = {
				imageUrl,
				imageColor,
				...badge,
			}
		})

		interaction.editReply(
			`Scanned [${place.name}](https://roblox.com/games/${id}), found ${badges.length} badges\n` +
				`Now tracking ${toTrack.length} (threshold <= ${Config.MAX_AWARDED_TO_TRACK} awarded):\n` +
				toTrack
					.map(
						(badge) =>
							`- [${badge.name}](<https://roblox.com/badges/${badge.id}>) (${badge.statistics.awardedCount} awarded)`
					)
					.join("\n")
		)
	} else {
		const link = interaction.options.getString("link", true)
		const match = link.match(/(\d+)/)

		if (!match) {
			return await interaction.reply("Invalid link!")
		}

		await interaction.deferReply()

		const id = parseInt(match[0])
		const badge = await getBadge(id)
		const icons = await getBadgeIcons([id])
		const imageUrl = icons[0].imageUrl
		const imageColor = await getImageColor(imageUrl)

		const stored = await getStored()
		if (!stored.badgeData[id]) {
			stored.badgeData[id] = {
				imageUrl,
				imageColor,
				...badge,
			}
		}

		interaction.editReply(
			`Now tracking [${badge.name}](<https://roblox.com/badges/${badge.id}>) (${badge.statistics.awardedCount} awarded)`
		)
	}
}
