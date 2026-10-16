import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import pg from 'pg'
import axios from 'axios'

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

async function processExtraction(job: Job) {
  const { imageUrl, sourceId, eventId } = job.data

  if (imageUrl) {
    // OCR extraction from poster image
    const { data } = await axios.post(
      `${MINING_URL}/extract/image`,
      { imageUrl, sourceId },
      { headers: { 'x-api-key': MINING_KEY }, timeout: 30_000 }
    )

    if (data && eventId) {
      // Merge extracted data back into the event
      const sets: string[] = []
      const params: unknown[] = []
      let p = 1

      if (data.title) { sets.push(`title = $${p++}`); params.push(data.title) }
      if (data.date) { sets.push(`date = $${p++}`); params.push(data.date) }
      if (data.venue) { sets.push(`venue = $${p++}`); params.push(data.venue) }
      if (data.city) { sets.push(`city = $${p++}`); params.push(data.city) }
      if (data.artists?.length) { sets.push(`artists = $${p++}`); params.push(data.artists) }
      if (data.price != null) { sets.push(`price = $${p++}`); params.push(data.price) }

      if (sets.length) {
        sets.push(`updated_at = NOW()`)
        params.push(eventId)
        await pool.query(
          `UPDATE events SET ${sets.join(', ')} WHERE id = $${p}`,
          params
        )
      }
    }

    console.log(`[extraction] OCR complete for event ${eventId}`)
    return { eventId, extracted: true }
  }

  return { skipped: true }
}

const worker = new Worker('extraction', processExtraction, {
  connection: redis,
  concurrency: 3,
  limiter: { max: 5, duration: 10_000 },
})

worker.on('completed', (job) => console.log(`[extraction] Job ${job.id} done`))
worker.on('failed', (job, err) => console.error(`[extraction] Job ${job?.id} failed:`, err.message))

console.log('🖼️  Extraction worker started')
