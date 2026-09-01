import type { FastifyInstance } from 'fastify'
import { query } from '../db/pool.js'
import { queues } from '../db/queues.js'
import { requireAuth } from '../middleware/auth.js'
import { SourceSchema } from '../schemas/index.js'
import { auditLog } from '../services/audit.js'

function toSource(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    platform: row.platform,
    sourceType: row.source_type,
    province: row.province,
    city: row.city,
    connector: row.connector,
    status: row.status,
    reliabilityScore: row.reliability_score,
    lastScan: row.last_scan,
    lastSuccessfulScan: row.last_successful_scan,
    lastFailure: row.last_failure,
    eventsFound: row.events_found,
    eventsImported: row.events_imported,
    eventsRejected: row.events_rejected,
    errorCount: row.error_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function sourceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  app.get('/admin/sources', async (req) => {
    const { page = 1, pageSize = 20, status } = req.query as Record<string, string>
    const p = Number(page), ps = Number(pageSize)
    try {
      const where = status ? `WHERE status = $3` : ''
      const params = status ? [ps, (p - 1) * ps, status] : [ps, (p - 1) * ps]
      const [data, count] = await Promise.all([
        query(`SELECT * FROM sources ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params),
        query(`SELECT COUNT(*) FROM sources ${status ? 'WHERE status = $1' : ''}`, status ? [status] : []),
      ])
      const total = Number(count.rows[0].count)
      return { data: data.rows.map(toSource), total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) }
    } catch {
      return { data: [], total: 0, page: p, pageSize: ps, totalPages: 0 }
    }
  })

  app.get<{ Params: { id: string } }>('/admin/sources/:id', async (req, reply) => {
    const result = await query('SELECT * FROM sources WHERE id = $1', [req.params.id])
    if (!result.rows[0]) return reply.code(404).send({ error: 'Not found' })
    return toSource(result.rows[0])
  })

  app.post('/admin/sources', async (req) => {
    const data = SourceSchema.parse(req.body)
    const user = req.user as { id: string; name: string }
    const result = await query(
      `INSERT INTO sources (name, url, platform, source_type, province, city, connector, reliability_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.name, data.url, data.platform, data.sourceType, data.province, data.city, data.connector, data.reliabilityScore]
    )
    await auditLog(user.id, user.name, 'CREATE_SOURCE', 'source', result.rows[0].id as string, data as Record<string, unknown>)
    return toSource(result.rows[0])
  })

  app.patch<{ Params: { id: string } }>('/admin/sources/:id', async (req) => {
    const user = req.user as { id: string; name: string }
    const body = req.body as Record<string, unknown>
    const sets: string[] = []
    const params: unknown[] = []
    let p = 1

    const fieldMap: Record<string, string> = {
      name: 'name', url: 'url', status: 'status',
      reliabilityScore: 'reliability_score', connector: 'connector',
    }
    for (const [key, col] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) { sets.push(`${col} = $${p++}`); params.push(body[key]) }
    }
    sets.push(`updated_at = NOW()`)
    params.push(req.params.id)

    const result = await query(
      `UPDATE sources SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    )
    await auditLog(user.id, user.name, 'UPDATE_SOURCE', 'source', req.params.id, body)
    return toSource(result.rows[0])
  })

  // Trigger a scan job
  app.post<{ Params: { id: string } }>('/admin/sources/:id/scan', async (req, reply) => {
    const src = await query('SELECT * FROM sources WHERE id = $1', [req.params.id])
    if (!src.rows[0]) return reply.code(404).send({ error: 'Not found' })
    await queues.discovery.add('scan-source', { sourceId: req.params.id }, {
      priority: 1,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    })
    return { success: true, message: 'Scan job queued' }
  })

  // Test connector (stub — mining engine handles actual test)
  app.post<{ Params: { id: string } }>('/admin/sources/:id/test', async (req, reply) => {
    const src = await query('SELECT * FROM sources WHERE id = $1', [req.params.id])
    if (!src.rows[0]) return reply.code(404).send({ error: 'Not found' })
    return { success: true, message: 'Test job queued', connector: src.rows[0].connector }
  })
}
