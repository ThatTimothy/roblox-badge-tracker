import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import { getStored } from "../util/store"
import { getBadges, getPlaceDetails } from "../util/api"
import Config from "../util/config"

export const data = new SlashCommandBuilder()
	.setName("track-game")
	.setDescription("Tracks a game")
	.addStringOption((option) =>
		option
			.setName("link")
			.setDescription("The link to the game")
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
	const details = await getPlaceDetails(id)
	const badges = await getBadges(details.universeId)
	const toTrack = badges.filter(
		(badge) => badge.statistics.awardedCount <= Config.MAX_AWARDED_TO_TRACK
	)

	const stored = await getStored()
	for (const track of toTrack) {
		const id = track.id
		if (stored.tracking[id]) break
		stored.tracking[id] = Date.now()
		stored.badgeAwardData[id] = track.statistics.awardedCount
	}

	interaction.editReply(
		`Scanned [${details.name}](https://roblox.com/games/${id}), found ${badges.length} badges\n` +
			`Now tracking ${toTrack.length} (threshold <= ${Config.MAX_AWARDED_TO_TRACK} awarded):\n` +
			toTrack
				.map(
					(badge) =>
						`- [${badge.name}](<https://roblox.com/badges/${badge.id}>) (${badge.statistics.awardedCount} awarded)`
				)
				.join("\n")
	)
}
