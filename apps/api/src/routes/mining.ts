import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { config } from '../config.js'
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

// ─── Keyword Taxonomy ─────────────────────────────────────────────────────────

const GENERAL_TERMS = [
  'events', 'upcoming events', 'things to do', "what's on", 'events near me',
  'local events', 'weekend events', 'events tonight', 'events this week',
  'live events', 'experiences', 'entertainment', 'events happening today',
  'events happening this weekend',
]

const CATEGORY_TERMS = [
  'concerts', 'festivals', 'parties', 'nightlife', 'club events', 'live music',
  'dj events', 'comedy', 'sports', 'exhibitions', 'markets', 'food and drink',
  'networking', 'conferences', 'workshops', 'pop-up events', 'cultural events',
  'community events', 'theatre', 'performances', 'family events', 'outdoor events',
  'lifestyle events', 'business events', 'wellness events', 'car events', 'motoring events',
]

const NIGHTLIFE_TERMS = [
  'nightlife', 'night out', 'party', 'clubbing', 'club events', 'late night',
  'dj', 'live dj', 'rooftop party', 'lounge', 'day party', 'sundowner',
  'after party', 'weekend party', 'ladies night', 'theme party', 'music festival',
  'amapiano', 'house music', 'hip-hop', 'r&b', 'afrobeat', 'gqom', 'deep house',
]

const SA_CITIES = [
  'johannesburg', 'pretoria', 'cape town', 'durban', 'soweto', 'sandton',
  'midrand', 'centurion', 'stellenbosch', 'umhlanga', 'gqeberha', 'east london',
  'bloemfontein', 'polokwane', 'nelspruit', 'rustenburg', 'kimberley', 'tshwane',
]

// Detect event intent from a free-text query
export function detectEventIntent(query: string): {
  isEvent: boolean; isNightlife: boolean; category: string | null;
  city: string | null; keywords: string[]
} {
  const q = query.toLowerCase()
  const isNightlife = NIGHTLIFE_TERMS.some(k => q.includes(k))
  const isCategory = CATEGORY_TERMS.some(k => q.includes(k))
  const isGeneral = GENERAL_TERMS.some(k => q.includes(k))
  const category = CATEGORY_TERMS.find(k => q.includes(k)) ?? (isNightlife ? 'nightlife' : null)
  const city = SA_CITIES.find(c => q.includes(c)) ?? null
  const keywords = [...NIGHTLIFE_TERMS, ...CATEGORY_TERMS, ...GENERAL_TERMS].filter(k => q.includes(k))
  return { isEvent: isNightlife || isCategory || isGeneral, isNightlife, category, city, keywords }
}

// Build a relevance score for an event against a query
function scoreEvent(ev: MinedEvent, query: string): number {
  const q = query.toLowerCase()
  const text = `${ev.title} ${ev.description ?? ''} ${ev.category} ${ev.city ?? ''} ${ev.venue ?? ''}`.toLowerCase()
  let score = 0
  if (text.includes(q)) score += 10
  for (const kw of NIGHTLIFE_TERMS) if (text.includes(kw)) score += 3
  for (const kw of CATEGORY_TERMS) if (text.includes(kw)) score += 2
  for (const kw of GENERAL_TERMS) if (text.includes(kw)) score += 1
  if (ev.verificationStatus === 'VERIFIED') score += 5
  if (ev.verificationStatus === 'NEEDS_REVIEW') score += 2
  if (ev.date) score += 2
  if (ev.imageUrl) score += 1
  return score
}

// ─── Source Miners ────────────────────────────────────────────────────────────

// Shared JSON-LD → MinedEvent mapper
function mapJsonLd(
  item: Record<string, unknown>,
  source: string,
  sourceUrl: string,
  defaultCategory: string,
  prefix: string,
): MinedEvent | null {
  const title = String(item['name'] ?? '').trim()
  if (!title) return null
  const loc = item['location'] as Record<string, unknown> | undefined
  const addr = (loc?.['address'] ?? loc) as Record<string, unknown> | undefined
  const city = String(addr?.['addressLocality'] ?? loc?.['addressLocality'] ?? '').trim()
  const venue = String(loc?.['name'] ?? '').trim()
  const offers = item['offers'] as Record<string, unknown> | undefined
  const performer = item['performer']
  const artists: string[] = Array.isArray(performer)
    ? performer.map((p: unknown) => String((p as Record<string, unknown>)['name'] ?? '')).filter(Boolean)
    : []
  const eventUrl = String(item['url'] ?? '')
  const ev: MinedEvent = {
    id: `${prefix}-${Buffer.from(title + (item['startDate'] ?? '')).toString('base64').slice(0, 12)}`,
    title,
    category: defaultCategory,
    date: normalizeDate(item['startDate']),
    startTime: normalizeTime(item['startDate']),
    endTime: normalizeTime(item['endDate']),
    venue: venue || null,
    city: city || null,
    province: city ? inferProvince(city) || null : null,
    description: item['description'] ? stripHtml(String(item['description'])).slice(0, 400) : null,
    price: normalizePrice(offers?.['price']),
    ticketUrl: String(offers?.['url'] ?? eventUrl) || null,
    eventUrl: eventUrl || null,
    socialUrl: null,
    imageUrl: typeof item['image'] === 'string' ? item['image']
      : (item['image'] as Record<string, unknown>)?.['url'] as string ?? null,
    estimatedAttendance: null,
    source,
    sourceUrl: eventUrl || sourceUrl,
    discoveredAt: new Date().toISOString(),
    verificationStatus: 'DISCOVERED',
    genres: [],
    artists,
    organiser: typeof item['organizer'] === 'object' && item['organizer']
      ? String((item['organizer'] as Record<string, unknown>)['name'] ?? '') || null : null,
  }
  ev.verificationStatus = detectVerificationStatus(ev)
  return ev
}

// Quicket: sweep multiple keyword URLs
async function mineQuicket(): Promise<MinedEvent[]> {
  const events: MinedEvent[] = []
  const searches = [
    'https://www.quicket.co.za/events/south-africa/#/',
    'https://www.quicket.co.za/events/?search=party',
    'https://www.quicket.co.za/events/?search=concert',
    'https://www.quicket.co.za/events/?search=festival',
    'https://www.quicket.co.za/events/?search=amapiano',
    'https://www.quicket.co.za/events/?search=nightlife',
    'https://www.quicket.co.za/events/?search=dj',
    'https://www.quicket.co.za/events/?search=live+music',
    'https://www.quicket.co.za/events/?search=comedy',
    'https://www.quicket.co.za/events/?search=market',
    'https://www.quicket.co.za/events/?search=food',
    'https://www.quicket.co.za/events/?search=wellness',
    'https://www.quicket.co.za/events/?search=outdoor',
    'https://www.quicket.co.za/events/?search=family',
    'https://www.quicket.co.za/events/?search=sports',
  ]
  const seen = new Set<string>()
  for (const url of searches) {
    try {
      const html = await fetchUrl(url)
      for (const item of extractJsonLd(html)) {
        const ev = mapJsonLd(item, 'Quicket', 'https://www.quicket.co.za', inferCategory(String(item['name'] ?? '')), 'quicket')
        if (ev && !seen.has(ev.id)) { seen.add(ev.id); events.push(ev) }
      }
      // HTML card fallback
      const cardRegex = /<a[^>]+href="(\/events\/[^"?#]+)"[^>]*>[\s\S]*?<h[23][^>]*>([^<]+)<\/h[23]>/gi
      let m
      while ((m = cardRegex.exec(html)) !== null) {
        const title = m[2].trim()
        const eventUrl = `https://www.quicket.co.za${m[1]}`
        const key = `quicket-${title.toLowerCase().replace(/\s+/g, '')}`
        if (title && !seen.has(key)) {
          seen.add(key)
          events.push({
            id: key, title, category: inferCategory(title),
            date: null, startTime: null, endTime: null,
            venue: null, city: null, province: null, description: null, price: null,
            ticketUrl: eventUrl, eventUrl, socialUrl: null, imageUrl: null,
            estimatedAttendance: null, source: 'Quicket', sourceUrl: eventUrl,
            discoveredAt: new Date().toISOString(), verificationStatus: 'NEEDS_REVIEW',
            genres: [], artists: [], organiser: null,
          })
        }
      }
    } catch (e) { console.error(`[mine] Quicket ${url} error:`, e) }
  }
  console.log(`[mine] Quicket: found ${events.length} events`)
  return events
}

// Howler: sweep multiple keyword URLs
async function mineHowler(): Promise<MinedEvent[]> {
  const events: MinedEvent[] = []
  const searches = [
    'https://howler.co.za/events',
    'https://howler.co.za/events?q=amapiano',
    'https://howler.co.za/events?q=party',
    'https://howler.co.za/events?q=festival',
    'https://howler.co.za/events?q=dj',
    'https://howler.co.za/events?q=gqom',
    'https://howler.co.za/events?q=house',
    'https://howler.co.za/events?q=afrobeats',
    'https://howler.co.za/events?q=rooftop',
    'https://howler.co.za/events?q=sundowner',
    'https://howler.co.za/events?q=johannesburg',
    'https://howler.co.za/events?q=cape+town',
    'https://howler.co.za/events?q=durban',
    'https://howler.co.za/events?q=pretoria',
  ]
  const seen = new Set<string>()
  for (const url of searches) {
    try {
      const html = await fetchUrl(url)
      for (const item of extractJsonLd(html)) {
        const ev = mapJsonLd(item, 'Howler', 'https://howler.co.za', inferCategory(String(item['name'] ?? '')), 'howler')
        if (ev && !seen.has(ev.id)) { seen.add(ev.id); events.push(ev) }
      }
    } catch (e) { console.error(`[mine] Howler ${url} error:`, e) }
  }
  console.log(`[mine] Howler: found ${events.length} events`)
  return events
}

// Webtickets: sweep multiple keyword URLs
async function mineWebtickets(): Promise<MinedEvent[]> {
  const events: MinedEvent[] = []
  const searches = [
    'https://www.webtickets.co.za/v2/Search.aspx?q=party',
    'https://www.webtickets.co.za/v2/Search.aspx?q=concert',
    'https://www.webtickets.co.za/v2/Search.aspx?q=festival',
    'https://www.webtickets.co.za/v2/Search.aspx?q=comedy',
    'https://www.webtickets.co.za/v2/Search.aspx?q=theatre',
    'https://www.webtickets.co.za/v2/Search.aspx?q=sports',
    'https://www.webtickets.co.za/v2/Search.aspx?q=family',
    'https://www.webtickets.co.za/v2/Search.aspx?q=music',
    'https://www.webtickets.co.za/v2/Search.aspx?q=exhibition',
    'https://www.webtickets.co.za/v2/Search.aspx?q=market',
  ]
  const seen = new Set<string>()
  for (const url of searches) {
    try {
      const html = await fetchUrl(url)
      for (const item of extractJsonLd(html)) {
        const ev = mapJsonLd(item, 'Webtickets', 'https://www.webtickets.co.za', inferCategory(String(item['name'] ?? '')), 'webtickets')
        if (ev && !seen.has(ev.id)) { seen.add(ev.id); events.push(ev) }
      }
    } catch (e) { console.error(`[mine] Webtickets ${url} error:`, e) }
  }
  console.log(`[mine] Webtickets: found ${events.length} events`)
  return events
}

// Eventbrite ZA: sweep multiple category URLs
async function mineEventbriteZA(): Promise<MinedEvent[]> {
  const events: MinedEvent[] = []
  const searches = [
    'https://www.eventbrite.co.za/d/south-africa/nightlife--events/',
    'https://www.eventbrite.co.za/d/south-africa/music--events/',
    'https://www.eventbrite.co.za/d/south-africa/food-and-drink--events/',
    'https://www.eventbrite.co.za/d/south-africa/arts--events/',
    'https://www.eventbrite.co.za/d/south-africa/comedy--events/',
    'https://www.eventbrite.co.za/d/south-africa/sports--events/',
    'https://www.eventbrite.co.za/d/south-africa/community--events/',
    'https://www.eventbrite.co.za/d/south-africa/business--events/',
    'https://www.eventbrite.co.za/d/south-africa/wellness--events/',
    'https://www.eventbrite.co.za/d/south-africa/family--events/',
    'https://www.eventbrite.co.za/d/south-africa/festivals--events/',
    'https://www.eventbrite.co.za/d/south-africa/outdoor--events/',
    'https://www.eventbrite.co.za/d/south-africa/amapiano--events/',
    'https://www.eventbrite.co.za/d/south-africa/theatre--events/',
    'https://www.eventbrite.co.za/d/south-africa/markets--events/',
  ]
  const seen = new Set<string>()
  for (const url of searches) {
    try {
      const html = await fetchUrl(url)
      for (const item of extractJsonLd(html)) {
        const ev = mapJsonLd(item, 'Eventbrite ZA', 'https://www.eventbrite.co.za', inferCategory(String(item['name'] ?? '')), 'eventbrite')
        if (ev && !seen.has(ev.id)) { seen.add(ev.id); events.push(ev) }
      }
    } catch (e) { console.error(`[mine] Eventbrite ${url} error:`, e) }
  }
  console.log(`[mine] Eventbrite ZA: found ${events.length} events`)
  return events
}

// Infer category from event title/text
function inferCategory(text: string): string {
  const t = text.toLowerCase()
  if (/amapiano|gqom|afrobeat|house music|deep house|hip.hop|r&b|rnb/.test(t)) return 'DJ Event'
  if (/concert|live music|band|orchestra/.test(t)) return 'Live Music'
  if (/festival/.test(t)) return 'Concert / Festival'
  if (/comedy|stand.?up/.test(t)) return 'Comedy'
  if (/party|club|nightlife|lounge|rooftop|sundowner|ladies night/.test(t)) return 'Nightlife'
  if (/market|food|drink|wine|beer|braai/.test(t)) return 'Food & Drink'
  if (/sport|run|race|cycling|soccer|rugby|cricket/.test(t)) return 'Sports'
  if (/theatre|play|musical|opera|dance/.test(t)) return 'Theatre'
  if (/exhibition|art|gallery|museum/.test(t)) return 'Exhibition'
  if (/workshop|seminar|training|course/.test(t)) return 'Workshop'
  if (/conference|summit|networking|business/.test(t)) return 'Business'
  if (/family|kids|children/.test(t)) return 'Family'
  if (/wellness|yoga|meditation|health/.test(t)) return 'Wellness'
  if (/outdoor|hike|nature|adventure/.test(t)) return 'Outdoor'
  if (/car|motor|auto|racing/.test(t)) return 'Motoring'
  if (/community|cultural|heritage/.test(t)) return 'Cultural'
  return 'Event'
}

// ─── Instagram Connector ─────────────────────────────────────────────────────
// Uses Instagram Graph API — requires a Facebook App with instagram_basic,
// pages_read_engagement permissions and a long-lived Page Access Token.
// Get token: https://developers.facebook.com/tools/explorer

const SA_NIGHTLIFE_KEYWORDS = ['amapiano', 'party', 'club', 'festival', 'concert', 'dj', 'nightlife', 'gqom', 'afrobeats', 'live music', 'event']

function isNightlifeContent(text: string): boolean {
  const lower = text.toLowerCase()
  return SA_NIGHTLIFE_KEYWORDS.some(kw => lower.includes(kw))
}

function extractCityFromText(text: string): string | null {
  const cities = ['johannesburg', 'pretoria', 'cape town', 'durban', 'soweto', 'sandton',
    'midrand', 'centurion', 'stellenbosch', 'umhlanga', 'ballito', 'gqeberha',
    'east london', 'bloemfontein', 'polokwane', 'nelspruit', 'rustenburg', 'kimberley']
  const lower = text.toLowerCase()
  return cities.find(c => lower.includes(c)) ?? null
}

function extractDateFromText(text: string): string | null {
  // Match patterns like "22 August", "Aug 22", "22/08/2026", "2026-08-22"
  const patterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/,
    /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{4})?)\b/i,
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)\b/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return normalizeDate(m[1])
  }
  return null
}

function extractPriceFromText(text: string): number | null {
  const m = text.match(/R\s*(\d+(?:[,.]\d+)?)/i) || text.match(/(\d+(?:[,.]\d+)?)\s*(?:rand|zar)/i)
  return m ? normalizePrice(m[1]) : null
}

async function fetchJson(url: string, token?: string): Promise<unknown> {
  const fullUrl = token ? `${url}${url.includes('?') ? '&' : '?'}access_token=${token}` : url
  const html = await fetchUrl(fullUrl)
  return JSON.parse(html)
}

async function mineInstagram(): Promise<MinedEvent[]> {
  const token = config.social.instagramToken
  if (!token) {
    console.log('[mine] Instagram: no token configured — skipping')
    return []
  }

  const events: MinedEvent[] = []
  try {
    // Search hashtags for SA nightlife content via Graph API
    const hashtags = ['amapiano', 'southafricanightlife', 'joburgnightlife', 'capetownnightlife', 'durbanparty', 'saparty']

    for (const tag of hashtags) {
      try {
        // Step 1: get hashtag ID
        const hashtagRes = await fetchJson(
          `https://graph.facebook.com/v19.0/ig_hashtag_search?user_id=me&q=${tag}`,
          token
        ) as { data?: { id: string }[] }

        const hashtagId = hashtagRes?.data?.[0]?.id
        if (!hashtagId) continue

        // Step 2: get recent media for hashtag
        const mediaRes = await fetchJson(
          `https://graph.facebook.com/v19.0/${hashtagId}/recent_media?fields=id,caption,media_url,permalink,timestamp&limit=20`,
          token
        ) as { data?: Record<string, unknown>[] }

        for (const post of mediaRes?.data ?? []) {
          const caption = String(post['caption'] ?? '')
          if (!isNightlifeContent(caption)) continue

          const city = extractCityFromText(caption)
          const date = extractDateFromText(caption)
          const price = extractPriceFromText(caption)
          const title = caption.split('\n')[0].slice(0, 80) || `${tag} Event`

          const ev: MinedEvent = {
            id: `instagram-${post['id']}`,
            title,
            category: 'Nightlife',
            date,
            startTime: null, endTime: null,
            venue: null,
            city,
            province: city ? inferProvince(city) || null : null,
            description: caption.slice(0, 300),
            price,
            ticketUrl: null,
            eventUrl: String(post['permalink'] ?? ''),
            socialUrl: String(post['permalink'] ?? ''),
            imageUrl: String(post['media_url'] ?? ''),
            estimatedAttendance: null,
            source: 'Instagram',
            sourceUrl: `https://www.instagram.com/explore/tags/${tag}/`,
            discoveredAt: new Date().toISOString(),
            verificationStatus: 'DISCOVERED',
            genres: [],
            artists: [],
            organiser: null,
          }
          ev.verificationStatus = detectVerificationStatus(ev)
          events.push(ev)
        }
      } catch (tagErr) {
        console.error(`[mine] Instagram hashtag ${tag} error:`, tagErr)
      }
    }
  } catch (e) {
    console.error('[mine] Instagram error:', e)
  }
  console.log(`[mine] Instagram: found ${events.length} events`)
  return events
}

// ─── Facebook Connector ───────────────────────────────────────────────────────
// Uses Facebook Graph API Events search.
// Requires: pages_read_engagement, public_profile permissions.
// Get App Token: https://developers.facebook.com/tools/explorer

async function mineFacebook(): Promise<MinedEvent[]> {
  const { facebookAppId, facebookAppSecret } = config.social
  if (!facebookAppId || !facebookAppSecret) {
    console.log('[mine] Facebook: no app credentials configured — skipping')
    return []
  }

  const events: MinedEvent[] = []
  try {
    // Get app access token
    const tokenRes = await fetchJson(
      `https://graph.facebook.com/oauth/access_token?client_id=${facebookAppId}&client_secret=${facebookAppSecret}&grant_type=client_credentials`
    ) as { access_token?: string }

    const appToken = tokenRes?.access_token
    if (!appToken) throw new Error('Could not obtain Facebook app token')

    // Search public events in SA cities
    const searches = [
      'amapiano johannesburg', 'party pretoria', 'club night cape town',
      'festival durban', 'concert south africa', 'nightlife soweto'
    ]

    for (const q of searches) {
      try {
        const res = await fetchJson(
          `https://graph.facebook.com/v19.0/search?type=event&q=${encodeURIComponent(q)}&fields=name,description,start_time,end_time,place,cover,ticket_uri&limit=10`,
          appToken
        ) as { data?: Record<string, unknown>[] }

        for (const item of res?.data ?? []) {
          const place = item['place'] as Record<string, unknown> | undefined
          const location = place?.['location'] as Record<string, unknown> | undefined
          const city = String(location?.['city'] ?? '')
          const cover = item['cover'] as Record<string, unknown> | undefined

          const ev: MinedEvent = {
            id: `facebook-${item['id']}`,
            title: String(item['name'] ?? ''),
            category: 'Nightlife',
            date: normalizeDate(item['start_time']),
            startTime: normalizeTime(item['start_time']),
            endTime: normalizeTime(item['end_time']),
            venue: String(place?.['name'] ?? '') || null,
            city: city || null,
            province: city ? inferProvince(city) || null : null,
            description: String(item['description'] ?? '').slice(0, 300) || null,
            price: null,
            ticketUrl: String(item['ticket_uri'] ?? '') || null,
            eventUrl: `https://www.facebook.com/events/${item['id']}`,
            socialUrl: `https://www.facebook.com/events/${item['id']}`,
            imageUrl: String(cover?.['source'] ?? '') || null,
            estimatedAttendance: null,
            source: 'Facebook Events',
            sourceUrl: 'https://www.facebook.com/events',
            discoveredAt: new Date().toISOString(),
            verificationStatus: 'DISCOVERED',
            genres: [], artists: [], organiser: null,
          }
          ev.verificationStatus = detectVerificationStatus(ev)
          if (ev.title) events.push(ev)
        }
      } catch (searchErr) {
        console.error(`[mine] Facebook search "${q}" error:`, searchErr)
      }
    }
  } catch (e) {
    console.error('[mine] Facebook error:', e)
  }
  console.log(`[mine] Facebook: found ${events.length} events`)
  return events
}

// ─── Twitter/X Connector ──────────────────────────────────────────────────────
// Uses Twitter API v2 recent search endpoint.
// Requires: Bearer Token from https://developer.twitter.com
// Free tier: 1 request/15min, 10 results max. Basic tier: $100/mo for more.

async function mineTwitter(): Promise<MinedEvent[]> {
  const token = config.social.twitterBearerToken
  if (!token) {
    console.log('[mine] Twitter: no bearer token configured — skipping')
    return []
  }

  const events: MinedEvent[] = []
  try {
    const queries = [
      '(amapiano OR party OR festival OR concert) (johannesburg OR pretoria OR "cape town" OR durban) -is:retweet lang:en',
      '(nightlife OR clubnight OR "live music") (southafrica OR gauteng OR "western cape") -is:retweet lang:en',
    ]

    for (const q of queries) {
      try {
        const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=10&tweet.fields=created_at,text,entities&expansions=attachments.media_keys&media.fields=url,preview_image_url`

        const res = await new Promise<string>((resolve, reject) => {
          const req = https.get(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'User-Agent': 'SANightlifeBot/1.0',
            }
          }, (r) => {
            let d = ''
            r.on('data', c => { d += c })
            r.on('end', () => resolve(d))
          })
          req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')) })
          req.on('error', reject)
        })

        const data = JSON.parse(res) as { data?: Record<string, unknown>[] }

        for (const tweet of data?.data ?? []) {
          const text = String(tweet['text'] ?? '')
          if (!isNightlifeContent(text)) continue

          const city = extractCityFromText(text)
          const date = extractDateFromText(text)
          const price = extractPriceFromText(text)
          const title = text.split('\n')[0].replace(/https?:\/\/\S+/g, '').trim().slice(0, 80) || 'SA Nightlife Event'

          const ev: MinedEvent = {
            id: `twitter-${tweet['id']}`,
            title,
            category: 'Nightlife',
            date,
            startTime: null, endTime: null,
            venue: null,
            city,
            province: city ? inferProvince(city) || null : null,
            description: text.slice(0, 300),
            price,
            ticketUrl: null,
            eventUrl: `https://twitter.com/i/web/status/${tweet['id']}`,
            socialUrl: `https://twitter.com/i/web/status/${tweet['id']}`,
            imageUrl: null,
            estimatedAttendance: null,
            source: 'Twitter/X',
            sourceUrl: 'https://twitter.com',
            discoveredAt: new Date().toISOString(),
            verificationStatus: 'DISCOVERED',
            genres: [], artists: [], organiser: null,
          }
          ev.verificationStatus = detectVerificationStatus(ev)
          events.push(ev)
        }
      } catch (qErr) {
        console.error(`[mine] Twitter query error:`, qErr)
      }
    }
  } catch (e) {
    console.error('[mine] Twitter error:', e)
  }
  console.log(`[mine] Twitter: found ${events.length} events`)
  return events
}

// ─── TikTok Connector ─────────────────────────────────────────────────────────
// Uses TikTok Research API (for approved research accounts) or
// TikTok for Developers Display API.
// Apply at: https://developers.tiktok.com
// Note: TikTok API access requires app review and approval.

async function mineTikTok(): Promise<MinedEvent[]> {
  const { tiktokApiKey, tiktokApiSecret } = config.social
  if (!tiktokApiKey || !tiktokApiSecret) {
    console.log('[mine] TikTok: no API credentials configured — skipping')
    return []
  }

  const events: MinedEvent[] = []
  try {
    // Get client credentials token
    const tokenRes = await new Promise<string>((resolve, reject) => {
      const body = `client_key=${tiktokApiKey}&client_secret=${tiktokApiSecret}&grant_type=client_credentials`
      const req = https.request({
        hostname: 'open.tiktokapis.com',
        path: '/v2/oauth/token/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (r) => {
        let d = ''
        r.on('data', c => { d += c })
        r.on('end', () => resolve(d))
      })
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')) })
      req.on('error', reject)
      req.write(body)
      req.end()
    })

    const tokenData = JSON.parse(tokenRes) as { access_token?: string }
    const accessToken = tokenData?.access_token
    if (!accessToken) throw new Error('Could not obtain TikTok access token')

    // Search videos with SA nightlife hashtags
    const hashtags = ['amapiano', 'southafricanightlife', 'saparty', 'joburgnightlife']

    for (const tag of hashtags) {
      try {
        const queryBody = JSON.stringify({
          query: {
            and: [
              { operation: 'IN', field_name: 'hashtag_name', field_values: [tag] },
              { operation: 'EQ', field_name: 'region_code', field_values: ['ZA'] },
            ]
          },
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          max_count: 20,
          fields: 'id,create_time,desc,share_url,cover_image_url,video_description',
        })

        const res = await new Promise<string>((resolve, reject) => {
          const req = https.request({
            hostname: 'open.tiktokapis.com',
            path: '/v2/research/video/query/',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(queryBody),
            },
          }, (r) => {
            let d = ''
            r.on('data', c => { d += c })
            r.on('end', () => resolve(d))
          })
          req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')) })
          req.on('error', reject)
          req.write(queryBody)
          req.end()
        })

        const data = JSON.parse(res) as { data?: { videos?: Record<string, unknown>[] } }

        for (const video of data?.data?.videos ?? []) {
          const desc = String(video['video_description'] ?? video['desc'] ?? '')
          if (!isNightlifeContent(desc)) continue

          const city = extractCityFromText(desc)
          const date = extractDateFromText(desc)
          const price = extractPriceFromText(desc)
          const title = desc.split('\n')[0].replace(/#\w+/g, '').trim().slice(0, 80) || `#${tag} Event`

          const ev: MinedEvent = {
            id: `tiktok-${video['id']}`,
            title,
            category: 'Nightlife',
            date,
            startTime: null, endTime: null,
            venue: null,
            city,
            province: city ? inferProvince(city) || null : null,
            description: desc.slice(0, 300),
            price,
            ticketUrl: null,
            eventUrl: String(video['share_url'] ?? ''),
            socialUrl: String(video['share_url'] ?? ''),
            imageUrl: String(video['cover_image_url'] ?? '') || null,
            estimatedAttendance: null,
            source: 'TikTok',
            sourceUrl: `https://www.tiktok.com/tag/${tag}`,
            discoveredAt: new Date().toISOString(),
            verificationStatus: 'DISCOVERED',
            genres: [], artists: [], organiser: null,
          }
          ev.verificationStatus = detectVerificationStatus(ev)
          events.push(ev)
        }
      } catch (tagErr) {
        console.error(`[mine] TikTok hashtag ${tag} error:`, tagErr)
      }
    }
  } catch (e) {
    console.error('[mine] TikTok error:', e)
  }
  console.log(`[mine] TikTok: found ${events.length} events`)
  return events
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function deduplicate(events: MinedEvent[]): MinedEvent[] {
  const byUrl = new Map<string, MinedEvent>()
  const byKey = new Map<string, MinedEvent>()
  for (const ev of events) {
    // Prefer event with more data when deduplicating
    const urlKey = ev.eventUrl ?? ev.ticketUrl ?? ''
    if (urlKey) {
      const existing = byUrl.get(urlKey)
      if (!existing || scoreEvent(ev, ev.title) > scoreEvent(existing, existing.title)) {
        byUrl.set(urlKey, ev)
      }
      continue
    }
    // Fallback: title + date + city
    const key = `${normalizeTitle(ev.title)}|${ev.date ?? ''}|${(ev.city ?? '').toLowerCase()}`
    const existing = byKey.get(key)
    if (!existing || scoreEvent(ev, ev.title) > scoreEvent(existing, existing.title)) {
      byKey.set(key, ev)
    }
  }
  return [...byUrl.values(), ...byKey.values()]
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function miningRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  app.post('/admin/mine', async (_req, reply) => {
    reply.header('Content-Type', 'application/json')

    console.log('[mine] Starting data mining run...')
    const [quicket, howler, webtickets, eventbrite, instagram, facebook, twitter, tiktok] = await Promise.allSettled([
      mineQuicket(),
      mineHowler(),
      mineWebtickets(),
      mineEventbriteZA(),
      mineInstagram(),
      mineFacebook(),
      mineTwitter(),
      mineTikTok(),
    ])

    const all: MinedEvent[] = [
      ...(quicket.status === 'fulfilled' ? quicket.value : []),
      ...(howler.status === 'fulfilled' ? howler.value : []),
      ...(webtickets.status === 'fulfilled' ? webtickets.value : []),
      ...(eventbrite.status === 'fulfilled' ? eventbrite.value : []),
      ...(instagram.status === 'fulfilled' ? instagram.value : []),
      ...(facebook.status === 'fulfilled' ? facebook.value : []),
      ...(twitter.status === 'fulfilled' ? twitter.value : []),
      ...(tiktok.status === 'fulfilled' ? tiktok.value : []),
    ]

    const deduped = deduplicate(all)
      .sort((a, b) => scoreEvent(b, '') - scoreEvent(a, '')) // best data quality first
      .slice(0, 1000) // support up to 1,000 entries

    // Flag events with no usable source URL
    for (const ev of deduped) {
      if (!ev.eventUrl && !ev.ticketUrl && !ev.socialUrl) {
        ev.verificationStatus = 'DISCOVERED'
        ev.sourceUrl = ev.sourceUrl || ''
      }
    }
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
