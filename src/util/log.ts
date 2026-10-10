import { stderr } from "process"
import { format, styleText } from "util"

class Logger {
	log(...args: unknown[]) {
		console.log(...args)
	}

	success(...args: unknown[]) {
		console.log(styleText("green", format(...args)))
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
