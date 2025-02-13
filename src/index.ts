import { app } from './app'
import env from './env'
import { sentinelAgent, account, consoleKit } from './setup'

// Check ConsoleKit initialization
if (!consoleKit.isRegistered()) {
	console.log(`[⚠️] ConsoleKit executor not registered. Please run registration script first.`)
}

// Only start agents if explicitly enabled
if (env.ENABLE_AGENTS) {
	if (!env.BRAHMA_ACCOUNT_ADDRESS) {
		console.log(`[⚠️] BRAHMA_ACCOUNT_ADDRESS not set. Please set it in .env`)
		process.exit(1)
	}
	console.log(`[🚀] Starting autonomous agent system...`)
	console.log(`[ℹ️] Monitoring Brahma account: ${env.BRAHMA_ACCOUNT_ADDRESS}`)
	sentinelAgent.start(env.BRAHMA_ACCOUNT_ADDRESS as `0x${string}`)
} else {
	console.log(`[ℹ️] Agent system is disabled. Set ENABLE_AGENTS=true to enable.`)
}

// Export the agent for use in API routes
export { sentinelAgent, account, consoleKit }

// Only export the Hono app
export default {
	port: env.PORT || 3000,
	fetch: app.fetch,
}
