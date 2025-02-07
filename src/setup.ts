import { env } from 'bun'
import { privateKeyToAccount } from 'viem/accounts'
import { registerAgents } from './agents'
import { EventBus } from './comms'

/**
 * Development/Testing Wallet Setup
 * NOTE: This is only for development and testing purposes.
 * In production:
 * - Users will connect their own wallet (MetaMask, WalletConnect, etc.)
 * - No private keys will be stored
 * - Transactions will be signed by user's wallet
 * - Agents will only propose actions, user approves them
 */
const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`)

// initialize the event bus
const eventBus = new EventBus()

// register the agents
const { executorAgent, sentinelAgent, curatorAgent } = registerAgents(eventBus, account)

export { eventBus, executorAgent, sentinelAgent, curatorAgent, account }
