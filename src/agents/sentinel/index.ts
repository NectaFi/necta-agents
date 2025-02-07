import { generateText } from 'ai'
import type { EventBus } from '../../comms'
import { Agent } from '../agent'
import { openai } from '@ai-sdk/openai'
import { getSentinelSystemPrompt } from '../../system-prompts'
import type { Hex } from 'viem'
import { getSentinelToolkit } from './toolkit'
import { saveThought } from '../../memory'
import env from '../../env'

const SENTINEL_STARTING_PROMPT =
	'Based on the current market data and the tokens that you hold, generate a report explaining what steps could be taken.'

/**
 * @dev The sentinel agent is responsible for generating a report about the best opportunities to make money.
 */
export class SentinelAgent extends Agent {
	address?: Hex

	/**
	 * @param name - The name of the agent
	 * @param eventBus - The event bus to emit events to other agents
	 */
	constructor(name: string, eventBus: EventBus) {
		super(name, eventBus)
	}

	/**
	 * @param event - The event to handle
	 * @param data - The data to handle
	 */
	async handleEvent(event: string, data: any): Promise<void> {
		switch (event) {
			case `curator-${this.name}`:
				return this.handleCuratorEvent(data)
		}
	}

	/**
	 * @param data - The data to handle
	 */
	private async handleCuratorEvent(data: any): Promise<void> {
		if (data) {
			console.log(`[${this.name}] received message from curator: ${data.result}`)
		}

		await this.start(this.address!, data)
	}

	/**
	 * @dev Starts the sentinel agent
	 * @param address - The address of the account to observe
	 * @param curatorData - The data from the curator agent
	 */
	async start(address: Hex, curatorData?: any): Promise<any> {
		this.address = address

		const toolkit = getSentinelToolkit(address)

		if (!curatorData) {
			const response = await generateText({
				model: openai(env.MODEL_NAME),
				system: getSentinelSystemPrompt(address),
				prompt: SENTINEL_STARTING_PROMPT,
				tools: toolkit,
				maxSteps: 100,
				onStepFinish: this.onStepFinish,
			})

			this.eventBus.emit(`${this.name}-curator`, {
				report: response.text,
			})
		} else {
			const response = await generateText({
				model: openai(env.MODEL_NAME),
				system: getSentinelSystemPrompt(address),
				messages: [
					{
						role: 'assistant',
						content: curatorData.report,
					},
					{
						role: 'user',
						content: `This is the feedback from the curator agent:
            ${curatorData.result}`,
					},
				],
				tools: toolkit,
				maxSteps: 100,
				onStepFinish: this.onStepFinish,
			})

			if (response.toolCalls.length > 0) {
				const noFurtherActionsTool = response.toolCalls.find(
					(tool: any) => tool.toolName === 'noFurtherActionsTool'
				)
				if (noFurtherActionsTool) {
					this.eventBus.emit(`${this.name}-curator`, {
						noFurtherActions: true,
						// @ts-ignore
						waitTime: noFurtherActionsTool.args.waitTime * 1000,
					})
				}
			} else {
				this.eventBus.emit(`${this.name}-curator`, {
					report: response.text,
				})
			}
		}
	}

	/**
	 * @param data - The data to handle
	 */
	async onStepFinish({ text, toolCalls, toolResults }: any) {
		console.log(
			`[sentinel] step finished. tools called: ${
				toolCalls.length > 0
					? toolCalls.map((tool: any) => tool.toolName).join(', ')
					: 'none'
			}`
		)
		if (text) {
			await saveThought({
				agent: 'sentinel',
				text,
				toolCalls,
				toolResults,
			})
		}
	}
}
