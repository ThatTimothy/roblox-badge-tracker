import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Client,
	ComponentType,
	EmbedBuilder,
	Events,
	GatewayIntentBits,
	MessageActionRowComponentBuilder,
	MessageFlags,
	SendableChannels,
} from "discord.js"
import Config from "./util/config"
import { getStored, store } from "./util/store"
import { readCommands } from "./util/commands"
import { getBadge } from "./util/api"

const client = new Client({
	intents: [GatewayIntentBits.GuildMessages],
})

async function getLogChannel(): Promise<SendableChannels | undefined> {
	const stored = await getStored()
	if (!stored.logChannel) return
	const channel = await client.channels.fetch(stored.logChannel)
	if (!channel) return
	if (!channel.isSendable()) return
	return channel
}

async function fetchBadge(id: number) {
	console.log(`Fetching ${id} (${queue.length} left in queue)`)
	const badge = await getBadge(id)

	const stored = await getStored()
	const previous = stored.badgeData[id]
	const previousAwarded = previous.statistics.awardedCount
	const nowAwarded = badge.statistics.awardedCount
	if (nowAwarded > previousAwarded) {
		stored.badgeData[id] = {
			...previous,
			...badge,
		}
		console.log(`Updated ${id}`)
		const channel = await getLogChannel()
		if (channel) {
			await channel.send({
				embeds: [
					new EmbedBuilder()
						.setTitle(badge.name)
						.setURL(`https://roblox.com/badges/${badge.id}`)
						.setDescription(
							`in [**${badge.awardingUniverse.name}**](https://roblox.com/games/${badge.awardingUniverse.rootPlaceId})`
						)
						.setThumbnail(previous.imageUrl)
						.setColor(previous.imageColor)
						.addFields([
							{
								name: "Awarded",
								value: `${previousAwarded} → ${nowAwarded} (+${nowAwarded - previousAwarded})`,
							},
						]),
				],
			})
			console.log(`Logged ${id}`)
		}
	} else {
		console.log(`No updates for ${id}`)
	}
}

let queue: number[] = []
async function track() {
	const stored = await getStored()

	if (queue.length === 0) {
		queue = Object.values(stored.badgeData).map((badge) => badge.id)
	}

	const id = queue.pop()
	if (id) {
		await fetchBadge(id)
	}

	setTimeout(track, Config.CHECK_INTERVAL_MS)
}

client.once(Events.ClientReady, async (_readyClient) => {
	console.log("Successfully logged in!")
	const stored = await getStored()
	stored.lastLogin = Date.now()

	if (stored.logChannel) {
		client.channels.fetch(stored.logChannel)
	}

	let running = true
	async function shutdown() {
		if (!running) return
		running = false

		await store()

		process.exit(0)
	}

	process.once("SIGINT", shutdown)
	process.once("SIGTERM", shutdown)
	process.once("SIGQUIT", shutdown)

	const commands = await readCommands()
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isChatInputCommand()) return

		const command = commands[interaction.commandName]

		if (!command) {
			console.error(
				`No command matching ${interaction.commandName} was found.`
			)
			return
		}

		try {
			await command.execute(interaction)
		} catch (error) {
			console.error(error)
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: "There was an error while executing this command!",
					flags: MessageFlags.Ephemeral,
				})
			} else {
				await interaction.reply({
					content: "There was an error while executing this command!",
					flags: MessageFlags.Ephemeral,
				})
			}
		}
	})

	// Tracking
	track()
})

client.login(Config.BOT_TOKEN)
