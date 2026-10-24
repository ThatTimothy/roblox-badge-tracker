import { readFile, writeFile } from "fs/promises"
import Config from "../util/config"
import { Badge, Universe } from "./api"
import logger from "./log"
import { RGB } from "./color"
import { Snowflake } from "discord.js"

interface Theme {
	color: RGB
	imageUrl: string
}
export type BadgeData = Badge &
	Theme & { awardHistory: [number, number][]; previous?: Partial<BadgeData> }
export type GameData = Universe &
	Theme & {
		lastChecked: number
		existingBadges: number[]
		previous?: Partial<GameData>
		previousImageUrls?: { url: string; expiry: number }[]
	}
export type StoredNotificationList = {
	users: Snowflake[]
	roles: Snowflake[]
}
export type StoredNotification = keyof Stored["notifications"]
export interface Stored {
	lastLogout?: number
	channels: {
		logChannel?: Snowflake
	}
	notifications: {
		firstAward?: StoredNotificationList
		update?: StoredNotificationList
		newBadge?: StoredNotificationList
	}
	trackingGames: Record<number, GameData>
	trackingBadges: Record<number, BadgeData>
}

let loaded: Stored | null = null
let dev: boolean = false

export async function initializeStored(initDev: boolean): Promise<Stored> {
	if (loaded) {
		throw new Error("Already initialized, can only initialize once!")
	}

	dev = initDev

	try {
		const file = await readFile(Config.STORE_FILE)
		loaded = JSON.parse(file.toString()) as Stored
		return loaded
	} catch (e) {
		if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
			loaded = {
				channels: {},
				notifications: {},
				trackingGames: {},
				trackingBadges: {},
			}
			return loaded
		}

		logger.error(`Failed to read "${Config.STORE_FILE}": ${e}`)
		process.exit(1)
	}
}

let isSaving = false
export async function store() {
	if (!loaded || isSaving) return
	isSaving = true
	logger.log("Saving store...")
	await writeFile(
		Config.STORE_FILE,
		JSON.stringify(loaded, null, dev ? 4 : 0)
	)
	logger.success("Saved store")
	isSaving = false
}

export function getStored(): Stored {
	if (!loaded) {
		throw new Error("Stored must be initialized first")
	}
	return loaded
}
