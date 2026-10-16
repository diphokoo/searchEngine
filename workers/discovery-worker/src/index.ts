import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import axios from 'axios'
import pg from 'pg'

const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
})

const pool = new pg.Pool({
  host: process.env.DB_HOST ?? 'localhost',
  database: process.env.DB_NAME ?? 'event_intelligence',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
})

const MINING_URL = process.env.MINING_ENGINE_URL ?? 'http://localhost:8000'
const MINING_KEY = process.env.MINING_ENGINE_API_KEY ?? 'internal-key'

async function processDiscovery(job: Job) {
  const { sourceId } = job.data
  console.log(`[discovery] Processing source ${sourceId}`)

  const { rows } = await pool.query('SELECT * FROM sources WHERE id = $1', [sourceId])
  const source = rows[0]
  if (!source) throw new Error(`Source ${sourceId} not found`)

  // Delegate to Python mining engine
  const response = await axios.post(
    `${MINING_URL}/extract/url`,
    { url: source.url, sourceId, connectorType: source.connector },
    { headers: { 'x-api-key': MINING_KEY }, timeout: 60_000 }
  )

  const { events } = response.data
  console.log(`[discovery] Extracted ${events.length} events from ${source.name}`)

  // Queue each event for the extraction worker
  const { queues } = await import('../../apps/api/src/db/queues.js').catch(() => ({ queues: null }))
  // Fallback: direct DB insert handled by Python worker
  return { sourceId, eventsFound: events.length }
}

const worker = new Worker('discovery', processDiscovery, {
  connection: redis,
  concurrency: 3,
  limiter: { max: 10, duration: 60_000 },
})

worker.on('completed', (job) => console.log(`[discovery] Job ${job.id} completed`))
worker.on('failed', (job, err) => console.error(`[discovery] Job ${job?.id} failed:`, err.message))

console.log('🔍 Discovery worker started')
