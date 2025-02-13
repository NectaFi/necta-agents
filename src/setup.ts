import env from './env'
import { privateKeyToAccount } from 'viem/accounts'
import { registerAgents } from './agents'
import { EventBus } from './comms'
import { ConsoleKitService } from './services/console-kit'

/**
 * Development/Testing Wallet Setup
 * NOTE: This is only for development and testing purposes.
 * In production:
 * - Executor uses EXECUTOR_EOA_PRIVATE_KEY for signing transactions
 * - User uses USER_EOA_PRIVATE_KEY for deployments
 * - Transactions executed through ConsoleKit
 * - Monitoring is done on the Brahma account address
 */

// Initialize the executor account for signing transactions
const executorAccount = privateKeyToAccount(env.EXECUTOR_EOA_PRIVATE_KEY as `0x${string}`)

// Initialize ConsoleKit service
const consoleKit = new ConsoleKitService()

// Initialize the event bus
const eventBus = new EventBus()

// Register the agents - pass both executor account for signing and Brahma account for monitoring
const { executorAgent, sentinelAgent, curatorAgent } = registerAgents(eventBus, {
	executor: executorAccount,
	brahma: env.BRAHMA_ACCOUNT_ADDRESS as `0x${string}`,
})

export {
	eventBus,
	executorAgent,
	sentinelAgent,
	curatorAgent,
	executorAccount as account,
	consoleKit,
}
