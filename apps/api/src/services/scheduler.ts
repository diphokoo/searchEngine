import { Queue } from 'bullmq'
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

const discoveryQueue = new Queue('discovery', { connection: redis })

// Priority tiers in minutes
const SCAN_INTERVALS = {
  high: 45,     // high-reliability sources every 45 min
  normal: 180,  // normal sources every 3 hours
  low: 720,     // low-priority sources every 12 hours
}

function getPriority(reliabilityScore: number): keyof typeof SCAN_INTERVALS {
  if (reliabilityScore >= 90) return 'high'
  if (reliabilityScore >= 70) return 'normal'
  return 'low'
}

async function scheduleDueSources() {
  const { rows: sources } = await pool.query(`
    SELECT id, name, reliability_score, last_scan
    FROM sources
    WHERE status = 'ACTIVE'
  `)

  const now = Date.now()
  let queued = 0

  for (const source of sources) {
    const tier = getPriority(source.reliability_score)
    const intervalMs = SCAN_INTERVALS[tier] * 60 * 1000
    const lastScan = source.last_scan ? new Date(source.last_scan).getTime() : 0
    const due = now - lastScan >= intervalMs

    if (due) {
      const jobId = `scan-${source.id}-${Date.now()}`
      await discoveryQueue.add(
        'scan-source',
        { sourceId: source.id },
        {
          jobId,
          priority: tier === 'high' ? 1 : tier === 'normal' ? 5 : 10,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        }
      )
      queued++
    }
  }

  if (queued > 0) console.log(`[scheduler] Queued ${queued} source scan(s)`)
}

async function scheduleEventExpiry() {
  const { rowCount } = await pool.query(`
    UPDATE events
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE status = 'APPROVED'
      AND date < CURRENT_DATE
      AND status != 'EXPIRED'
  `)
  if (rowCount && rowCount > 0) console.log(`[scheduler] Expired ${rowCount} past event(s)`)
}

// Run immediately then on interval
export async function run() {
  console.log('[scheduler] Starting')
  await scheduleDueSources()
  await scheduleEventExpiry()

  // Check every 5 minutes
  setInterval(async () => {
    await scheduleDueSources()
    await scheduleEventExpiry()
  }, 5 * 60 * 1000)
}

run().catch(err => { console.error(err); process.exit(1) })
