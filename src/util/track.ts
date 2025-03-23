import { Badge, getBadgeIcons } from "./api"
import { getImageColor } from "./color"
import { getStored } from "./store"

export async function updatedTrackedBadges(
	badges: Badge[],
	maxAwarded: number
) {
	const stored = await getStored()
	// Only track badges that are new or meet the maxAwarded count
	// maxAwarded < 0 means no requirement for awarded
	const toTrack = badges.filter(
		(badge) =>
			!stored.badgeData[badge.id] &&
			(maxAwarded < 0 || badge.statistics.awardedCount <= maxAwarded)
	)

	if (toTrack.length === 0) {
		return []
	}

	const badgeIcons = await getBadgeIcons(toTrack.map((badge) => badge.id))
	for (let i = 0; i < toTrack.length; i++) {
		const badge = toTrack[i]
		const imageUrl = badgeIcons[i].imageUrl
		const imageColor = await getImageColor(imageUrl)
		stored.badgeData[badge.id] = {
			imageUrl,
			imageColor,
			...badge,
		}
	}

	return toTrack
}
