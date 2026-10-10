import { readFile, writeFile } from "fs/promises"
import Config from "../util/config"
import { Badge, Universe } from "./api"
import { ColorResolvable } from "discord.js"
import logger from "./log"

interface Theme {
	color: ColorResolvable
	imageUrl: string
}
export type BadgeData = Badge & Theme
export type GameData = Universe &
	Theme & {
		maxAwarded: number
	}
interface Stored {
	lastLogin?: number
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
