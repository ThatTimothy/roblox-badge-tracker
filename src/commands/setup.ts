import {
	ActionRowBuilder,
	BaseMessageOptionsWithPoll,
	ButtonBuilder,
	ButtonStyle,
	channelMention,
	ChannelSelectMenuBuilder,
	ChannelType,
	ChatInputCommandInteraction,
	inlineCode,
	MentionableSelectMenuBuilder,
	MessageFlags,
	PermissionFlagsBits,
	roleMention,
	SelectMenuDefaultValueType,
	SlashCommandBuilder,
	SlashCommandChannelOption,
	SlashCommandMentionableOption,
	userMention,
} from "discord.js"
import { getStored, Stored } from "../util/store"

const BASE_CONFIG_MENU =
	"# Configuration\nThe dropdowns below will instantly update the configuration\n"

export const configuration: ({
	command: string
	name: string
	description: string
} & (
	| {
			configKey: keyof Stored["channels"]
			type: "channel"
	  }
	| {
			configKey: keyof Stored["notifications"]
			type: "mentionable"
	  }
))[] = [
	{
		command: "log-channel",
		configKey: "logChannel",
		type: "channel",
		name: "Log Channel",
		description: "The channel to log updates in",
	},
	{
		command: "first-award-notification",
		type: "mentionable",
		configKey: "firstAward",
		name: "First Award Notification",
		description:
			"The users/roles mentioned when a tracked badge receives its first award",
	},
	{
		command: "update-notification",
		configKey: "update",
		type: "mentionable",
		name: "Update Notification",
		description:
			"The users/roles mentioned when a tracked game or badge is updated",
	},
	{
		command: "new-badge-notification",
		configKey: "newBadge",
		type: "mentionable",
		name: "New Badge Notification",
		description:
			"The users/roles mentioned when a tracked game has a new badge added",
	},
]

export const data = new SlashCommandBuilder()
	.setName("setup")
	.setDescription("Configure log channel & notifications")
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

for (const config of configuration) {
	if (config.type === "channel") {
		data.addChannelOption(
			new SlashCommandChannelOption()
				.setName(config.command)
				.setDescription(config.description)
				.addChannelTypes(ChannelType.GuildText)
		)
	} else if (config.type === "mentionable") {
		data.addMentionableOption(
			new SlashCommandMentionableOption()
				.setName(config.command)
				.setDescription(config.description)
		)
	}
}

export async function getMessage(
	index: number
): Promise<BaseMessageOptionsWithPoll> {
	const stored = await getStored()

	const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
		new ButtonBuilder()
			.setCustomId(`setup:${index - 1}`)
			.setLabel("Previous")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(index <= 0),
	])

	if (index < configuration.length) {
		buttonRow.addComponents(
			index == configuration.length - 1
				? new ButtonBuilder()
						.setCustomId(`setup:${index + 1}`)
						.setLabel("Review")
						.setStyle(ButtonStyle.Success)
				: new ButtonBuilder()
						.setCustomId(`setup:${index + 1}`)
						.setLabel("Next")
						.setStyle(ButtonStyle.Primary)
		)
	}

	if (index < configuration.length) {
		const config = configuration[index]
		const selectRow = new ActionRowBuilder<
			ChannelSelectMenuBuilder | MentionableSelectMenuBuilder
		>()

		if (config.type === "channel") {
			const storedChannel = stored.channels[config.configKey]
			const channelSelect = new ChannelSelectMenuBuilder()
				.setCustomId(`setup:${config.configKey}`)
				.setChannelTypes(ChannelType.GuildText)
				.setPlaceholder("Select the channel")

			if (storedChannel) {
				channelSelect.setDefaultChannels(storedChannel)
			}

			selectRow.addComponents(channelSelect)
		} else if (config.type === "mentionable") {
			const storedNotification = stored.notifications[config.configKey]
			const mentionSelect = new MentionableSelectMenuBuilder()
				.setCustomId(`setup:${config.configKey}`)
				.setPlaceholder("Select the users/roles")
				.setMinValues(0)
				.setMaxValues(10)

			if (
				storedNotification &&
				(storedNotification.roles || storedNotification.users)
			) {
				mentionSelect.setDefaultValues([
					...storedNotification.users.map((id) => ({
						id,
						type: SelectMenuDefaultValueType.User as const,
					})),
					...storedNotification.roles.map((id) => ({
						id,
						type: SelectMenuDefaultValueType.Role as const,
					})),
				])
			}

			selectRow.addComponents(mentionSelect)
		}

		return {
			content:
				BASE_CONFIG_MENU + `## ${config.name}\n${config.description}`,
			components: [selectRow, buttonRow],
		}
	} else {
		const review = configuration
			.map((config) => {
				let value = ""
				if (config.type === "channel") {
					const storedChannel = stored.channels[config.configKey]
					value = storedChannel
						? channelMention(storedChannel)
						: inlineCode("Unset")
				} else if (config.type === "mentionable") {
					const storedNotification =
						stored.notifications[config.configKey]
					value = storedNotification
						? [
								...storedNotification.users.map(userMention),
								...storedNotification.roles.map(roleMention),
							].join(" ")
						: inlineCode("Unset")
				}
				return `## ${config.name}\n${config.description}\n${value}`
			})
			.join("\n")
		return {
			content: `# Configuration Complete\nTo change, run ${inlineCode("/setup")} again or navigate backwards\n${review}`,
			allowedMentions: { parse: [] }, // disable mentions
			components: [buttonRow],
		}
	}
}

export async function execute(interaction: ChatInputCommandInteraction) {
	const stored = await getStored()

	// Handle option args passed - if any passed we save & skip to review
	let optionPassed = false
	for (const config of configuration) {
		if (config.type === "channel") {
			const channel = interaction.options.getChannel(
				config.command,
				false,
				[ChannelType.GuildText]
			)
			if (channel) {
				optionPassed = true
				stored.channels[config.configKey] = channel.id
			}
		} else if (config.type === "mentionable") {
			const mention = interaction.options.get(config.command, false)
			if (mention) {
				optionPassed = true
				if (mention.role) {
					stored.notifications[config.configKey] = {
						users: [],
						roles: [mention.role.id],
					}
				} else if (mention.user) {
					stored.notifications[config.configKey] = {
						users: [mention.user.id],
						roles: [],
					}
				}
			}
		}
	}

	const message = await getMessage(optionPassed ? configuration.length : 0)
	await interaction.reply({
		...message,
		flags: MessageFlags.Ephemeral,
	})
}
