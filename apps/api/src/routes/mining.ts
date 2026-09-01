import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import https from 'https'
import http from 'http'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SANightlifeBot/1.0)',
        'Accept': 'text/html,application/json,*/*',
      },
    }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.on('error', reject)
  })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractMeta(html: string, property: string): string {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'))
  return m ? m[1].trim() : ''
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = []
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1])
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item['@type'] && ['Event', 'MusicEvent', 'Festival', 'SocialEvent'].includes(item['@type'])) {
          results.push(item)
        }
      }
    } catch { /* skip malformed */ }
  }
  return results
}

function normalizePrice(raw: unknown): number | null {
  if (!raw) return null
  const str = String(raw).replace(/[^\d.]/g, '')
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

function normalizeDate(raw: unknown): string | null {
  if (!raw) return null
  try {
    const d = new Date(String(raw))
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  } catch { return null }
}

function normalizeTime(raw: unknown): string | null {
  if (!raw) return null
  try {
    const d = new Date(String(raw))
    if (isNaN(d.getTime())) return null
    return d.toTimeString().slice(0, 5)
  } catch { return null }
}

function inferProvince(city: string): string {
  const map: Record<string, string> = {
    johannesburg: 'Gauteng', pretoria: 'Gauteng', soweto: 'Gauteng',
    sandton: 'Gauteng', midrand: 'Gauteng', centurion: 'Gauteng', tshwane: 'Gauteng',
    'cape town': 'Western Cape', stellenbosch: 'Western Cape', paarl: 'Western Cape',
    durban: 'KwaZulu-Natal', umhlanga: 'KwaZulu-Natal', ballito: 'KwaZulu-Natal', pietermaritzburg: 'KwaZulu-Natal',
    'port elizabeth': 'Eastern Cape', gqeberha: 'Eastern Cape', 'east london': 'Eastern Cape',
    bloemfontein: 'Free State', welkom: 'Free State',
    polokwane: 'Limpopo', tzaneen: 'Limpopo',
    nelspruit: 'Mpumalanga', mbombela: 'Mpumalanga', witbank: 'Mpumalanga',
    rustenburg: 'North West', mahikeng: 'North West', klerksdorp: 'North West',
    kimberley: 'Northern Cape', upington: 'Northern Cape',
  }
  return map[city.toLowerCase()] ?? ''
}

function detectVerificationStatus(event: MinedEvent): string {
  const issues: string[] = []
  if (!event.date) issues.push('missing date')
  if (!event.venue) issues.push('missing venue')
  if (!event.city) issues.push('missing city')
  if (!event.title || event.title.length < 3) issues.push('invalid title')
  if (issues.length === 0) return 'VERIFIED'
  if (issues.length <= 2) return 'NEEDS_REVIEW'
  return 'DISCOVERED'
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MinedEvent {
  id: string
  title: string
  category: string
  date: string | null
  startTime: string | null
  endTime: string | null
  venue: string | null
  city: string | null
  province: string | null
  description: string | null
  price: number | null
  ticketUrl: string | null
  eventUrl: string | null
  socialUrl: string | null
  imageUrl: string | null
  estimatedAttendance: number | null
  source: string
  sourceUrl: string
  discoveredAt: string
  verificationStatus: string
  genres: string[]
  artists: string[]
  organiser: string | null
}

let miningCache: { events: MinedEvent[]; minedAt: string } | null = null

// ─── Source Miners ────────────────────────────────────────────────────────────

async function mineQuicket(): Promise<MinedEvent[]> {
  const events: MinedEvent[] = []
  try {
    const html = await fetchUrl('https://www.quicket.co.za/events/south-africa/#/')
    const jsonLdItems = extractJsonLd(html)

    for (const item of jsonLdItems) {
      const loc = item['location'] as Record<string, unknown> | undefined
      const city = (loc?.['addressLocality'] as string) ?? ''
      const venue = (loc?.['name'] as string) ?? ''
      const offers = item['offers'] as Record<string, unknown> | undefined
      const performer = item['performer']
      const artists: string[] = Array.isArray(performer)
        ? performer.map((p: unknown) => (p as Record<string, unknown>)['name'] as string).filter(Boolean)
        : []

      const ev: MinedEvent = {
        id: `quicket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: String(item['name'] ?? ''),
        category: 'Nightlife',
        date: normalizeDate(item['startDate']),
        startTime: normalizeTime(item['startDate']),
        endTime: normalizeTime(item['endDate']),
        venue: venue || null,
        city: city || null,
        province: inferProvince(city) || null,
        description: item['description'] ? stripHtml(String(item['description'])).slice(0, 300) : null,
        price: normalizePrice(offers?.['price']),
        ticketUrl: (offers?.['url'] as string) ?? (item['url'] as string) ?? null,
        eventUrl: (item['url'] as string) ?? null,
        socialUrl: null,
        imageUrl: typeof item['image'] === 'string' ? item['image'] : null,
        estimatedAttendance: null,
        source: 'Quicket',
        sourceUrl: 'https://www.quicket.co.za',
        discoveredAt: new Date().toISOString(),
        verificationStatus: 'DISCOVERED',
        genres: [],
        artists,
        organiser: typeof item['organizer'] === 'object' && item['organizer']
          ? String((item['organizer'] as Record<string, unknown>)['name'] ?? '') : null,
      }
      ev.verificationStatus = detectVerificationStatus(ev)
      if (ev.title) events.push(ev)
    }

    // Also try to parse event cards from HTML
    const cardRegex = /<a[^>]+href="(\/events\/[^"]+)"[^>]*>[\s\S]*?<h[23][^>]*>([^<]+)<\/h[23]>/gi
    let m
    while ((m = cardRegex.exec(html)) !== null && events.length < 50) {
      const title = m[2].trim()
      if (title && !events.find(e => e.title === title)) {
        const ev: MinedEvent = {
          id: `quicket-card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title,
          category: 'Nightlife',
          date: null, startTime: null, endTime: null,
          venue: null, city: null, province: null, description: null,
          price: null,
          ticketUrl: `https://www.quicket.co.za${m[1]}`,
          eventUrl: `https://www.quicket.co.za${m[1]}`,
          socialUrl: null, imageUrl: null, estimatedAttendance: null,
          source: 'Quicket', sourceUrl: 'https://www.quicket.co.za',
          discoveredAt: new Date().toISOString(),
          verificationStatus: 'NEEDS_REVIEW',
          genres: [], artists: [], organiser: null,
        }
        events.push(ev)
      }
    }
  } catch (e) {
    console.error('[mine] Quicket error:', e)
  }
  return events
}

async function mineHowler(): Promise<MinedEvent[]> {
  const events: MinedEvent[] = []
  try {
    const html = await fetchUrl('https://howler.co.za/events')
    const jsonLdItems = extractJsonLd(html)

    for (const item of jsonLdItems) {
      const loc = item['location'] as Record<string, unknown> | undefined
      const addr = loc?.['address'] as Record<string, unknown> | undefined
      const city = String(addr?.['addressLocality'] ?? loc?.['addressLocality'] ?? '')
      const venue = String(loc?.['name'] ?? '')
      const offers = item['offers'] as Record<string, unknown> | undefined

      const ev: MinedEvent = {
        id: `howler-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: String(item['name'] ?? ''),
        category: 'Nightlife',
        date: normalizeDate(item['startDate']),
        startTime: normalizeTime(item['startDate']),
        endTime: normalizeTime(item['endDate']),
        venue: venue || null,
        city: city || null,
        province: inferProvince(city) || null,
        description: item['description'] ? stripHtml(String(item['description'])).slice(0, 300) : null,
        price: normalizePrice(offers?.['price']),
        ticketUrl: (item['url'] as string) ?? null,
        eventUrl: (item['url'] as string) ?? null,
        socialUrl: null,
        imageUrl: typeof item['image'] === 'string' ? item['image'] : null,
        estimatedAttendance: null,
        source: 'Howler',
        sourceUrl: 'https://howler.co.za',
        discoveredAt: new Date().toISOString(),
        verificationStatus: 'DISCOVERED',
        genres: [],
        artists: [],
        organiser: null,
      }
      ev.verificationStatus = detectVerificationStatus(ev)
      if (ev.title) events.push(ev)
    }
  } catch (e) {
    console.error('[mine] Howler error:', e)
  }
  return events
}

async function mineWebtickets(): Promise<MinedEvent[]> {
  const events: MinedEvent[] = []
  try {
    const html = await fetchUrl('https://www.webtickets.co.za/v2/Search.aspx?q=party+concert+festival')
    const jsonLdItems = extractJsonLd(html)

    for (const item of jsonLdItems) {
      const loc = item['location'] as Record<string, unknown> | undefined
      const city = String((loc?.['address'] as Record<string, unknown>)?.['addressLocality'] ?? '')
      const venue = String(loc?.['name'] ?? '')
      const offers = item['offers'] as Record<string, unknown> | undefined

      const ev: MinedEvent = {
        id: `webtickets-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: String(item['name'] ?? ''),
        category: 'Concert / Festival',
        date: normalizeDate(item['startDate']),
        startTime: normalizeTime(item['startDate']),
        endTime: normalizeTime(item['endDate']),
        venue: venue || null,
        city: city || null,
        province: inferProvince(city) || null,
        description: item['description'] ? stripHtml(String(item['description'])).slice(0, 300) : null,
        price: normalizePrice(offers?.['price']),
        ticketUrl: (item['url'] as string) ?? null,
        eventUrl: (item['url'] as string) ?? null,
        socialUrl: null,
        imageUrl: typeof item['image'] === 'string' ? item['image'] : null,
        estimatedAttendance: null,
        source: 'Webtickets',
        sourceUrl: 'https://www.webtickets.co.za',
        discoveredAt: new Date().toISOString(),
        verificationStatus: 'DISCOVERED',
        genres: [], artists: [], organiser: null,
      }
      ev.verificationStatus = detectVerificationStatus(ev)
      if (ev.title) events.push(ev)
    }
  } catch (e) {
    console.error('[mine] Webtickets error:', e)
  }
  return events
}

async function mineEventbriteZA(): Promise<MinedEvent[]> {
  const events: MinedEvent[] = []
  try {
    const html = await fetchUrl('https://www.eventbrite.co.za/d/south-africa/nightlife--events/')
    const jsonLdItems = extractJsonLd(html)

    for (const item of jsonLdItems) {
      const loc = item['location'] as Record<string, unknown> | undefined
      const addr = loc?.['address'] as Record<string, unknown> | undefined
      const city = String(addr?.['addressLocality'] ?? '')
      const venue = String(loc?.['name'] ?? '')
      const offers = item['offers'] as Record<string, unknown> | undefined

      const ev: MinedEvent = {
        id: `eventbrite-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: String(item['name'] ?? ''),
        category: 'Nightlife',
        date: normalizeDate(item['startDate']),
        startTime: normalizeTime(item['startDate']),
        endTime: normalizeTime(item['endDate']),
        venue: venue || null,
        city: city || null,
        province: inferProvince(city) || null,
        description: item['description'] ? stripHtml(String(item['description'])).slice(0, 300) : null,
        price: normalizePrice(offers?.['price']),
        ticketUrl: (item['url'] as string) ?? null,
        eventUrl: (item['url'] as string) ?? null,
        socialUrl: null,
        imageUrl: typeof item['image'] === 'string' ? item['image'] : null,
        estimatedAttendance: null,
        source: 'Eventbrite ZA',
        sourceUrl: 'https://www.eventbrite.co.za',
        discoveredAt: new Date().toISOString(),
        verificationStatus: 'DISCOVERED',
        genres: [], artists: [], organiser: null,
      }
      ev.verificationStatus = detectVerificationStatus(ev)
      if (ev.title) events.push(ev)
    }
  } catch (e) {
    console.error('[mine] Eventbrite error:', e)
  }
  return events
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicate(events: MinedEvent[]): MinedEvent[] {
  const seen = new Map<string, MinedEvent>()
  for (const ev of events) {
    const key = `${ev.title.toLowerCase().replace(/\s+/g, '')}|${ev.date ?? ''}|${(ev.city ?? '').toLowerCase()}`
    if (!seen.has(key)) seen.set(key, ev)
  }
  return Array.from(seen.values())
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function miningRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  app.post('/admin/mine', async (_req, reply) => {
    reply.header('Content-Type', 'application/json')

    console.log('[mine] Starting data mining run...')
    const [quicket, howler, webtickets, eventbrite] = await Promise.allSettled([
      mineQuicket(),
      mineHowler(),
      mineWebtickets(),
      mineEventbriteZA(),
    ])

    const all: MinedEvent[] = [
      ...(quicket.status === 'fulfilled' ? quicket.value : []),
      ...(howler.status === 'fulfilled' ? howler.value : []),
      ...(webtickets.status === 'fulfilled' ? webtickets.value : []),
      ...(eventbrite.status === 'fulfilled' ? eventbrite.value : []),
    ]

    const deduped = deduplicate(all)
    const verified = deduped.filter(e => e.verificationStatus === 'VERIFIED').length
    const needsReview = deduped.filter(e => e.verificationStatus === 'NEEDS_REVIEW').length
    const discovered = deduped.filter(e => e.verificationStatus === 'DISCOVERED').length

    miningCache = { events: deduped, minedAt: new Date().toISOString() }

    console.log(`[mine] Done. Total: ${deduped.length}, Verified: ${verified}, Review: ${needsReview}`)

    return {
      total: deduped.length,
      verified,
      needsReview,
      discovered,
      duplicatesRemoved: all.length - deduped.length,
      minedAt: miningCache.minedAt,
      events: deduped,
    }
  })

  app.get('/admin/mine/results', async (_req, reply) => {
    if (!miningCache) return reply.code(404).send({ error: 'No mining results yet. Run a mining job first.' })
    return miningCache
  })
}
