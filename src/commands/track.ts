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
	getUniverseIcons,
} from "../util/api"
import Config from "../util/config"
import { getImageColor } from "../util/color"
import {
	batchEmbedReply,
	createBadgeEmbed,
	createSuccessEmbed,
} from "../util/embeds"

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
			.addIntegerOption((option) =>
				option
					.setName("max-awarded")
					.setDescription(
						`Upper limit of awarded count to start tracking, default ${Config.MAX_AWARDED_TO_TRACK}, -1 for none`
					)
					.setMinValue(-1)
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

		const universeIcons = await getUniverseIcons([place.universeId])
		const universeImageUrl = universeIcons[0].imageUrl
		const universeImageColor = await getImageColor(universeImageUrl)
		const stored = await getStored()
		stored.trackingGames[place.universeId] = {
			...place,
			imageUrl: universeImageUrl,
			imageColor: universeImageColor,
		}

		const badges = await getBadges(place.universeId)
		const maxAwarded =
			interaction.options.getInteger("max-awarded") ??
			Config.MAX_AWARDED_TO_TRACK
		const toTrack =
			maxAwarded < 0
				? badges
				: badges.filter(
						(badge) => badge.statistics.awardedCount <= maxAwarded
					)

		const badgeIcons = await getBadgeIcons(toTrack.map((badge) => badge.id))
		toTrack.forEach(async (badge, i) => {
			const imageUrl = badgeIcons[i].imageUrl
			const imageColor = await getImageColor(imageUrl)
			stored.badgeData[badge.id] = {
				imageUrl,
				imageColor,
				...badge,
			}
		})

		const embeds = [
			createSuccessEmbed(
				`Now Tracking ${place.name}`,
				`Scanned [${place.name}](https://roblox.com/games/${id}), found ${badges.length} badges\n` +
					`Now tracking ${toTrack.length}${maxAwarded === null ? "" : ` (threshold <= ${maxAwarded} awarded)`}\n`
			),
			...toTrack.map((badge) =>
				createBadgeEmbed(stored.badgeData[badge.id])
			),
		]

		batchEmbedReply(interaction, embeds, true)
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

		interaction.editReply({
			content: "Now tracking:",
			embeds: [createBadgeEmbed(stored.badgeData[id])],
		})
	}
}
