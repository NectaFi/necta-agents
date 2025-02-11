import { Hono } from 'hono'
import { cache } from 'hono/cache'
import env from '../../env'
import { sentinelAgent, curatorAgent, executorAgent } from '../../setup'

const agentsRouter = new Hono()

agentsRouter.get(
	'/status',
	cache({
		cacheName: 'necta-app',
		cacheControl: 'max-age=10',
	}),
	async (c) => {
		const now = new Date().toISOString()

		return c.json([
			{
				agent: 'sentinel',
				status: env.ENABLE_AGENTS ? 'active' : 'inactive',
				lastActive: now,
				description: 'Market analysis and opportunity detection',
			},
			{
				agent: 'curator',
				status: env.ENABLE_AGENTS ? 'active' : 'inactive',
				lastActive: now,
				description: 'Decision making and strategy formulation',
			},
			{
				agent: 'executor',
				status: env.ENABLE_AGENTS ? 'active' : 'inactive',
				lastActive: now,
				description: 'Transaction execution and safety verification',
			},
		])
	}
)

export { agentsRouter }
