import type { FastifyInstance } from 'fastify'
import { query } from '../db/pool.js'
import { requireApiKey } from '../middleware/auth.js'
import { EventFiltersSchema, NearbyEventsSchema } from '../schemas/index.js'

function toPublicEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    genres: row.genres,
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
    artists: row.artists,
    ageRestriction: row.age_restriction,
  }
}

export async function publicEventRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireApiKey)

  const approvedOnly = `status = 'APPROVED' AND (date IS NULL OR date >= CURRENT_DATE)`

  app.get('/api/events', async (req) => {
    const f = EventFiltersSchema.parse(req.query)
    const conditions = [approvedOnly]
    const params: unknown[] = []
    let p = 1

    if (f.province) { conditions.push(`province = $${p++}`); params.push(f.province) }
    if (f.city) { conditions.push(`city ILIKE $${p++}`); params.push(`%${f.city}%`) }
    if (f.genre) { conditions.push(`$${p++} = ANY(genres)`); params.push(f.genre) }
    if (f.search) { conditions.push(`title ILIKE $${p++}`); params.push(`%${f.search}%`) }
    if (f.dateFrom) { conditions.push(`date >= $${p++}`); params.push(f.dateFrom) }
    if (f.dateTo) { conditions.push(`date <= $${p++}`); params.push(f.dateTo) }

    const where = `WHERE ${conditions.join(' AND ')}`
    const offset = (f.page - 1) * f.pageSize

    const [data, count] = await Promise.all([
      query(
        `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
         FROM events ${where} ORDER BY date ASC, start_time ASC LIMIT $${p} OFFSET $${p + 1}`,
        [...params, f.pageSize, offset]
      ),
      query(`SELECT COUNT(*) FROM events ${where}`, params),
    ])
    const total = Number(count.rows[0].count)
    return { data: data.rows.map(toPublicEvent), total, page: f.page, pageSize: f.pageSize, totalPages: Math.ceil(total / f.pageSize) }
  })

  app.get<{ Params: { id: string } }>('/api/events/:id', async (req, reply) => {
    const result = await query(
      `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
       FROM events WHERE id = $1 AND ${approvedOnly}`,
      [req.params.id]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Not found' })
    return toPublicEvent(result.rows[0])
  })

  app.get('/api/events/upcoming', async () => {
    const result = await query(
      `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
       FROM events WHERE ${approvedOnly} ORDER BY date ASC, start_time ASC LIMIT 20`
    )
    return result.rows.map(toPublicEvent)
  })

  app.get<{ Params: { genre: string } }>('/api/events/genre/:genre', async (req) => {
    const result = await query(
      `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
       FROM events WHERE ${approvedOnly} AND $1 = ANY(genres) ORDER BY date ASC LIMIT 50`,
      [req.params.genre]
    )
    return result.rows.map(toPublicEvent)
  })

  app.get<{ Params: { city: string } }>('/api/events/city/:city', async (req) => {
    const result = await query(
      `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
       FROM events WHERE ${approvedOnly} AND city ILIKE $1 ORDER BY date ASC LIMIT 50`,
      [`%${req.params.city}%`]
    )
    return result.rows.map(toPublicEvent)
  })

  // Nearby with PostGIS
  app.get('/api/events/nearby', async (req) => {
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
       WHERE ${approvedOnly}
         AND location IS NOT NULL
         AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
         ${extraWhere}
       ORDER BY distance_m ASC LIMIT 50`,
      params
    )
    return result.rows.map(r => ({ ...toPublicEvent(r), distanceKm: Math.round(Number(r.distance_m) / 100) / 10 }))
  })
}
