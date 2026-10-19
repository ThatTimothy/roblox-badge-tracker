import { readFile, writeFile } from "fs/promises"
import Config from "../util/config"
import { Badge, Universe } from "./api"
import logger from "./log"
import { RGB } from "./color"
import { Snowflake } from "discord.js"

interface Theme {
	color: RGB
	imageUrl: string
	previousImageUrl?: string
}
export type BadgeData = Badge & Theme & { awardHistory: [number, number][] }
export type GameData = Universe &
	Theme & { lastChecked: number; existingBadges: number[] }
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

async function retrieve(): Promise<Stored> {
	try {
		const file = await readFile(Config.STORE_FILE)
		return JSON.parse(file.toString()) as Stored
	} catch (e) {
		if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
			return {
				channels: {},
				notifications: {},
				trackingGames: {},
				trackingBadges: {},
			}
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
	await writeFile(Config.STORE_FILE, JSON.stringify(loaded, null, 4))
	logger.success("Saved store")
	isSaving = false
}

export async function getStored(): Promise<Stored> {
	if (!loaded) loaded = await retrieve()
	return loaded
}
