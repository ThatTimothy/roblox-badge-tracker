import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import { getStored } from "../util/store"
import { getBadge } from "../util/api"

export const data = new SlashCommandBuilder()
	.setName("untrack-badge")
	.setDescription("Stops tracking a badge")
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

	const id = parseInt(match[0])
	const stored = await getStored()
	if (!stored.badgeData[id]) {
		return await interaction.reply("Not tracking that badge!")
	}

	const badge = await getBadge(id)

	delete stored.badgeData[id]
	delete stored.badgeData[id]

	interaction.reply(
		`Stopped tracking [${badge.name}](<https://roblox.com/badges/${badge.id}>) ([${badge.awardingUniverse.name}](https://roblox.com/games/${badge.awardingUniverse.rootPlaceId}))`
	)
}
