import type { FastifyInstance } from 'fastify'
import { query } from '../db/pool.js'
import { queues } from '../db/queues.js'
import { requireAuth } from '../middleware/auth.js'
import { EventFiltersSchema, UpdateEventSchema, NearbyEventsSchema } from '../schemas/index.js'
import { auditLog } from '../services/audit.js'

function toEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    genres: row.genres ?? [],
    eventType: row.event_type,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    venue: row.venue,
    address: row.address,
    city: row.city,
    province: row.province,
    country: row.country,
    location: { latitude: row.lat ?? null, longitude: row.lng ?? null },
    price: row.price,
    currency: row.currency,
    ticketUrl: row.ticket_url,
    eventUrl: row.event_url,
    imageUrl: row.image_url,
    organiser: row.organiser,
    artists: row.artists ?? [],
    ageRestriction: row.age_restriction,
    sources: row.sources ?? [],
    confidenceScore: row.confidence_score,
    verificationReasons: row.verification_reasons ?? [],
    status: row.status,
    discoveredAt: row.discovered_at,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function adminEventRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // List events with filters
  app.get('/admin/events', async (req) => {
    const f = EventFiltersSchema.parse(req.query)
    try {
      const conditions: string[] = []
      const params: unknown[] = []
      let p = 1
      if (f.status) { conditions.push(`status = $${p++}`); params.push(f.status) }
      if (f.province) { conditions.push(`province = $${p++}`); params.push(f.province) }
      if (f.city) { conditions.push(`city ILIKE $${p++}`); params.push(`%${f.city}%`) }
      if (f.genre) { conditions.push(`$${p++} = ANY(genres)`); params.push(f.genre) }
      if (f.search) { conditions.push(`title ILIKE $${p++}`); params.push(`%${f.search}%`) }
      if (f.dateFrom) { conditions.push(`date >= $${p++}`); params.push(f.dateFrom) }
      if (f.dateTo) { conditions.push(`date <= $${p++}`); params.push(f.dateTo) }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const offset = (f.page - 1) * f.pageSize
      const [dataResult, countResult] = await Promise.all([
        query(`SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM events ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`, [...params, f.pageSize, offset]),
        query(`SELECT COUNT(*) FROM events ${where}`, params),
      ])
      const total = Number(countResult.rows[0].count)
      return { data: dataResult.rows.map(toEvent), total, page: f.page, pageSize: f.pageSize, totalPages: Math.ceil(total / f.pageSize) }
    } catch {
      return { data: [], total: 0, page: f.page, pageSize: f.pageSize, totalPages: 0 }
    }
  })

  // Get single event
  app.get<{ Params: { id: string } }>('/admin/events/:id', async (req, reply) => {
    const result = await query(
      `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM events WHERE id = $1`,
      [req.params.id]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Not found' })
    return toEvent(result.rows[0])
  })

  // Update event
  app.patch<{ Params: { id: string } }>('/admin/events/:id', async (req, reply) => {
    const data = UpdateEventSchema.parse(req.body)
    const user = req.user as { id: string; name: string }

    const sets: string[] = []
    const params: unknown[] = []
    let p = 1

    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        const col = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        sets.push(`${col} = $${p++}`)
        params.push(val)
      }
    }
    if (!sets.length) return reply.code(400).send({ error: 'No fields to update' })

    sets.push(`updated_at = NOW()`)
    params.push(req.params.id)

    const result = await query(
      `UPDATE events SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    )
    await auditLog(user.id, user.name, 'UPDATE_EVENT', 'event', req.params.id, data as Record<string, unknown>)
    return toEvent(result.rows[0])
  })

  // Approve event
  app.post<{ Params: { id: string } }>('/admin/events/:id/approve', async (req, reply) => {
    const user = req.user as { id: string; name: string }
    const result = await query(
      `UPDATE events SET status = 'APPROVED', updated_at = NOW() WHERE id = $1 AND status NOT IN ('EXPIRED', 'CANCELLED') RETURNING id`,
      [req.params.id]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Event not found or cannot be approved' })
    await auditLog(user.id, user.name, 'APPROVE_EVENT', 'event', req.params.id)
    return { success: true }
  })

  // Reject event
  app.post<{ Params: { id: string }; Body: { reason: string } }>('/admin/events/:id/reject', async (req, reply) => {
    const user = req.user as { id: string; name: string }
    const result = await query(
      `UPDATE events SET status = 'REJECTED', updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Event not found' })
    await auditLog(user.id, user.name, 'REJECT_EVENT', 'event', req.params.id, { reason: req.body?.reason })
    return { success: true }
  })

  // Flag event for review
  app.post<{ Params: { id: string }; Body: { note: string } }>('/admin/events/:id/flag', async (req) => {
    const user = req.user as { id: string; name: string }
    await query(
      `UPDATE events SET status = 'NEEDS_REVIEW', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    )
    await auditLog(user.id, user.name, 'FLAG_EVENT', 'event', req.params.id, { note: req.body?.note })
    return { success: true }
  })

  // Nearby events (PostGIS radius search)
  app.get('/admin/events/nearby', async (req) => {
    const { lat, lng, radius, genre, date } = NearbyEventsSchema.parse(req.query)
    const params: unknown[] = [lng, lat, radius * 1000]
    let p = 4
    const extra: string[] = []

    if (genre) { extra.push(`$${p++} = ANY(genres)`); params.push(genre) }
    if (date) { extra.push(`date = $${p++}`); params.push(date) }

    const extraWhere = extra.length ? `AND ${extra.join(' AND ')}` : ''

    const result = await query(
      `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
              ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_m
       FROM events
       WHERE status = 'APPROVED'
         AND location IS NOT NULL
         AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
         ${extraWhere}
       ORDER BY distance_m ASC
       LIMIT 100`,
      params
    )
    return result.rows.map(r => ({ ...toEvent(r), distanceKm: Math.round(Number(r.distance_m) / 100) / 10 }))
  })
}
