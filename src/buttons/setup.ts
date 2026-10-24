import { ButtonInteraction } from "discord.js"
import { getMessage } from "../commands/setup"

export async function execute(interaction: ButtonInteraction) {
	const index = parseInt(interaction.customId.split(":")[1])
	const newMessage = getMessage(index)
	await interaction.update(newMessage)
}
