import Config from "./config"
import { sleep } from "./sleep"

const API_BASE = "https://apis.roblox.com"
const GAMES_API = "https://games.roblox.com"
const BADGES_API = "https://badges.roblox.com"
const THUMBNAILS_API = "https://thumbnails.roblox.com"

const RATELIMIT_REMAINING_HEADER = "x-ratelimit-remaining"
const RATELIMIT_RESET_HEADER = "x-ratelimit-reset"
const RATELIMIT_RETRY_AFTER = "retry-after"

export type IntrospectResponse =
	| {
			name: string
			authorizedUserId: number
			enabled: boolean
			expired: boolean
	  }
	| {
			code: number
			message: string
	  }

export interface Universe {
	id: number
	rootPlaceId: number
	name: string
	description: string | null
	copyingAllowed: boolean
	maxPlayers: number
	created: string
	updated: string
	studioAccessToApisAllowed: boolean
	createVipServersAllowed: boolean
	universeAvatarType: string
	genre: string
	genre_l1: string
}

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

class APIClient {
	private key: string
	private ratelimitBuckets = new Map<
		string,
		{ remaining: number; reset: number }
	>()
	constructor(key: string) {
		this.key = key
	}

	async verify(): Promise<IntrospectResponse> {
		const res = await fetch(`${API_BASE}/api-keys/v1/introspect`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: this.key }),
		})

		return res.json()
	}

	private async request(
		key: string,
		url: string | URL,
		method: string,
		body?: object
	) {
		let attempts = 0
		while (true) {
			let bucket = this.ratelimitBuckets.get(key)
			if (!bucket) {
				bucket = { reset: 0, remaining: 0 }
				this.ratelimitBuckets.set(key, bucket)
			}

			// If bucket has no requests left and is not due for reset, then wait for the reset
			if (bucket.remaining <= 0 && bucket.reset > Date.now()) {
				await sleep(Math.max(50, bucket.reset - Date.now()))
			}

			// Make the request
			attempts += 1
			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.key,
				},
				body: body ? JSON.stringify(body) : undefined,
			})

			// Check ratelimit headers for information
			const headers = response.headers
			const numHeader = (header: string) => {
				const raw = headers.get(header)
				if (!raw || raw.trim() == "") {
					return undefined
				}
				return parseInt(raw)
			}

			const ratelimitRemaining = numHeader(RATELIMIT_REMAINING_HEADER) // 'x-ratelimit-remaining': '99',
			const ratelimitReset = numHeader(RATELIMIT_RESET_HEADER) // 'x-ratelimit-reset': '57',
			const retryAfter = numHeader(RATELIMIT_RETRY_AFTER) // if 429: remaining == 0, retry-after = some amount of time, not reset time

			// Update bucket
			if (
				ratelimitRemaining !== undefined &&
				ratelimitReset !== undefined
			) {
				bucket.remaining = ratelimitRemaining
				bucket.reset = Date.now() + ratelimitReset * 1000
			}

			// On ratelimit, wait retry after
			if (response.status == 429) {
				// Prefer: ratelimitReset, then retryAfter, and if no headers then backoff by number of attempts
				const tryAgainInSeconds =
					(retryAfter || ratelimitReset) ?? attempts * 5
				await sleep(tryAgainInSeconds * 1000)
				continue
			}

			// On any other error, throw it
			if (!response.ok) {
				throw response
			}

			return response.json()
		}
	}

	private async get(key: string, url: string | URL) {
		return this.request(key, url, "GET")
	}

	private async post(key: string, url: string | URL, body: object) {
		return this.request(key, url, "POST", body)
	}

	async getUniverseDetails(universeIds: number[]): Promise<Universe[]> {
		const url = new URL(`${GAMES_API}/v1/games`)
		for (const universeId of universeIds) {
			url.searchParams.append("universeIds", universeId.toString())
		}
		const json = await this.get(`${GAMES_API}/v1/games`, url)
		return json["data"]
	}

	async getUniverseIdFromPlaceId(
		placeId: number
	): Promise<number | undefined> {
		const json = await this.get(
			"https://apis.roblox.com/universes/v1/places/[placeid]/universe",
			`https://apis.roblox.com/universes/v1/places/${placeId}/universe`
		)
		return json["universeId"]
	}

	private async getBadgePage(
		universeId: number,
		pageCursor?: string
	): Promise<{ data: Badge[]; nextPageCursor?: string }> {
		const url = new URL(`${BADGES_API}/v1/universes/${universeId}/badges`)
		url.searchParams.append("limit", "100")
		if (pageCursor) {
			url.searchParams.append("cursor", pageCursor)
		}

		return this.get(`${BADGES_API}/v1/universes/[id]/badges`, url)
	}

	async getBadges(universeId: number): Promise<Badge[]> {
		const badges = []

		let pageCursor = undefined
		while (true) {
			const page = await this.getBadgePage(universeId, pageCursor)
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

	async getBadge(badgeId: number): Promise<Badge> {
		return this.get(
			`${BADGES_API}/v1/badges/[id]`,
			`${BADGES_API}/v1/badges/${badgeId}`
		)
	}

	async getBadgeIcons(badgeIds: number[]): Promise<Record<number, string>> {
		const url = new URL(`${THUMBNAILS_API}/v1/badges/icons`)
		url.searchParams.append("size", "150x150")
		url.searchParams.append("format", "Png")
		for (const badgeId of badgeIds) {
			url.searchParams.append("badgeIds", badgeId.toString())
		}
		const result: { data: { targetId: number; imageUrl: string }[] } =
			await this.get(`${THUMBNAILS_API}/v1/badges/icons`, url)

		const mapping: Record<number, string> = {}

		for (const item of result.data) {
			mapping[item.targetId] = item.imageUrl
		}

		return mapping
	}
	async getUniverseIcons(
		universeIds: number[]
	): Promise<Record<number, string>> {
		const url = new URL(`${THUMBNAILS_API}/v1/games/icons`)
		url.searchParams.append("size", "512x512")
		url.searchParams.append("format", "Png")
		for (const universeId of universeIds) {
			url.searchParams.append("universeIds", universeId.toString())
		}
		const result: { data: { targetId: number; imageUrl: string }[] } =
			await this.get(`${THUMBNAILS_API}/v1/games/icons`, url)

		const mapping: Record<number, string> = {}

		for (const item of result.data) {
			mapping[item.targetId] = item.imageUrl
		}

		return mapping
	}
}

const API = new APIClient(Config.API_KEY)
export default API
