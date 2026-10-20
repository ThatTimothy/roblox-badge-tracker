import "dotenv/config"

export function requireEnv(key: string) {
	const value = process.env[key]

	if (!value) {
		throw new Error(`Missing require env variable "${key}"`)
	}

	return value
}

const Config = {
	API_KEY: requireEnv("API_KEY"),
	BOT_TOKEN: requireEnv("BOT_TOKEN"),

	CLIENT_ID: requireEnv("CLIENT_ID"),
	GUILD_ID: requireEnv("GUILD_ID"),

	STORE_FILE: "store.json",

	MAX_AWARDED_TO_TRACK: 100,
	STORE_INTERVAL_MS: 5 * 60 * 1000,

	/* Don't mess with stuff below this unless you have read the code using them - these are fine tuned for ideal running */

	// The time for a previous game image url to expire (become able to cause an update again)
	GAME_IMAGE_URL_EXPIRY_MS: 5 * 60 * 1000,

	// The time interval for fetching a single badge, including request time
	// Single badge fetch endpoint allows 600 PER minute
	BADGE_FETCH_INTERVAL_MS: (60 / 600) * 1000,
	// The time interval for a full badge loop
	// getBadgeIcons is 100 per minute and the rest is covered by BADGE_FETCH_INTERVAL_MS, so 100 per minute
	BADGE_LOOP_INTERVAL_MS: (60 / 100) * 1000,
	// The time interval for checking for new badges
	// getBadges is 100 per minute
	GAME_CHECK_NEW_BADGES_INTERVAL_MS: (60 / 100) * 1000,
	// The time interval for a full game loop
	// getUniverseDetails is 300 per minute + getUniverseIcons is 1200 per minute and rest is covered by GAME_CHECK_NEW_BADGES_INTERVAL_MS, so 300 per minute
	GAME_LOOP_INTERVAL_MS: (60 / 300) * 1000,
}

export default Config
