import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
} from "discord.js"
import { getStored } from "../util/store"
import API from "../util/api"
import Config from "../util/config"
import { getImageColor } from "../util/color"
import {
	batchEmbedReply,
	createBadgeEmbed,
	createSuccessEmbed,
} from "../util/embeds"
import { updatedTrackedBadges } from "../util/track"

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
		const maxAwarded =
			interaction.options.getInteger("max-awarded") ??
			Config.MAX_AWARDED_TO_TRACK
		const match = link.match(/(\d+)/)

		if (!match) {
			return await interaction.reply("Invalid link!")
		}

		await interaction.deferReply()

		const id = parseInt(match[0])
		const universeId = await API.getUniverseIdFromPlaceId(id)
		if (!universeId) {
			return await interaction.editReply("Invalid link!")
		}

		const stored = await getStored()
		if (stored.trackingGames[universeId]) {
			return await interaction.editReply("Already tracking that game!")
		}

		const universe = (await API.getUniverseDetails([universeId]))[0]

		const universeIcons = await API.getUniverseIcons([universeId])
		const imageUrl = universeIcons[universeId]
		const color = await getImageColor(imageUrl)

		const badges = await API.getBadges(universeId)
		const toTrack = await updatedTrackedBadges(badges, maxAwarded)
		stored.trackingGames[universeId] = {
			...universe,
			imageUrl,
			color,
			maxAwarded,
		}

		const embeds = [
			createSuccessEmbed(
				`Now Tracking ${universe.name}`,
				`Scanned [${universe.name}](https://roblox.com/games/${id}), found ${badges.length} badges\n` +
					`Now tracking ${toTrack.length}${maxAwarded === null ? "" : ` (threshold <= ${maxAwarded.toLocaleString()} awarded)`}\n`
			),
			...toTrack.map((badge) =>
				createBadgeEmbed(stored.trackingBadges[badge.id])
			),
		]

		batchEmbedReply(interaction, embeds)
	} else {
		const link = interaction.options.getString("link", true)
		const match = link.match(/(\d+)/)

		if (!match) {
			return await interaction.reply("Invalid link!")
		}

		await interaction.deferReply()

		const id = parseInt(match[0])
		const badge = await API.getBadge(id)
		const icons = await API.getBadgeIcons([id])
		const imageUrl = icons[id]
		const color = await getImageColor(imageUrl)

		const stored = await getStored()
		if (!stored.trackingBadges[id]) {
			stored.trackingBadges[id] = {
				imageUrl,
				color: color,
				...badge,
			}
		}

		interaction.editReply({
			content: "Now tracking:",
			embeds: [createBadgeEmbed(stored.trackingBadges[id])],
		})
	}
}
