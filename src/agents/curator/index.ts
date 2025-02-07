import { generateText } from 'ai'
import type { EventBus } from '../../comms'
import { getCuratorFinalReportSystemPrompt, getCuratorSystemPrompt } from '../../system-prompts'
import { Agent } from '../agent'
import { openai } from '@ai-sdk/openai'
import { getCuratorToolkit } from './toolkit'
import { saveThought, storeReport } from '../../memory'
import env from '../../env'

/**
 * @dev The curator agent is responsible for generating tasks to be executed.
 */
export class CuratorAgent extends Agent {
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
		console.log(`[${this.name}] received data from [${event.split('-')[0]}].`)
		switch (event) {
			case `sentinel-${this.name}`:
				return this.handleSentinelReport(data)
			case `executor-${this.name}`:
				return this.handleExecutorResult(data)
		}
	}

	/**
	 * @dev Handles the sentinel report
	 * @param data - The data to handle
	 */
	private async handleSentinelReport(data: {
		report: string
		noFurtherActions?: boolean
		waitTime?: number
	}): Promise<void> {
		data.report &&
			console.log(
				`[${this.name}] received a report from the sentinel agent:\n\n${data.report}.`
			)

		const toolkit = getCuratorToolkit()

		if (data.noFurtherActions && data.waitTime) {
			console.log(
				`[${this.name}] no further actions needed. waiting for ${
					data.waitTime / 1000
				} seconds.`
			)
			// sleep for the waitTime
			await new Promise((resolve) => setTimeout(resolve, data.waitTime))

			// ask the sentinel agent for a new report
			this.eventBus.emit(`${this.name}-sentinel`, undefined)

			return
		}

		const { toolCalls } = await generateText({
			model: openai(env.MODEL_NAME, { structuredOutputs: true }),
			system: getCuratorSystemPrompt(),
			prompt: `Given the report that follows, decide to generate one or more tasks to be executed.

      Sentinel agent report:
      ${data.report}

      Decide whether you want to use the sendMessageToSentinel or sendMessageToExecutor tool. You must use one of them.`,
			tools: toolkit,
			maxSteps: 10,
			onStepFinish: this.onStepFinish,
		})

		const tool = toolCalls[0]

		if (!tool || tool.toolName !== 'sendMessageToExecutor') {
			this.eventBus.emit(`${this.name}-sentinel`, {
				result: tool ? tool.args.message : 'Generate a new report.',
				report: data.report,
			})
		} else if (tool.toolName === 'sendMessageToExecutor') {
			this.eventBus.emit(`${this.name}-executor`, {
				result: tool.args.message,
				report: data.report,
			})
		}
	}

	async handleExecutorResult(data: { result: string; report: string }): Promise<void> {
		console.log(`[${this.name}] received result from the executor agent:\n\n${data.result}.`)

		const response = await generateText({
			model: openai('gpt-4o-mini'),
			system: getCuratorFinalReportSystemPrompt(),
			prompt: `Given the following report and result, generate a report to be sent to the sentinel agent about the execution of the tasks.

      Sentinel agent report:
      ${data.report}

      Executor agent result:
      ${data.result}`,
			maxSteps: 10,
			onStepFinish: this.onStepFinish,
		})

		await storeReport(response.text)

		this.eventBus.emit(`${this.name}-sentinel`, {
			result: response.text,
			report: data.report,
		})
	}

	/**
	 * @param data - The data to handle
	 */
	async onStepFinish({ text, toolCalls, toolResults }: any) {
		console.log(
			`[curator] step finished. tools called: ${
				toolCalls.length > 0
					? toolCalls.map((tool: any) => tool.toolName).join(', ')
					: 'none'
			}`
		)
		if (text) {
			await saveThought({
				agent: 'curator',
				text,
				toolCalls,
				toolResults,
			})
		}
	}
}
