import { ColorResolvable } from "discord.js"
import sharp from "sharp"

const adjustSaturation = (
	r: number,
	g: number,
	b: number,
	saturationFactor: number
): ColorResolvable => {
	// Calculate grayscale using weighted average (luminosity)
	const gray = 0.2989 * r + 0.587 * g + 0.114 * b

	// Calculate the difference from the grayscale value
	const dr = r - gray
	const dg = g - gray
	const db = b - gray

	// Apply the saturation factor to increase/decrease the difference
	const newR = gray + dr * saturationFactor
	const newG = gray + dg * saturationFactor
	const newB = gray + db * saturationFactor

	// Ensure that the RGB values are within the valid range [0, 255]
	return [
		Math.min(255, Math.max(0, Math.round(newR))),
		Math.min(255, Math.max(0, Math.round(newG))),
		Math.min(255, Math.max(0, Math.round(newB))),
	]
}

export async function getImageColor(
	imageUrl: string
): Promise<ColorResolvable> {
	const response = await fetch(imageUrl)
	const buffer = await response.arrayBuffer()

	const image = sharp(buffer)
	const { data } = await image
		.resize(1, 1)
		.raw()
		.toBuffer({ resolveWithObject: true })

	const [r, g, b] = data
	return adjustSaturation(r, g, b, 3)
}
