import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
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

async function processVerification(job: Job) {
  const { eventId } = job.data
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [eventId])
  const event = rows[0]
  if (!event) throw new Error(`Event ${eventId} not found`)

  const reasons: string[] = []
  let score = event.confidence_score ?? 0

  // Re-verify ticket URL is still reachable
  if (event.ticket_url) {
    try {
      const { default: axios } = await import('axios')
      const resp = await axios.head(event.ticket_url, { timeout: 5000 })
      if (resp.status < 400) {
        if (!reasons.includes('Ticket URL verified')) {
          reasons.push('Ticket URL verified')
          score = Math.min(100, score + 5)
        }
      }
    } catch {
      score = Math.max(0, score - 10)
      reasons.push('Ticket URL unreachable')
    }
  }

  // Check for conflicts (multiple sources with different dates)
  const sources = event.sources ?? []
  if (sources.length >= 2) {
    reasons.push('Multiple independent sources confirmed')
  }

  // Determine new status
  let status = event.status
  if (score >= 80 && status === 'NEEDS_REVIEW') status = 'VERIFIED'
  if (score < 40) status = 'NEEDS_REVIEW'

  await pool.query(
    `UPDATE events SET confidence_score = $1, verification_reasons = $2,
     status = $3, last_verified_at = NOW(), updated_at = NOW() WHERE id = $4`,
    [score, [...(event.verification_reasons ?? []), ...reasons], status, eventId]
  )

  console.log(`[verification] Event ${eventId} scored ${score}, status: ${status}`)
  return { eventId, score, status }
}

const worker = new Worker('verification', processVerification, {
  connection: redis,
  concurrency: 5,
})

worker.on('completed', (job) => console.log(`[verification] Job ${job.id} done`))
worker.on('failed', (job, err) => console.error(`[verification] Job ${job?.id} failed:`, err.message))

console.log('✅ Verification worker started')
