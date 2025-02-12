import env from './env'
import { privateKeyToAccount } from 'viem/accounts'
import { registerAgents } from './agents'
import { EventBus } from './comms'
import { ConsoleKitService } from './services/console-kit'

/**
 * Development/Testing Wallet Setup
 * NOTE: This is only for development and testing purposes.
 * In production:
 * - Executor uses EXECUTOR_EOA_PRIVATE_KEY
 * - User uses USER_EOA_PRIVATE_KEY for deployments
 * - Transactions executed through ConsoleKit
 */
const account = privateKeyToAccount(env.EXECUTOR_EOA_PRIVATE_KEY as `0x${string}`)

// Initialize ConsoleKit service
const consoleKit = new ConsoleKitService()

// Initialize the event bus
const eventBus = new EventBus()

// Register the agents
const { executorAgent, sentinelAgent, curatorAgent } = registerAgents(eventBus, account)

export { eventBus, executorAgent, sentinelAgent, curatorAgent, account, consoleKit }
