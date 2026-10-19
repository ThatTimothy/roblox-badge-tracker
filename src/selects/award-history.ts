import { AnySelectMenuInteraction } from "discord.js"
import {
	buildComponents,
	renderChartToAttachment,
} from "../commands/award-history"
import { getStored } from "../util/store"

export async function execute(interaction: AnySelectMenuInteraction) {
	if (!interaction.isStringSelectMenu()) {
		return
	}

	await interaction.deferUpdate()

	const choices = new Set(interaction.values)
	if (choices.has("-1")) {
		choices.delete("-1")
	}

	const stored = await getStored()
	const badges = Object.values(stored.trackingBadges)
	const all = choices.has("all")
	const selected = all
		? new Set(badges.map((badge) => badge.id))
		: new Set([...choices.values()].map((s) => parseInt(s)))
	const attachment = await renderChartToAttachment(
		badges.filter((badge) => selected.has(badge.id))
	)
	const components = buildComponents(badges, selected, all)

	await interaction.editReply({
		components,
		files: [attachment],
	})
}
