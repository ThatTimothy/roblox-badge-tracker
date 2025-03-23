import Config from "./config"

const HEADERS = {
	cookie: `.ROBLOSECURITY=${Config.ROBLOSECURITY};`,
}

const GAMES_API = "https://games.roblox.com"
const BADGES_API = "https://badges.roblox.com"
const THUMBNAILS_API = "https://thumbnails.roblox.com"

export interface Badge {
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

export interface Icon {
	targetId: number
	imageUrl: string
}

export interface Place {
	universeId: number
	placeId: number
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
		throw new Error(`${res.status} ${await res.text()}`)
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
		throw new Error(`${res.status} ${await res.text()}`)
	}

	const json = await res.json()
	return json
}

export async function getBadgeIcons(badgeIds: number[]): Promise<Icon[]> {
	const url = new URL(`${THUMBNAILS_API}/v1/badges/icons`)
	url.searchParams.append("size", "150x150")
	url.searchParams.append("format", "Png")
	for (const badgeId of badgeIds) {
		url.searchParams.append("badgeIds", badgeId.toString())
	}
	const res = await fetch(url, { headers: HEADERS })

	if (!res.ok) {
		throw new Error(`${res.status} ${await res.text()}`)
	}

	const json = await res.json()
	return json.data
}

export async function getPlaceDetails(placeId: number): Promise<Place> {
	const url = new URL(`${GAMES_API}/v1/games/multiget-place-details`)
	url.searchParams.append("placeIds", placeId.toString())
	const res = await fetch(url, { headers: HEADERS })

	if (!res.ok) {
		throw new Error(`${res.status} ${await res.text()}`)
	}

	const json = await res.json()
	return json[0]
}

export async function getUniverseIcons(universeIds: number[]): Promise<Icon[]> {
	const url = new URL(`${THUMBNAILS_API}/v1/games/icons`)
	url.searchParams.append("size", "512x512")
	url.searchParams.append("format", "Png")
	for (const universeId of universeIds) {
		url.searchParams.append("universeIds", universeId.toString())
	}
	const res = await fetch(url, { headers: HEADERS })

	if (!res.ok) {
		throw new Error(`${res.status} ${await res.text()}`)
	}

	const json = await res.json()
	return json.data
}
