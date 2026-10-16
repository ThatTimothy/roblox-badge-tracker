import { readFile, writeFile } from "fs/promises"
import Config from "../util/config"
import { Badge, Universe } from "./api"
import logger from "./log"
import { RGB } from "./color"

interface Theme {
	color: RGB
	imageUrl: string
	previousImageUrl?: string
}
export type BadgeData = Badge & Theme & { awardHistory: [number, number][] }
export type GameData = Universe &
	Theme & { lastChecked: number; existingBadges: number[] }
interface Stored {
	lastLogout?: number
	logChannel?: string
	trackingGames: Record<number, GameData>
	trackingBadges: Record<number, BadgeData>
}

let loaded: Stored | null = null

async function retrieve(): Promise<Stored> {
	try {
		const file = await readFile(Config.STORE_FILE)
		return JSON.parse(file.toString())
	} catch (e) {
		if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
			return {
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
