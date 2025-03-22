import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import { getStored } from "../util/store"
import { getBadge, getBadges, getPlaceDetails } from "../util/api"
import Config from "../util/config"

export const data = new SlashCommandBuilder()
	.setName("track-badge")
	.setDescription("Tracks a badge")
	.addStringOption((option) =>
		option
			.setName("link")
			.setDescription("The id or link to the badge")
			.setRequired(true)
	)

export async function execute(interaction: ChatInputCommandInteraction) {
	const link = interaction.options.getString("link", true)
	const match = link.match(/(\d+)/)

	if (!match) {
		return await interaction.reply("Invalid link!")
	}

	await interaction.deferReply()

	const id = parseInt(match[0])
	const badge = await getBadge(id)

	const stored = await getStored()
	if (!stored.tracking[id]) {
		stored.tracking[id] = Date.now()
		stored.badgeAwardData[id] = badge.statistics.awardedCount
	}

	interaction.editReply(
		`Now tracking [${badge.name}](<https://roblox.com/badges/${badge.id}>) (${badge.statistics.awardedCount} awarded)`
	)
}
