import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchEvents } from '../api/queries'
import ConfidenceScore from '../components/ConfidenceScore'
import Spinner from '../components/Spinner'

export default function ReviewQueuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['events', { status: 'NEEDS_REVIEW' }],
    queryFn: () => fetchEvents({ status: 'NEEDS_REVIEW', pageSize: 50 }),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          {data?.total ?? 0} events awaiting review
        </p>
      </div>

      <div className="row g-3">
        {data?.data.map(event => (
          <div key={event.id} className="col-12 col-md-6 col-xl-4">
            <div className="stat-card h-100">
              {event.imageUrl && (
                <img src={event.imageUrl} alt={event.title}
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: '0.75rem' }} />
              )}
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h6 style={{ fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>{event.title}</h6>
                <ConfidenceScore score={event.confidenceScore} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                <i className="bi bi-calendar me-1" />{event.date}
                {event.startTime && <span className="ms-2"><i className="bi bi-clock me-1" />{event.startTime}</span>}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                <i className="bi bi-geo-alt me-1" />{event.venue ?? '—'}, {event.city}
              </div>
              <div className="mb-2">
                {event.genres.slice(0, 3).map(g => (
                  <span key={g} className="badge bg-secondary me-1" style={{ fontSize: '0.65rem' }}>{g}</span>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                <i className="bi bi-link-45deg me-1" />{event.sources.length} source{event.sources.length !== 1 ? 's' : ''}
              </div>
              <Link to={`/events/${event.id}`} className="btn btn-primary btn-sm w-100">
                <i className="bi bi-clipboard-check me-1" />Review Event
              </Link>
            </div>
          </div>
        ))}
        {data?.data.length === 0 && (
          <div className="col-12 text-center py-5" style={{ color: 'var(--text-muted)' }}>
            <i className="bi bi-check-circle" style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }} />
            No events in review queue
          </div>
        )}
      </div>
    </div>
  )
}
