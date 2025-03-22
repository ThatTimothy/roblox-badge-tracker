import Config from "./config"

const HEADERS = {
	cookie: `.ROBLOSECURITY=${Config.ROBLOSECURITY};`,
}

const GAMES_API = "https://games.roblox.com"
const BADGES_API = "https://badges.roblox.com"

interface Badge {
	id: number
	name: string
	statistics: {
		awardedCount: number
	}
	awardingUniverse: {
		id: number
		name: string
		rootPlaceId: number
	}
}

interface Place {
	universeId: number
	name: string
}

async function getBadgePage(universeId: number, pageCursor?: string) {
	const url = new URL(`${BADGES_API}/v1/universes/${universeId}/badges`)
	url.searchParams.append("limit", "100")
	if (pageCursor) {
		url.searchParams.append("cursor", pageCursor)
	}
	const res = await fetch(url, { headers: HEADERS })

	if (!res.ok) {
		console.error(res.status, await res.text())
		process.exit(1)
	}

	const json = await res.json()
	return json
}

export async function getBadges(universeId: number): Promise<Badge[]> {
	const badges = []

	let pageCursor = undefined
	while (true) {
		const page = await getBadgePage(universeId, pageCursor)
		pageCursor = page.nextPageCursor

		for (const badge of page.data) {
			badges.push(badge)
		}

		if (!pageCursor) {
			break
		}
	}

	return badges
}

export async function getBadge(badgeId: number): Promise<Badge> {
	const res = await fetch(`${BADGES_API}/v1/badges/${badgeId}`, {
		headers: HEADERS,
	})

	if (!res.ok) {
		console.error(res.status, await res.text())
		process.exit(1)
	}

	const json = await res.json()
	return json
}

export async function getPlaceDetails(placeId: number): Promise<Place> {
	const url = new URL(`${GAMES_API}/v1/games/multiget-place-details`)
	url.searchParams.append("placeIds", placeId.toString())
	const res = await fetch(url, { headers: HEADERS })

	if (!res.ok) {
		console.error(res.status, await res.text())
		process.exit(1)
	}

	const json = await res.json()
	return json[0]
}
