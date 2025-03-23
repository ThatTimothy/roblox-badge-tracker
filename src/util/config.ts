import "dotenv/config"

export function requireEnv(key: string) {
	const value = process.env[key]

	if (!value) {
		throw new Error(`Missing require env variable "${key}"`)
	}

	return value
}

const Config = {
	ROBLOSECURITY: requireEnv("ROBLOSECURITY"),
	BOT_TOKEN: requireEnv("BOT_TOKEN"),

	CLIENT_ID: requireEnv("CLIENT_ID"),
	GUILD_ID: requireEnv("GUILD_ID"),

	STORE_FILE: "store.json",

	MAX_AWARDED_TO_TRACK: 100,
	BADGE_TRACKS_PER_GAME_TRACK: 5,
	CHECK_INTERVAL_MS: 2 * 1000,
	STORE_INTERVAL_MS: 5 * 60 * 1000,
}

export default Config
