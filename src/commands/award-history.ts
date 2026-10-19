import {
	AttachmentBuilder,
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js"
import { BadgeData, getStored } from "../util/store"
import { Canvas } from "skia-canvas"
import {
	CategoryScale,
	Chart,
	ChartItem,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Title,
} from "chart.js"
import { getHexColor } from "../util/color"
import { autocompleteBadge } from "../util/autocomplete"

Chart.register(
	CategoryScale,
	LineController,
	LineElement,
	LinearScale,
	PointElement,
	Title,
	Legend
)

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 450
const TITLE_FONT_SIZE = 30
const LEGEND_FONT_SIZE = 12
const LINE_WIDTH = 3

const timeOnly = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
	timeZone: "UTC",
})

const timeAndDate = new Intl.DateTimeFormat("en-US", {
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "UTC",
})

export const data = new SlashCommandBuilder()
	.setName("award-history")
	.setDescription(
		"Shows the award history of all badges or a specified badge"
	)
	.addStringOption((option) =>
		option
			.setName("link")
			.setDescription("The id or link to the badge")
			.setRequired(false)
			.setAutocomplete(true)
	)

async function renderChart(badges: BadgeData[]) {
	badges = badges.filter((badge) => badge.awardHistory.length >= 2)
	const minTime = badges.reduce(
		(prev, curr) => Math.min(curr.awardHistory[0][0], prev),
		Infinity
	)
	const maxTime = badges.reduce(
		(prev, curr) =>
			Math.max(curr.awardHistory[curr.awardHistory.length - 1][0], prev),
		-Infinity
	)
	const minAwarded = badges.reduce(
		(prev, curr) => Math.min(curr.awardHistory[0][1], prev),
		Infinity
	)
	const overDay = maxTime - minTime >= 24 * 60 * 60 * 1000

	const canvas = new Canvas(CANVAS_WIDTH, CANVAS_HEIGHT)
	const chart = new Chart(
		canvas as unknown as ChartItem, // TypeScript needs "as any" here
		{
			type: "line",
			data: {
				datasets: badges.map(({ name, awardHistory, color }) => ({
					label: name,
					data: awardHistory.slice(1), // ignore first point
					borderColor: getHexColor(color),
					backgroundColor: getHexColor(color),
					borderWidth: LINE_WIDTH,
					borderJoinStyle: "round",
					borderCapStyle: "round",
					pointRadius: awardHistory.length <= 2 ? LINE_WIDTH + 1 : 0,
				})),
			},
			options: {
				layout: {
					padding: {
						right: 35,
					},
				},
				plugins: {
					title: {
						display: true,
						text: `Awarded over Time`,
						font: { size: TITLE_FONT_SIZE, weight: "bold" },
					},
					legend: {
						display: true,
						position: "bottom",
						labels: {
							font: { size: LEGEND_FONT_SIZE },
							boxHeight: LEGEND_FONT_SIZE,
							boxWidth: LEGEND_FONT_SIZE,
						},
					},
				},
				scales: {
					x: {
						title: {
							display: true,
							text: "Time (UTC)",
						},
						type: "linear",
						bounds: "data",
						ticks: {
							maxTicksLimit: 8,
							callback: (v) =>
								(overDay ? timeAndDate : timeOnly).format(
									Number(v)
								),
						},
					},
					y: {
						title: {
							display: true,
							text: "Awarded",
						},
						min: minAwarded,
						bounds: "data",
					},
				},
			},
		}
	)
	const pngBuffer = await canvas.toBuffer("png", { matte: "white" })

	chart.destroy()

	return pngBuffer
}

export async function execute(interaction: ChatInputCommandInteraction) {
	const link = interaction.options.getString("link", false)
	const stored = await getStored()
	let badges = Object.values(stored.trackingBadges)
	if (link) {
		const match = link.match(/(\d+)/)

		if (!match) {
			return await interaction.reply("Invalid link!")
		}

		const id = parseInt(match[0])
		const badge = stored.trackingBadges[id]
		if (!badge) {
			return await interaction.reply("Not tracking that badge!")
		}

		badges = [badge]
	}

	await interaction.deferReply()

	const pngBuffer = await renderChart(badges)
	const attachment = new AttachmentBuilder(pngBuffer).setName(
		`${new Date()}${badges.length === 1 ? `-${badges[0].id}` : ""}-award-history.png`
	)
	interaction.editReply({ files: [attachment] })
}

export async function autocomplete(interaction: AutocompleteInteraction) {
	const search = interaction.options.getFocused()
	interaction.respond(await autocompleteBadge(search))
}
