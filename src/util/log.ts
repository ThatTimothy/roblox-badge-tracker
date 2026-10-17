import { Client, SendableChannels } from "discord.js"
import { stderr } from "process"
import { format, styleText } from "util"
import { getStored } from "./store"

class Logger {
	log(...args: unknown[]) {
		console.log(...args)
	}

	success(...args: unknown[]) {
		console.log(styleText("green", format(...args)))
	}

	warn(...args: unknown[]) {
		console.log(styleText("yellow", format(...args)))
	}

	error(...args: unknown[]) {
		console.error(styleText("red", format(...args), { stream: stderr }))
	}

	logGame(...args: unknown[]) {
		console.log(styleText("magenta", "Game  | " + format(...args)))
	}

	logBadge(...args: unknown[]) {
		console.log(styleText("cyanBright", "Badge | " + format(...args)))
	}
}

const logger = new Logger()
export default logger

export async function getLogChannel(
	client: Client
): Promise<SendableChannels | undefined> {
	const stored = await getStored()
	if (!stored.channels.logChannel) return
	const channel = await client.channels.fetch(stored.channels.logChannel)
	if (!channel) return
	if (!channel.isSendable()) return
	return channel
}
