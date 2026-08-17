import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchEvents, type EventFilters } from '../api/queries'
import StatusBadge from '../components/StatusBadge'
import ConfidenceScore from '../components/ConfidenceScore'
import Pagination from '../components/Pagination'
import Spinner from '../components/Spinner'

const STATUSES = ['', 'DISCOVERED', 'PROCESSING', 'NEEDS_REVIEW', 'VERIFIED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED']
const PROVINCES = ['', 'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape']

export default function EventsPage() {
  const [filters, setFilters] = useState<EventFilters>({ page: 1, pageSize: 20 })
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['events', filters],
    queryFn: () => fetchEvents(filters),
  })

  const applySearch = () => setFilters(f => ({ ...f, search, page: 1 }))
  const setFilter = (key: keyof EventFilters, val: string) =>
    setFilters(f => ({ ...f, [key]: val || undefined, page: 1 }))

  return (
    <div>
      {/* Filters */}
      <div className="stat-card mb-3">
        <div className="row g-2">
          <div className="col-12 col-md-4">
            <div className="input-group input-group-sm">
              <input
                className="form-control" placeholder="Search events..."
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applySearch()}
              />
              <button className="btn btn-primary" onClick={applySearch}>
                <i className="bi bi-search" />
              </button>
            </div>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select form-select-sm" onChange={e => setFilter('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select form-select-sm" onChange={e => setFilter('province', e.target.value)}>
              {PROVINCES.map(p => <option key={p} value={p}>{p || 'All Provinces'}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <input className="form-control form-control-sm" placeholder="City" onChange={e => setFilter('city', e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <input className="form-control form-control-sm" placeholder="Genre" onChange={e => setFilter('genre', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="data-table">
        {isLoading ? <Spinner /> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Venue / City</th>
                    <th>Genre</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th>Sources</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map(event => (
                    <tr key={event.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{event.title}</div>
                        {event.organiser && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{event.organiser}</div>}
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {event.date}<br />
                        <span style={{ color: 'var(--text-muted)' }}>{event.startTime}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {event.venue && <div>{event.venue}</div>}
                        <div style={{ color: 'var(--text-muted)' }}>{event.city}, {event.province}</div>
                      </td>
                      <td>
                        {event.genres.slice(0, 2).map(g => (
                          <span key={g} className="badge bg-secondary me-1" style={{ fontSize: '0.65rem' }}>{g}</span>
                        ))}
                      </td>
                      <td><ConfidenceScore score={event.confidenceScore} /></td>
                      <td><StatusBadge status={event.status} /></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{event.sources.length}</td>
                      <td>
                        <Link to={`/events/${event.id}`} className="btn btn-sm btn-outline-secondary">
                          <i className="bi bi-eye" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {data?.data.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-5" style={{ color: 'var(--text-muted)' }}>No events found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data?.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              onPage={p => setFilters(f => ({ ...f, page: p }))}
            />
          </>
        )}
      </div>
    </div>
  )
}
