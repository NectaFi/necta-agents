import { app } from './app'
import env from './env'
import { sentinelAgent, account } from './setup'

console.log(`[🚀] starting sentinel agent loop.`)
sentinelAgent.start(account.address as `0x${string}`)

export default {
	port: env.PORT || 3000,
	fetch: app.fetch,
}
