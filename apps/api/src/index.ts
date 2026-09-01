import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { config } from './config.js'
import { authRoutes } from './routes/auth.js'
import { run as startScheduler } from './services/scheduler.js'
import { adminEventRoutes } from './routes/events.js'
import { sourceRoutes } from './routes/sources.js'
import { adminRoutes } from './routes/admin.js'
import { publicEventRoutes } from './routes/publicEvents.js'

const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, { origin: true })
await app.register(jwt, { secret: config.jwtSecret })

// Health check (no auth)
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Routes
await app.register(authRoutes)
await app.register(adminEventRoutes)
await app.register(sourceRoutes)
await app.register(adminRoutes)
await app.register(publicEventRoutes)

// Global error handler
app.setErrorHandler((error, _req, reply) => {
  app.log.error(error)
  if (error.name === 'ZodError') {
    return reply.code(400).send({ error: 'Validation Error', message: error.message, statusCode: 400 })
  }
  reply.code(error.statusCode ?? 500).send({
    error: error.name ?? 'Internal Server Error',
    message: error.message,
    statusCode: error.statusCode ?? 500,
  })
})

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
  console.log(`🚀 API running on http://localhost:${config.port}`)
  // Scheduler requires PostgreSQL + Redis — enable once infrastructure is running
  // startScheduler().catch((err: Error) => app.log.error({ err }, 'Scheduler error'))
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
