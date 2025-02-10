import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { Environment } from './env'
import { thoughtsRouter, walletRouter } from './routes'
import { cors } from 'hono/cors'

const app = new Hono<Environment>()

app.use(cors({ origin: '*' }))
app.use(logger())

// Health check endpoint for Railway
app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/thoughts', thoughtsRouter)
app.route('/wallet', walletRouter)

export { app }
