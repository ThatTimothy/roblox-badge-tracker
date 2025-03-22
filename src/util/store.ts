import { readFile, writeFile } from "fs/promises"
import Config from "../util/config"

interface Stored {
	lastLogin: number
	logChannel?: string
	statusChannel?: string
	tracking: Record<string, number>
	badgeAwardData: Record<number, number>
}

let loaded: Stored | null = null

async function retrieve(): Promise<Stored> {
	const file = await readFile(Config.STORE_FILE)
	const json = JSON.parse(file.toString())

	if (!json.tracking) {
		json.tracking = {}
	}
	if (!json.badgeAwardData) {
		json.badgeAwardData = {}
	}

	return json
}

let isSaving = false
export async function store() {
	if (!loaded || isSaving) return
	isSaving = true
	console.log("Saving store...")
	await writeFile(Config.STORE_FILE, JSON.stringify(loaded, null, 4))
	console.log("Saved store.")
	isSaving = false
}

export async function getStored(): Promise<Stored> {
	if (!loaded) loaded = await retrieve()
	return loaded
}
