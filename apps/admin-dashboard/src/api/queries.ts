import api from './client'
import type {
  NightlifeEvent, EventSource_, DashboardStats,
  PaginatedResponse, AuditLog, AdminUser
} from '@event-intelligence/shared-types'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post<{ token: string; user: AdminUser }>('/auth/login', { email, password })

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const fetchStats = () =>
  api.get<DashboardStats>('/admin/stats').then(r => r.data)

export const fetchChartData = (type: string) =>
  api.get<{ label: string; value: number }[]>(`/admin/charts/${type}`).then(r => r.data)

// ─── Events ───────────────────────────────────────────────────────────────────
export interface EventFilters {
  status?: string; province?: string; city?: string; genre?: string
  category?: string; search?: string; page?: number; pageSize?: number
}

export const fetchEvents = (filters: EventFilters = {}) =>
  api.get<PaginatedResponse<NightlifeEvent>>('/admin/events', { params: filters }).then(r => r.data)

export const fetchEvent = (id: string) =>
  api.get<NightlifeEvent>(`/admin/events/${id}`).then(r => r.data)

export const approveEvent = (id: string) =>
  api.post(`/admin/events/${id}/approve`).then(r => r.data)

export const rejectEvent = (id: string, reason: string) =>
  api.post(`/admin/events/${id}/reject`, { reason }).then(r => r.data)

export const updateEvent = (id: string, data: Partial<NightlifeEvent>) =>
  api.patch<NightlifeEvent>(`/admin/events/${id}`, data).then(r => r.data)

export const flagEvent = (id: string, note: string) =>
  api.post(`/admin/events/${id}/flag`, { note }).then(r => r.data)

// ─── Sources ──────────────────────────────────────────────────────────────────
export const fetchSources = (params: Record<string, string | number> = {}) =>
  api.get<PaginatedResponse<EventSource_>>('/admin/sources', { params }).then(r => r.data)

export const fetchSource = (id: string) =>
  api.get<EventSource_>(`/admin/sources/${id}`).then(r => r.data)

export const createSource = (data: Partial<EventSource_>) =>
  api.post<EventSource_>('/admin/sources', data).then(r => r.data)

export const updateSource = (id: string, data: Partial<EventSource_>) =>
  api.patch<EventSource_>(`/admin/sources/${id}`, data).then(r => r.data)

export const testSource = (id: string) =>
  api.post(`/admin/sources/${id}/test`).then(r => r.data)

export const triggerSourceScan = (id: string) =>
  api.post(`/admin/sources/${id}/scan`).then(r => r.data)

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const fetchAuditLogs = (params: Record<string, string | number> = {}) =>
  api.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params }).then(r => r.data)

// ─── System ───────────────────────────────────────────────────────────────────
export const fetchSystemHealth = () =>
  api.get<Record<string, unknown>>('/admin/system/health').then(r => r.data)

export const fetchJobQueues = () =>
  api.get<Record<string, unknown>>('/admin/system/queues').then(r => r.data)

// ─── Data Mining ──────────────────────────────────────────────────────────────
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

export interface MiningResult {
  total: number
  verified: number
  needsReview: number
  discovered: number
  duplicatesRemoved: number
  minedAt: string
  events: MinedEvent[]
}

export const triggerMining = () =>
  api.post<MiningResult>('/admin/mine').then(r => r.data)

export const fetchMiningResults = () =>
  api.get<{ events: MinedEvent[]; minedAt: string }>('/admin/mine/results').then(r => r.data)
