import { tool } from 'ai'
import { z } from 'zod'

export const getCuratorToolkit = () => {
	return {
		sendMessageToSentinel: tool({
			description: 'use this tool when you want to send a message to the sentinel.',
			parameters: z.object({
				message: z.string(),
			}),
		}),
		sendMessageToExecutor: tool({
			description: 'use this tool when you want to send a message to the executor.',
			parameters: z.object({
				message: z.string(),
			}),
		}),
	}
}
