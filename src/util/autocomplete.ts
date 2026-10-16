import { ApplicationCommandOptionChoiceData } from "discord.js"
import { getStored } from "./store"

export async function autocompleteGame(search: string) {
	const stored = await getStored()
	const choices: ApplicationCommandOptionChoiceData[] = Object.values(
		stored.trackingGames
	).map((game) => ({
		name: game.name,
		value: `https://roblox.com/games/${game.rootPlaceId}`,
	}))

	const top25 = choices
		.sort((a, b) => a.name.localeCompare(b.name))
		.filter((choice) =>
			choice.name.toLowerCase().includes(search.toLowerCase())
		)
		.slice(0, 25)

	return top25
}

export async function autocompleteBadge(search: string) {
	const stored = await getStored()
	const choices: ApplicationCommandOptionChoiceData[] = Object.values(
		stored.trackingBadges
	).map((badge) => ({
		name: badge.name,
		value: badge.id.toString(),
	}))

	const top25 = choices
		.sort((a, b) => a.name.localeCompare(b.name))
		.filter((choice) =>
			choice.name.toLowerCase().includes(search.toLowerCase())
		)
		.slice(0, 25)

	return top25
}
