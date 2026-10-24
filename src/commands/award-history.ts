import {
	ActionRowBuilder,
	AttachmentBuilder,
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	MessageFlags,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
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
	.addBooleanOption((option) =>
		option
			.setName("raw")
			.setDescription(
				"Includes the raw .csv of award history - only works with specific link"
			)
			.setRequired(false)
	)

function badgeHasHistory(badge: BadgeData) {
	return badge.awardHistory.length >= 2
}

export async function renderChartToAttachment(badges: BadgeData[]) {
	badges = badges.filter(badgeHasHistory)
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

	return new AttachmentBuilder(pngBuffer).setName(
		`${new Date().toString()}${badges.length === 1 ? `-${badges[0].id}` : ""}-award-history.png`
	)
}

export function buildComponents(
	badges: BadgeData[],
	selected: Set<number>,
	all: boolean
) {
	badges = badges.filter(badgeHasHistory)
	// All, then selected, then anything else we can fit
	const options = [
		new StringSelectMenuOptionBuilder()
			.setValue("all")
			.setLabel("All Badges")
			.setDescription("Show all badges")
			.setDefault(all),
		...[
			...badges.filter((badge) => selected.has(badge.id)),
			...badges.filter((badge) => !selected.has(badge.id)),
		].map((badge) =>
			new StringSelectMenuOptionBuilder()
				.setValue(badge.id.toString())
				.setLabel(badge.name)
				.setDescription(`in ${badge.awardingUniverse.name}`)
				.setDefault(!all && selected.has(badge.id))
		),
	].slice(0, 25)
	// Discord limits dropdowns to 25 options (we can fit 24), so if more than 24 we can't support it
	if (badges.length > 24) {
		options.pop()
		options.push(
			new StringSelectMenuOptionBuilder()
				.setValue("-1")
				.setLabel(
					"More than 25 tracked badges - only showing first 24 tracked"
				)
				.setDescription(
					"This is a discord limitation - you can always run /award-history to select any specific badge"
				)
		)
	}
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("award-history")
		.setPlaceholder("Filter to these badges...")
		.addOptions(options)
		.setMinValues(1)
		.setMaxValues(options.length)

	return [
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			selectMenu
		),
	]
}

export async function execute(interaction: ChatInputCommandInteraction) {
	const link = interaction.options.getString("link", false)
	const raw = interaction.options.get("raw", false)
	const stored = getStored()
	const ephemeral = interaction.channelId === stored.channels.logChannel
	const flags = ephemeral ? MessageFlags.Ephemeral : undefined
	const badges = Object.values(stored.trackingBadges)
	const selected = new Set(badges.map((badge) => badge.id))
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

		selected.clear()
		selected.add(id)
	}

	await interaction.deferReply({ flags })

	const attachment = await renderChartToAttachment(
		badges.filter((badge) => selected.has(badge.id))
	)
	const components = buildComponents(badges, selected, link === null)

	const files = [attachment]
	if (raw && link) {
		const headers = ["Unix Time (ms)", "Awarded"]
		const badge = badges.find((badge) => selected.has(badge.id))
		if (badge) {
			const csvString = [
				headers.join(","),
				...badge.awardHistory.map((item) => item.join(",")),
			].join("\n")
			const csv = new AttachmentBuilder(Buffer.from(csvString, "utf-8"), {
				name: `${badge.id}-award-history.csv`,
			})
			files.push(csv)
		}
	}

	await interaction.editReply({ components, files })
}

export async function autocomplete(interaction: AutocompleteInteraction) {
	const search = interaction.options.getFocused()
	await interaction.respond(autocompleteBadge(search, badgeHasHistory))
}
