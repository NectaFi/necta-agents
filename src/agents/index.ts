import type { Account } from 'viem'
import { EventBus } from '../comms'
import { ExecutorAgent } from './executor'
import { SentinelAgent } from './sentinel'
import { CuratorAgent } from './curator'
import figlet from 'figlet'

/**
 * Registers the agents and returns them
 * @returns The registered agents
 */
export const registerAgents = (eventBus: EventBus, account: Account) => {
	console.log(figlet.textSync('NECTA'))
	console.log('======== Registering agents =========')
	// initialize the agents
	console.log(`[registerAgents] initializing executor agent...`)
	const executorAgent = new ExecutorAgent('executor', eventBus, account)
	console.log(`[registerAgents] executor agent initialized.`)
	console.log(`[registerAgents] initializing sentinel agent...`)
	const sentinelAgent = new SentinelAgent('sentinel', eventBus)
	console.log(`[registerAgents] sentinel agent initialized.`)
	console.log(`[registerAgents] initializing curator agent...`)
	const curatorAgent = new CuratorAgent('curator', eventBus)
	console.log(`[registerAgents] curator agent initialized.`)

	// register messages from the sentinel to the curator
	console.log(`[registerAgents] registering messages from the sentinel to the curator...`)
	eventBus.register(`${sentinelAgent.name}-${curatorAgent.name}`, (data) =>
		curatorAgent.handleEvent(`${sentinelAgent.name}-${curatorAgent.name}`, data)
	)
	console.log(`[registerAgents] messages from the sentinel to the curator registered.`)

	// register messages from the curator to the executor
	console.log(`[registerAgents] registering messages from the curator to the executor...`)
	eventBus.register(`${curatorAgent.name}-${executorAgent.name}`, (data) =>
		executorAgent.handleEvent(`${curatorAgent.name}-${executorAgent.name}`, data)
	)
	console.log(`[registerAgents] messages from the curator to the executor registered.`)

	// register messages from the executor to the curator
	console.log(`[registerAgents] registering messages from the executor to the curator...`)
	eventBus.register(`${executorAgent.name}-${curatorAgent.name}`, (data) =>
		curatorAgent.handleEvent(`${executorAgent.name}-${curatorAgent.name}`, data)
	)
	console.log(`[registerAgents] messages from the executor to the curator registered.`)

	// register messages from the curator to the sentinel
	console.log(`[registerAgents] registering messages from the curator to the sentinel...`)
	eventBus.register(`${curatorAgent.name}-${sentinelAgent.name}`, (data) =>
		sentinelAgent.handleEvent(`${curatorAgent.name}-${sentinelAgent.name}`, data)
	)
	console.log(`[registerAgents] messages from the curator to the sentinel registered.`)

	console.log(`[registerAgents] all agents registered.`)

	return {
		executorAgent,
		sentinelAgent,
		curatorAgent,
	}
}
