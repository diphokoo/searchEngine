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

function titleSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return 1.0
  const wordsA = new Set(na.split(/\s+/))
  const wordsB = new Set(nb.split(/\s+/))
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return union === 0 ? 0 : intersection / union
}

async function processDeduplication(job: Job) {
  const { eventId } = job.data

  const { rows: [event] } = await pool.query(
    'SELECT id, title, date, venue, city, ticket_url FROM events WHERE id = $1',
    [eventId]
  )
  if (!event) return

  // Find candidates: same date + city
  const { rows: candidates } = await pool.query(
    `SELECT id, title, date, venue, city, ticket_url FROM events
     WHERE id != $1 AND date = $2 AND city ILIKE $3 AND status != 'REJECTED'
     LIMIT 50`,
    [eventId, event.date, event.city]
  )

  const duplicates: string[] = []

  for (const candidate of candidates) {
    // Exact ticket URL match
    if (event.ticket_url && candidate.ticket_url && event.ticket_url === candidate.ticket_url) {
      duplicates.push(candidate.id)
      continue
    }
    // Title similarity
    const sim = titleSimilarity(event.title, candidate.title)
    if (sim >= 0.8) duplicates.push(candidate.id)
  }

  if (duplicates.length > 0) {
    await pool.query(
      `INSERT INTO duplicate_groups (master_event_id, duplicate_event_ids, similarity_score)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [eventId, duplicates, 0.85]
    )
    console.log(`[dedup] Event ${eventId} has ${duplicates.length} duplicate(s)`)
  }

  return { eventId, duplicatesFound: duplicates.length }
}

const worker = new Worker('deduplication', processDeduplication, {
  connection: redis,
  concurrency: 10,
})

worker.on('completed', (job) => console.log(`[dedup] Job ${job.id} done`))
worker.on('failed', (job, err) => console.error(`[dedup] Job ${job?.id} failed:`, err.message))

console.log('🔁 Deduplication worker started')
