import {
	ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	SlashCommandChannelOption,
} from "discord.js"
import { getStored } from "../util/store"

export const data = new SlashCommandBuilder()
	.setName("log-channel")
	.setDescription("Sets the log channel")
	.addChannelOption((option) =>
		option
			.setName("channel")
			.setDescription("The channel")
			.setRequired(true)
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

export async function execute(interaction: ChatInputCommandInteraction) {
	const stored = await getStored()
	const channel = interaction.options.getChannel("channel", true)
	stored.logChannel = channel.id
	await interaction.reply({
		content: `Set the log channel to <#${channel.id}>`,
		flags: MessageFlags.Ephemeral,
	})
}
