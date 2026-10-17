import { AnySelectMenuInteraction } from "discord.js"
import { configuration } from "../commands/setup"
import { getStored } from "../util/store"

export async function execute(interaction: AnySelectMenuInteraction) {
	const id = interaction.customId.split(":")[1]

	const config = configuration.find((config) => config.configKey === id)
	if (!config) {
		return
	}

	const stored = await getStored()
	if (
		config.type === "channel" &&
		interaction.isChannelSelectMenu() &&
		interaction.values[0]
	) {
		stored.channels[config.configKey] = interaction.values[0]
		await interaction.update()
	} else if (
		config.type === "mentionable" &&
		interaction.isMentionableSelectMenu()
	) {
		stored.notifications[config.configKey] = {
			users: [...interaction.users.keys()],
			roles: [...interaction.roles.keys()],
		}
		await interaction.update()
	}
}
