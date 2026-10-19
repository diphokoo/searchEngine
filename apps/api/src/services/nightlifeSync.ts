/**
 * NightLife Sync Service
 * Pushes approved SearchEngine events into NightLife's Firestore.
 * Runs server-side only — Firebase Admin credentials never reach the browser.
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { query } from '../db/pool.js'
import { config } from '../config.js'

// ─── Firebase Admin init (lazy, singleton) ────────────────────────────────────

function getAdminApp(): App {
  if (getApps().length) return getApps()[0]
  const sa = config.nightlife.serviceAccount
  if (!sa) throw new Error('NIGHTLIFE_SERVICE_ACCOUNT env var is not set')
  return initializeApp({ credential: cert(JSON.parse(sa)) })
}

function firestore() {
  return getFirestore(getAdminApp())
}

// ─── Category mapping ─────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  'DJ Event': 'music',
  'Live Music': 'music',
  'Concert / Festival': 'festivals',
  'Nightlife': 'nightlife',
  'Food & Drink': 'food',
  'Arts & Culture': 'arts',
  'Exhibition': 'arts',
  'Theatre': 'arts',
  'Comedy': 'nightlife',
  'Sports': 'nightlife',
  'Festival': 'festivals',
  'Event': 'nightlife',
}

function mapCategory(seCategory: string | null): string {
  if (!seCategory) return 'nightlife'
  return CATEGORY_MAP[seCategory] ?? 'nightlife'
}

// ─── URL normalisation (Rule B dedup) ─────────────────────────────────────────

function normalizeUrl(raw: string | null): string {
  if (!raw) return ''
  try {
    const u = new URL(raw)
    // Remove common tracking params
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref'].forEach(p => u.searchParams.delete(p))
    u.hash = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return raw.replace(/\/$/, '')
  }
}

// ─── Title normalisation (Rule C dedup) ───────────────────────────────────────

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ─── Build NightLife event payload from SearchEngine row ─────────────────────

// Fields that the sync always owns — manualOverrides only blocks re-syncs
// after a human edits them in NightLife, but the approval sync must always win
// for date/time/image since those are the most likely to be wrong on first import.
const SYNC_ALWAYS_WRITES = new Set(['date', 'time', 'endTime', 'image'])

function isValidImageUrl(url: unknown): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.length > 0
  } catch { return false }
}

function buildNightlifePayload(row: Record<string, unknown>, existingOverrides: string[] = []) {
  // manualOverrides blocks sync for fields the NightLife admin has manually edited,
  // EXCEPT for fields in SYNC_ALWAYS_WRITES which the approval sync always refreshes.
  const overrideSet = new Set(existingOverrides.filter(f => !SYNC_ALWAYS_WRITES.has(f)))

  const rawDate = row.date ? String(row.date).split('T')[0] : null
  // Validate YYYY-MM-DD
  const validDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null

  // PostgreSQL TIME comes back as "HH:MM:SS" — trim to "HH:MM"
  const trimTime = (t: unknown) => t ? String(t).slice(0, 5) : null

  const base: Record<string, unknown> = {
    sourcePlatform: 'searchEngine',
    searchEngineEventId: row.id,
    sourceUrl: row.event_url ?? row.ticket_url ?? null,
    syncStatus: 'synced',
    lastSyncedAt: FieldValue.serverTimestamp(),
    // Always write date/time/image on every sync
    date:    validDate,
    time:    trimTime(row.start_time),
    endTime: trimTime(row.end_time),
    image:   isValidImageUrl(row.image_url) ? String(row.image_url) : null,
  }

  // Remaining fields respect manualOverrides
  const shared: Record<string, unknown> = {}
  if (!overrideSet.has('title'))       shared.title       = row.title
  if (!overrideSet.has('description')) shared.description = row.description ?? ''
  if (!overrideSet.has('venue'))       shared.venue       = row.venue ?? ''
  if (!overrideSet.has('address'))     shared.address     = row.address ?? ''
  if (!overrideSet.has('city'))        shared.city        = row.city ?? ''
  if (!overrideSet.has('category'))    shared.category    = mapCategory(row.category as string)
  if (!overrideSet.has('artist'))      shared.artist      = Array.isArray(row.artists) && row.artists.length ? (row.artists as string[]).join(', ') : (row.organiser ?? '')
  if (!overrideSet.has('price'))       shared.price       = row.price != null ? Number(row.price) : 0
  if (!overrideSet.has('ticketUrl'))   shared.ticketUrl   = row.ticket_url ?? null

  return { ...base, ...shared }
}

// ─── Deduplication lookup ─────────────────────────────────────────────────────

interface ExistingDoc {
  id: string
  data: Record<string, unknown>
}

async function findExistingNightlifeEvent(
  db: FirebaseFirestore.Firestore,
  seId: string,
  sourceUrl: string | null,
  title: string,
  date: string | null,
  venue: string | null,
  city: string | null,
): Promise<{ doc: ExistingDoc | null; isDuplicateReview: boolean }> {
  const col = db.collection('events')

  // Rule A: exact searchEngineEventId match
  const ruleA = await col.where('searchEngineEventId', '==', seId).limit(1).get()
  if (!ruleA.empty) {
    return { doc: { id: ruleA.docs[0].id, data: ruleA.docs[0].data() as Record<string, unknown> }, isDuplicateReview: false }
  }

  // Rule B: normalised source URL match
  const normUrl = normalizeUrl(sourceUrl)
  if (normUrl) {
    const ruleB = await col.where('sourceUrl', '==', normUrl).limit(2).get()
    if (ruleB.size === 1) {
      return { doc: { id: ruleB.docs[0].id, data: ruleB.docs[0].data() as Record<string, unknown> }, isDuplicateReview: false }
    }
    if (ruleB.size > 1) {
      // Multiple URL matches — flag for review
      return { doc: null, isDuplicateReview: true }
    }
  }

  // Rule C: title + date + city match (fuzzy)
  if (title && date && city) {
    const normT = normalizeTitle(title)
    const ruleC = await col
      .where('date', '==', date)
      .where('city', '==', city)
      .get()
    const matches = ruleC.docs.filter(d => {
      const t = d.data().title as string | undefined
      return t && normalizeTitle(t) === normT
    })
    if (matches.length === 1) {
      // Strong match — link but flag if venue differs significantly
      const existingVenue = (matches[0].data().venue as string | undefined) ?? ''
      const normVenue = (venue ?? '').toLowerCase().replace(/\s+/g, '')
      const normExisting = existingVenue.toLowerCase().replace(/\s+/g, '')
      const venueMismatch = normVenue && normExisting && normVenue !== normExisting
      if (venueMismatch) {
        return { doc: null, isDuplicateReview: true }
      }
      return { doc: { id: matches[0].id, data: matches[0].data() as Record<string, unknown> }, isDuplicateReview: false }
    }
    if (matches.length > 1) {
      return { doc: null, isDuplicateReview: true }
    }
  }

  // Rule D: no match — create new
  return { doc: null, isDuplicateReview: false }
}

// ─── Main sync function ───────────────────────────────────────────────────────

export interface SyncResult {
  status: 'synced' | 'failed' | 'duplicate_review'
  nightlifeEventId?: string
  error?: string
}

export async function syncEventToNightlife(eventId: string): Promise<SyncResult> {
  // 1. Load the SearchEngine event
  const result = await query(
    `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM events WHERE id = $1`,
    [eventId]
  )
  const row = result.rows[0]
  if (!row) return { status: 'failed', error: 'Event not found in SearchEngine' }

  let db: FirebaseFirestore.Firestore
  try {
    db = firestore()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'failed', error: `Firebase init failed: ${msg}` }
  }

  const col = db.collection('events')
  const seId = String(row.id)
  const sourceUrl = (row.event_url ?? row.ticket_url ?? null) as string | null
  const title = String(row.title ?? '')
  const date = row.date ? String(row.date).split('T')[0] : null
  const venue = (row.venue ?? null) as string | null
  const city = (row.city ?? null) as string | null

  try {
    const { doc: existing, isDuplicateReview } = await findExistingNightlifeEvent(
      db, seId, sourceUrl, title, date, venue, city
    )

    if (isDuplicateReview) {
      await query(
        `UPDATE events SET nightlife_sync_status = 'duplicate_review', nightlife_sync_error = $2, updated_at = NOW() WHERE id = $1`,
        [eventId, 'Potential duplicate detected — manual review required']
      )
      return { status: 'duplicate_review', error: 'Potential duplicate detected — manual review required' }
    }

    const normUrl = normalizeUrl(sourceUrl)

    if (existing) {
      // Update existing NightLife event, respecting manualOverrides
      const overrides: string[] = (existing.data.manualOverrides as string[] | undefined) ?? []
      const payload = buildNightlifePayload(row, overrides)
      // Always update sourceUrl to normalised form if not set
      if (!existing.data.sourceUrl && normUrl) payload.sourceUrl = normUrl

      await col.doc(existing.id).update(payload)
      await query(
        `UPDATE events SET nightlife_event_id = $2, nightlife_sync_status = 'synced', nightlife_sync_error = NULL, nightlife_last_synced_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [eventId, existing.id]
      )
      return { status: 'synced', nightlifeEventId: existing.id }
    }

    // Create new NightLife event
    const payload = buildNightlifePayload(row, [])
    if (normUrl) payload.sourceUrl = normUrl
    payload.status = 'published'
    payload.isFree = (Number(row.price) || 0) === 0
    payload.isFeatured = false
    payload.isTrending = false
    payload.manualOverrides = []
    payload.createdAt = FieldValue.serverTimestamp()
    payload.updatedAt = FieldValue.serverTimestamp()

    const ref = await col.add(payload)
    await query(
      `UPDATE events SET nightlife_event_id = $2, nightlife_sync_status = 'synced', nightlife_sync_error = NULL, nightlife_last_synced_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [eventId, ref.id]
    )
    return { status: 'synced', nightlifeEventId: ref.id }

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    await query(
      `UPDATE events SET nightlife_sync_status = 'failed', nightlife_sync_error = $2, updated_at = NOW() WHERE id = $1`,
      [eventId, msg.slice(0, 500)]
    ).catch(() => {})
    return { status: 'failed', error: msg }
  }
}
