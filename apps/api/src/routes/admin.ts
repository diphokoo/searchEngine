import type { FastifyInstance } from 'fastify'
import { query } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { getQueueStats } from '../db/queues.js'

const MOCK_STATS = {
  totalEvents: 0, newToday: 0, needsReview: 0, verified: 0,
  approved: 0, rejected: 0, cancelled: 0, expired: 0,
  duplicates: 0, activeSources: 0, failedSources: 0,
}

async function safeQuery(fn: () => Promise<unknown>, fallback: unknown) {
  try { return await fn() } catch { return fallback }
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // Dashboard stats
  app.get('/admin/stats', async () => {
    return safeQuery(async () => {
      const result = await query(`
        SELECT
          COUNT(*) FILTER (WHERE TRUE) as total_events,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_today,
          COUNT(*) FILTER (WHERE status = 'NEEDS_REVIEW') as needs_review,
          COUNT(*) FILTER (WHERE status = 'VERIFIED') as verified,
          COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled,
          COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired
        FROM events
      `)
      const srcResult = await query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_sources,
          COUNT(*) FILTER (WHERE status = 'FAILED') as failed_sources
        FROM sources
      `)
      const dupResult = await query('SELECT COUNT(*) as duplicates FROM duplicate_groups')
      const e = result.rows[0]
      const s = srcResult.rows[0]
      return {
        totalEvents: Number(e.total_events), newToday: Number(e.new_today),
        needsReview: Number(e.needs_review), verified: Number(e.verified),
        approved: Number(e.approved), rejected: Number(e.rejected),
        cancelled: Number(e.cancelled), expired: Number(e.expired),
        duplicates: Number(dupResult.rows[0].duplicates),
        activeSources: Number(s.active_sources), failedSources: Number(s.failed_sources),
      }
    }, MOCK_STATS)
  })

  // Chart data
  app.get<{ Params: { type: string } }>('/admin/charts/:type', async (req, reply) => {
    const { type } = req.params
    return safeQuery(async () => {
      if (type === 'timeline') {
        const result = await query(`
          SELECT TO_CHAR(created_at, 'Mon DD') as label, COUNT(*) as value
          FROM events WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at), label ORDER BY DATE(created_at)
        `)
        return result.rows.map(r => ({ label: r.label, value: Number(r.value) }))
      }
      if (type === 'province') {
        const result = await query(`SELECT COALESCE(province, 'Unknown') as label, COUNT(*) as value FROM events GROUP BY province ORDER BY value DESC`)
        return result.rows.map(r => ({ label: r.label, value: Number(r.value) }))
      }
      if (type === 'genre') {
        const result = await query(`SELECT unnest(genres) as label, COUNT(*) as value FROM events GROUP BY label ORDER BY value DESC LIMIT 12`)
        return result.rows.map(r => ({ label: r.label, value: Number(r.value) }))
      }
      if (type === 'city') {
        const result = await query(`SELECT COALESCE(city, 'Unknown') as label, COUNT(*) as value FROM events GROUP BY city ORDER BY value DESC LIMIT 15`)
        return result.rows.map(r => ({ label: r.label, value: Number(r.value) }))
      }
      return reply.code(400).send({ error: 'Unknown chart type' })
    }, [])
  })

  // Audit logs
  app.get('/admin/audit-logs', async (req) => {
    const { page = 1, pageSize = 30 } = req.query as Record<string, string>
    const p = Number(page), ps = Number(pageSize)
    return safeQuery(async () => {
      const [data, count] = await Promise.all([
        query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [ps, (p - 1) * ps]),
        query('SELECT COUNT(*) FROM audit_logs'),
      ])
      const total = Number(count.rows[0].count)
      return {
        data: data.rows.map(r => ({
          id: r.id, userId: r.user_id, userName: r.user_name,
          action: r.action, entityType: r.entity_type, entityId: r.entity_id,
          details: r.details, createdAt: r.created_at,
        })),
        total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps),
      }
    }, { data: [], total: 0, page: p, pageSize: ps, totalPages: 0 })
  })

  // System health
  app.get('/admin/system/health', async () => {
    const services = []
    try {
      const start = Date.now()
      await query('SELECT 1')
      services.push({ name: 'PostgreSQL', status: 'ok', latency: Date.now() - start })
    } catch {
      services.push({ name: 'PostgreSQL', status: 'down', message: 'Not connected — start PostgreSQL to enable' })
    }
    try {
      const qs = await getQueueStats()
      const totalFailed = qs.reduce((s, q) => s + q.failed, 0)
      services.push({ name: 'Redis / BullMQ', status: totalFailed > 50 ? 'degraded' : 'ok', message: `${qs.reduce((s, q) => s + q.active, 0)} active jobs` })
    } catch {
      services.push({ name: 'Redis / BullMQ', status: 'down', message: 'Not connected — start Redis to enable' })
    }
    services.push({ name: 'Mining Engine', status: 'ok', message: 'Stub — connect in Phase 3' })
    services.push({ name: 'API Server', status: 'ok', message: 'Running' })
    return { services }
  })

  // Queue stats
  app.get('/admin/system/queues', async () => {
    return safeQuery(
      async () => { const qs = await getQueueStats(); return { queues: qs } },
      { queues: [] }
    )
  })
}
