export function sleep(ms: number) {
	return new Promise((res) => setTimeout(res, ms > 0 ? ms : 0))
}
