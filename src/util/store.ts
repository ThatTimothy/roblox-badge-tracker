import { readFile, writeFile } from "fs/promises"
import Config from "../util/config"
import { Badge, Place } from "./api"
import { ColorResolvable } from "discord.js"

export type ImageData = { imageColor: ColorResolvable; imageUrl: string }
export type BadgeData = Badge & ImageData
export type PlaceData = Place & ImageData & { maxAwarded: number }
interface Stored {
	lastLogin?: number
	logChannel?: string
	statusChannel?: string
	trackingGames: Record<number, PlaceData>
	badgeData: Record<number, BadgeData>
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
				badgeData: {},
			}
		}

		console.error(`Failed to read "${Config.STORE_FILE}": ${e}`)
		process.exit(1)
	}
}

let isSaving = false
export async function store() {
	if (!loaded || isSaving) return
	isSaving = true
	console.log("Saving store...")
	await writeFile(Config.STORE_FILE, JSON.stringify(loaded, null, 4))
	console.log("Saved store")
	isSaving = false
}

export async function getStored(): Promise<Stored> {
	if (!loaded) loaded = await retrieve()
	return loaded
}
