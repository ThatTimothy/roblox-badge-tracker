import { ButtonInteraction } from "discord.js"
import { untrackGame } from "../commands/untrack"

export async function execute(interaction: ButtonInteraction) {
	const id = parseInt(interaction.customId.split(":")[1])
	untrackGame(interaction, id)
}
