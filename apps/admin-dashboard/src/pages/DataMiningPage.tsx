import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { triggerMining, fetchMiningResults, triggerFacebookMining, fetchFacebookResults, approveMiningEvent, type MinedEvent } from '../api/queries'

type Tab = 'all' | 'facebook'

const PROVINCES = ['', 'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape']
const CATEGORIES = ['', 'Nightlife', 'Concert / Festival', 'Club Night', 'Party', 'DJ Event', 'Live Music']
const STATUSES = ['', 'VERIFIED', 'NEEDS_REVIEW', 'DISCOVERED']

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    VERIFIED: '#34d399', NEEDS_REVIEW: '#fbbf24', DISCOVERED: '#94a3b8',
  }
  const color = map[status] ?? '#94a3b8'
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 600, padding: '0.2em 0.65em',
      borderRadius: 20, background: `${color}22`, color, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

const SOURCE_ICONS: Record<string, string> = {
  Quicket: 'bi-ticket-perforated',
  Howler: 'bi-music-note-beamed',
  Webtickets: 'bi-globe2',
  'Eventbrite ZA': 'bi-calendar-event',
  Instagram: 'bi-instagram',
  'Facebook Events': 'bi-facebook',
  'Twitter/X': 'bi-twitter-x',
  TikTok: 'bi-tiktok',
}

function SourceBadge({ source, sourceUrl }: { source: string; sourceUrl: string }) {
  const icon = SOURCE_ICONS[source] ?? 'bi-link-45deg'
  return (
    <a
      href={sourceUrl} target="_blank" rel="noreferrer"
      title={`View on ${source}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3em',
        fontSize: '0.72rem', fontWeight: 600, padding: '0.2em 0.55em',
        borderRadius: 20, textDecoration: 'none', whiteSpace: 'nowrap',
        background: 'rgba(167,139,250,0.12)', color: 'var(--accent-light)',
        border: '1px solid rgba(167,139,250,0.25)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.25)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.12)')}
    >
      <i className={`bi ${icon}`} />{source}
    </a>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat-card text-center" style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

export default function DataMiningPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [filterProvince, setFilterProvince] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<MinedEvent | null>(null)
  const PAGE_SIZE = 50

  // Track approved mined event IDs (by their mined string id) and their sync result
  const [approvedIds, setApprovedIds] = useState<Record<string, { syncStatus: string; nightlifeEventId: string | null; syncError: string | null }>>({}
  )
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const approveMut = useMutation({
    mutationFn: approveMiningEvent,
    onMutate: (ev) => setApprovingId(ev.id),
    onSettled: () => setApprovingId(null),
    onSuccess: (result, ev) => {
      setApprovedIds(prev => ({
        ...prev,
        [ev.id]: {
          syncStatus: result.syncStatus,
          nightlifeEventId: result.nightlifeEventId,
          syncError: result.syncError ?? null,
        },
      }))
      // Close modal if the approved event was the selected one
      setSelected(prev => prev?.id === ev.id ? null : prev)
    },
  })

  const handleApprove = (ev: MinedEvent) => {
    if (approvingId || approvedIds[ev.id]) return
    approveMut.mutate(ev)
  }

  const mineMut = useMutation({
    mutationFn: triggerMining,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mining-results'] }),
  })

  const fbMut = useMutation({
    mutationFn: triggerFacebookMining,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facebook-results'] }),
  })

  const { data: cached } = useQuery({
    queryKey: ['mining-results'],
    queryFn: fetchMiningResults,
    enabled: !mineMut.isPending,
    retry: false,
  })

  const { data: fbCached } = useQuery({
    queryKey: ['facebook-results'],
    queryFn: fetchFacebookResults,
    enabled: !fbMut.isPending,
    retry: false,
  })

  const results = mineMut.data ?? (cached ? { ...cached, total: cached.events.length, verified: 0, needsReview: 0, discovered: 0, duplicatesRemoved: 0 } : null)
  const allEvents: MinedEvent[] = results?.events ?? []

  const fbResults = fbMut.data ?? (fbCached ? { ...fbCached, total: fbCached.events.length } : null)
  const fbEvents: MinedEvent[] = fbResults?.events ?? []

  const activeEvents = tab === 'facebook' ? fbEvents : allEvents

  const filtered = useMemo(() => {
    const result = activeEvents.filter(e => {
      if (search && !`${e.title} ${e.venue ?? ''} ${e.city ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false
      if (filterProvince && e.province !== filterProvince) return false
      if (filterCity && !(e.city ?? '').toLowerCase().includes(filterCity.toLowerCase())) return false
      if (filterCategory && e.category !== filterCategory) return false
      if (filterStatus && e.verificationStatus !== filterStatus) return false
      if (filterDate && e.date !== filterDate) return false
      return true
    })
    // Approved events sink to the bottom
    return result.sort((a, b) => {
      const aApproved = !!approvedIds[a.id]
      const bApproved = !!approvedIds[b.id]
      if (aApproved === bApproved) return 0
      return aApproved ? 1 : -1
    })
  }, [activeEvents, search, filterProvince, filterCity, filterCategory, filterStatus, filterDate, approvedIds])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = useMemo(() => ({
    total: activeEvents.length,
    verified: activeEvents.filter(e => e.verificationStatus === 'VERIFIED').length,
    needsReview: activeEvents.filter(e => e.verificationStatus === 'NEEDS_REVIEW').length,
    discovered: activeEvents.filter(e => e.verificationStatus === 'DISCOVERED').length,
    duplicatesRemoved: tab === 'all' ? (results?.duplicatesRemoved ?? 0) : 0,
  }), [activeEvents, results, tab])

  const resetFilters = () => {
    setSearch(''); setFilterProvince(''); setFilterCity('')
    setFilterCategory(''); setFilterStatus(''); setFilterDate(''); setPage(1)
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h5 style={{ fontWeight: 700, margin: 0 }}>Data Mining</h5>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
            Automatically discover SA nightlife events from public sources
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {tab === 'all' && results?.minedAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last run: {new Date(results.minedAt).toLocaleString()}
            </span>
          )}
          {tab === 'facebook' && fbResults?.minedAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last run: {new Date(fbResults.minedAt).toLocaleString()}
            </span>
          )}
          {tab === 'all' && (
            <button
              className="btn btn-primary d-flex align-items-center gap-2"
              onClick={() => mineMut.mutate()}
              disabled={mineMut.isPending || fbMut.isPending}
              style={{ fontWeight: 600 }}
            >
              {mineMut.isPending
                ? <><span className="spinner-border spinner-border-sm" />Mining...</>
                : <><i className="bi bi-database-fill-gear" />Data Mine Events</>
              }
            </button>
          )}
          {tab === 'facebook' && (
            <button
              className="btn d-flex align-items-center gap-2"
              onClick={() => fbMut.mutate()}
              disabled={fbMut.isPending || mineMut.isPending}
              style={{ fontWeight: 600, background: '#1877f2', color: '#fff', border: 'none' }}
            >
              {fbMut.isPending
                ? <><span className="spinner-border spinner-border-sm" />Searching Facebook...</>
                : <><i className="bi bi-facebook" />Search Facebook Events</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="d-flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
        {([
          { id: 'all', label: 'All Sources', icon: 'bi-database-fill-gear', count: allEvents.length },
          { id: 'facebook', label: 'Facebook Events', icon: 'bi-facebook', count: fbEvents.length, color: '#1877f2' },
        ] as { id: Tab; label: string; icon: string; count: number; color?: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setPage(1) }}
            style={{
              background: 'none', border: 'none', padding: '0.5rem 1rem',
              borderBottom: tab === t.id ? `2px solid ${t.color ?? 'var(--accent)'}` : '2px solid transparent',
              color: tab === t.id ? (t.color ?? 'var(--accent-light)') : 'var(--text-muted)',
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
              marginBottom: '-1px', transition: 'color 0.15s',
            }}
          >
            <i className={`bi ${t.icon}`} />
            {t.label}
            {t.count > 0 && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, padding: '0.1em 0.5em',
                borderRadius: 20, background: tab === t.id ? (t.color ?? 'var(--accent)') + '22' : 'var(--card-bg)',
                color: tab === t.id ? (t.color ?? 'var(--accent-light)') : 'var(--text-muted)',
                border: '1px solid var(--card-border)',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Mining progress */}
      {(mineMut.isPending || fbMut.isPending) && (
        <div className="stat-card mb-4" style={{ borderColor: tab === 'facebook' ? '#1877f2' : 'var(--accent)' }}>
          <div className="d-flex align-items-center gap-3">
            <div className="spinner-border" style={{ width: '1.5rem', height: '1.5rem', color: tab === 'facebook' ? '#1877f2' : 'var(--accent)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {tab === 'facebook' ? 'Searching Facebook Events...' : 'Mining in progress...'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {tab === 'facebook'
                  ? 'Scanning Facebook public event search across 20 SA nightlife queries'
                  : 'Scanning Quicket · Howler · Webtickets · Eventbrite ZA · Instagram · Facebook · Twitter/X · TikTok'
                }
              </div>
            </div>
          </div>
          {tab === 'all' && (
            <div className="mt-3">
              {['Quicket', 'Howler', 'Webtickets', 'Eventbrite ZA', 'Instagram', 'Facebook Events', 'Twitter/X', 'TikTok'].map(src => (
                <div key={src} className="d-flex align-items-center gap-2 mb-1">
                  <div className="spinner-border spinner-border-sm text-secondary" style={{ width: '0.75rem', height: '0.75rem' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scanning {src}...</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {(mineMut.isError || fbMut.isError) && (
        <div className="alert-card mb-3">
          <i className="bi bi-exclamation-triangle me-2" />
          Mining failed: {((mineMut.error ?? fbMut.error) as Error).message}
        </div>
      )}

      {/* Stats */}
      {(tab === 'all' ? results : fbResults) && (
        <div className="d-flex flex-wrap gap-3 mb-4">
          <StatBox label="Total Discovered" value={stats.total} color="#a78bfa" />
          <StatBox label="Verified" value={stats.verified} color="#34d399" />
          <StatBox label="Needs Review" value={stats.needsReview} color="#fbbf24" />
          <StatBox label="Low Confidence" value={stats.discovered} color="#94a3b8" />
          <StatBox label="Duplicates Removed" value={stats.duplicatesRemoved} color="#60a5fa" />
        </div>
      )}

      {/* Filters */}
      {(tab === 'all' ? results : fbResults) && (
        <div className="stat-card mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3">
              <div className="input-group input-group-sm">
                <span className="input-group-text" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                  <i className="bi bi-search" style={{ color: 'var(--text-muted)' }} />
                </span>
                <input
                  className="form-control" placeholder="Search by name, venue, city..."
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
            </div>
            <div className="col-6 col-md-2">
              <select className="form-select form-select-sm" value={filterProvince} onChange={e => { setFilterProvince(e.target.value); setPage(1) }}>
                {PROVINCES.map(p => <option key={p} value={p}>{p || 'All Provinces'}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <input className="form-control form-control-sm" placeholder="City" value={filterCity} onChange={e => { setFilterCity(e.target.value); setPage(1) }} />
            </div>
            <div className="col-6 col-md-2">
              <select className="form-select form-select-sm" value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c || 'All Categories'}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-1">
              <select className="form-select form-select-sm" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
                {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-1">
              <input type="date" className="form-control form-control-sm" value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(1) }} />
            </div>
            <div className="col-6 col-md-1">
              <button className="btn btn-sm btn-outline-secondary w-100" onClick={resetFilters}>
                <i className="bi bi-x-circle me-1" />Clear
              </button>
            </div>
          </div>
          {filtered.length !== activeEvents.length && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Showing {filtered.length} of {activeEvents.length} events
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {(tab === 'all' ? results : fbResults) && (
        <div className="data-table">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-hover mb-0" style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Event Name</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th style={{ minWidth: 140 }}>Venue</th>
                  <th>City</th>
                  <th>Province</th>
                  <th style={{ minWidth: 180 }}>Description</th>
                  <th>Price</th>
                  <th>Links</th>
                  <th>Image</th>
                  <th>Source</th>
                  <th>Discovered</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(event => (
                  <tr key={event.id}>
                    <td>
                      {(event.eventUrl || event.ticketUrl)
                        ? (
                          <a
                            href={event.eventUrl ?? event.ticketUrl ?? ''}
                            target="_blank" rel="noreferrer"
                            style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-h)', textDecoration: 'none' }}
                            title="View original event"
                          >
                            {event.title}
                            <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: '0.65rem', opacity: 0.6 }} />
                          </a>
                        )
                        : <div style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-muted)' }} title="No source URL available">{event.title} <i className="bi bi-exclamation-circle" style={{ fontSize: '0.65rem', color: '#fbbf24' }} /></div>
                      }
                      {event.organiser && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{event.organiser}</div>}
                      {event.artists.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--accent-light)' }}>
                          {event.artists.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>{event.category}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{event.date ?? '—'}</td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {event.startTime ?? '—'}
                      {event.endTime && <span style={{ color: 'var(--text-muted)' }}> – {event.endTime}</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{event.venue ?? '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{event.city ?? '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{event.province ?? '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 200 }}>
                      {event.description
                        ? <span title={event.description}>{event.description.slice(0, 80)}{event.description.length > 80 ? '…' : ''}</span>
                        : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {event.price != null ? <span style={{ color: '#34d399', fontWeight: 600 }}>R{event.price}</span> : '—'}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {event.ticketUrl && (
                          <a href={event.ticketUrl} target="_blank" rel="noreferrer"
                            className="btn btn-sm btn-outline-secondary" title="Tickets" style={{ padding: '0.15rem 0.4rem' }}>
                            <i className="bi bi-ticket" style={{ fontSize: '0.75rem' }} />
                          </a>
                        )}
                        {event.eventUrl && event.eventUrl !== event.ticketUrl && (
                          <a href={event.eventUrl} target="_blank" rel="noreferrer"
                            className="btn btn-sm btn-outline-secondary" title="Event page" style={{ padding: '0.15rem 0.4rem' }}>
                            <i className="bi bi-link-45deg" style={{ fontSize: '0.75rem' }} />
                          </a>
                        )}
                        {event.socialUrl && (
                          <a href={event.socialUrl} target="_blank" rel="noreferrer"
                            className="btn btn-sm btn-outline-secondary" title="Social" style={{ padding: '0.15rem 0.4rem' }}>
                            <i className="bi bi-share" style={{ fontSize: '0.75rem' }} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      {event.imageUrl
                        ? <img src={event.imageUrl} alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4 }} />
                        : <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <SourceBadge source={event.source} sourceUrl={event.sourceUrl} />
                      {(event.eventUrl || event.ticketUrl) && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <a
                            href={event.eventUrl ?? event.ticketUrl ?? ''}
                            target="_blank" rel="noreferrer"
                            style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textDecoration: 'none' }}
                          >
                            View original →
                          </a>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(event.discoveredAt).toLocaleString()}
                    </td>
                    <td><StatusPill status={event.verificationStatus} /></td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          title="View details"
                          onClick={() => setSelected(event)}
                          style={{ padding: '0.15rem 0.4rem' }}
                        >
                          <i className="bi bi-eye" style={{ fontSize: '0.75rem' }} />
                        </button>
                        <button
                          className="btn btn-sm"
                          title="Approve"
                          onClick={() => handleApprove(event)}
                          disabled={!!approvingId || !!approvedIds[event.id]}
                          style={{
                            padding: '0.15rem 0.4rem',
                            background: approvedIds[event.id]
                              ? approvedIds[event.id].syncStatus === 'synced' ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'
                              : 'rgba(52,211,153,0.15)',
                            border: `1px solid ${approvedIds[event.id] ? (approvedIds[event.id].syncStatus === 'synced' ? 'rgba(52,211,153,0.6)' : 'rgba(251,191,36,0.6)') : 'rgba(52,211,153,0.3)'}`,
                            color: approvedIds[event.id]
                              ? approvedIds[event.id].syncStatus === 'synced' ? '#34d399' : '#fbbf24'
                              : '#34d399',
                          }}
                        >
                          {approvingId === event.id
                            ? <span className="spinner-border spinner-border-sm" style={{ width: '0.65rem', height: '0.65rem' }} />
                            : approvedIds[event.id]
                              ? <i className={`bi ${approvedIds[event.id].syncStatus === 'synced' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`} style={{ fontSize: '0.75rem' }} />
                              : <i className="bi bi-check-lg" style={{ fontSize: '0.75rem' }} />
                          }
                        </button>
                        <button
                          className="btn btn-sm"
                          title="Flag for review"
                          style={{ padding: '0.15rem 0.4rem', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                        >
                          <i className="bi bi-flag" style={{ fontSize: '0.75rem' }} />
                        </button>
                        <button
                          className="btn btn-sm"
                          title="Reject"
                          style={{ padding: '0.15rem 0.4rem', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
                        >
                          <i className="bi bi-x-lg" style={{ fontSize: '0.75rem' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={15} className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
                      {activeEvents.length === 0
                        ? <><i className={`bi ${tab === 'facebook' ? 'bi-facebook' : 'bi-database-fill-gear'} d-block mb-2`} style={{ fontSize: '2rem' }} />
                            {tab === 'facebook' ? 'Click "Search Facebook Events" to discover Facebook events' : 'Click "Data Mine Events" to start discovering events'}
                          </>
                        : 'No events match your filters'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center align-items-center gap-2 py-3 flex-wrap">
              <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(1)}>
                <i className="bi bi-chevron-double-left" />
              </button>
              <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <i className="bi bi-chevron-left" />
              </button>
              {/* Page number pills — show window of 5 around current */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) => p === '...'
                  ? <span key={`ellipsis-${i}`} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>…</span>
                  : <button
                      key={p}
                      className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setPage(p as number)}
                      style={{ minWidth: '2rem' }}
                    >{p}</button>
                )
              }
              <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <i className="bi bi-chevron-right" />
              </button>
              <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                <i className="bi bi-chevron-double-right" />
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                {filtered.length} events · page {page}/{totalPages} · {PAGE_SIZE}/page
              </span>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setSelected(null)}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '90vh',
            overflowY: 'auto', padding: '1.5rem'
          }} onClick={e => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-start mb-3">
              <h5 style={{ fontWeight: 700, margin: 0 }}>{selected.title}</h5>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelected(null)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {selected.imageUrl && (
              <img src={selected.imageUrl} alt={selected.title}
                style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8, marginBottom: '1rem' }} />
            )}

            <div className="row g-3 mb-3">
              {[
                { label: 'Category', value: selected.category },
                { label: 'Date', value: selected.date ?? '—' },
                { label: 'Start Time', value: selected.startTime ?? '—' },
                { label: 'End Time', value: selected.endTime ?? '—' },
                { label: 'Venue', value: selected.venue ?? '—' },
                { label: 'City', value: selected.city ?? '—' },
                { label: 'Province', value: selected.province ?? '—' },
                { label: 'Price', value: selected.price != null ? `R${selected.price}` : '—' },
                { label: 'Organiser', value: selected.organiser ?? '—' },
                { label: 'Source', value: selected.source },

                { label: 'Discovered', value: new Date(selected.discoveredAt).toLocaleString() },
                { label: 'Status', value: selected.verificationStatus },
              ].map(({ label, value }) => (
                <div key={label} className="col-6">
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  {label === 'Source'
                    ? <SourceBadge source={selected.source} sourceUrl={selected.sourceUrl} />
                    : <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{value}</div>}
                </div>
              ))}
            </div>

            {selected.description && (
              <div className="mb-3">
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Description</div>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>{selected.description}</p>
              </div>
            )}

            {selected.artists.length > 0 && (
              <div className="mb-3">
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Artists</div>
                <div>{selected.artists.map(a => <span key={a} className="badge bg-secondary me-1">{a}</span>)}</div>
              </div>
            )}

            <div className="d-flex gap-2 flex-wrap mt-3">
              {selected.ticketUrl && <a href={selected.ticketUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary"><i className="bi bi-ticket me-1" />Tickets</a>}
              {selected.eventUrl && <a href={selected.eventUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary"><i className="bi bi-link-45deg me-1" />Event Page</a>}
              {selected.socialUrl && <a href={selected.socialUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary"><i className="bi bi-share me-1" />Social</a>}
              {(selected.eventUrl || selected.ticketUrl || selected.socialUrl)
                ? <a href={selected.eventUrl ?? selected.ticketUrl ?? selected.socialUrl ?? ''} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary"><i className="bi bi-box-arrow-up-right me-1" />View Original Event →</a>
                : <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}><i className="bi bi-exclamation-triangle me-1" />No source URL available</span>
              }
            </div>

            <div className="d-flex gap-2 mt-3">
              {approvedIds[selected.id] ? (
                <div className="flex-fill p-2 rounded" style={{
                  background: approvedIds[selected.id].syncStatus === 'synced' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                  border: `1px solid ${approvedIds[selected.id].syncStatus === 'synced' ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.4)'}`,
                  fontSize: '0.8rem',
                }}>
                  <div style={{ fontWeight: 600, color: approvedIds[selected.id].syncStatus === 'synced' ? '#34d399' : '#fbbf24' }}>
                    <i className={`bi ${approvedIds[selected.id].syncStatus === 'synced' ? 'bi-cloud-check-fill' : 'bi-exclamation-triangle-fill'} me-1`} />
                    {approvedIds[selected.id].syncStatus === 'synced' ? 'Approved & synced to NightLife' : `Approved — sync ${approvedIds[selected.id].syncStatus.replace('_', ' ')}`}
                  </div>
                  {approvedIds[selected.id].nightlifeEventId && (
                    <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>NightLife ID: {approvedIds[selected.id].nightlifeEventId}</div>
                  )}
                  {approvedIds[selected.id].syncError && (
                    <div style={{ color: '#f87171', marginTop: '0.2rem' }}>{approvedIds[selected.id].syncError}</div>
                  )}
                </div>
              ) : (
                <button
                  className="btn btn-success btn-sm flex-fill"
                  onClick={() => handleApprove(selected)}
                  disabled={approvingId === selected.id}
                >
                  {approvingId === selected.id
                    ? <><span className="spinner-border spinner-border-sm me-1" style={{ width: '0.75rem', height: '0.75rem' }} />Approving...</>
                    : <><i className="bi bi-check-circle me-1" />Approve & Sync to NightLife</>
                  }
                </button>
              )}
              <button className="btn btn-warning btn-sm flex-fill"><i className="bi bi-flag me-1" />Flag</button>
              <button className="btn btn-danger btn-sm flex-fill"><i className="bi bi-x-circle me-1" />Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
