/**
 * Generic polling function that continues until a condition is met
 */
export async function poll<T>(
	fn: () => Promise<T>,
	condition: (result: T) => boolean,
	interval: number,
	maxAttempts = 10
): Promise<T> {
	let attempts = 0

	while (attempts < maxAttempts) {
		const result = await fn()
		if (!condition(result)) {
			return result
		}

		await new Promise((resolve) => setTimeout(resolve, interval))
		attempts++
	}

	throw new Error('Polling timed out')
}
