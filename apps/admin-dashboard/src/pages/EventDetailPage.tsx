import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchEvent, approveEvent, rejectEvent, flagEvent, updateEvent } from '../api/queries'
import StatusBadge from '../components/StatusBadge'
import ConfidenceScore from '../components/ConfidenceScore'
import Spinner from '../components/Spinner'
import type { NightlifeEvent } from '@event-intelligence/shared-types'

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [rejectReason, setRejectReason] = useState('')
  const [flagNote, setFlagNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<NightlifeEvent>>({})

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEvent(id!),
    enabled: !!id,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['event', id] })

  const approveMut = useMutation({ mutationFn: () => approveEvent(id!), onSuccess: invalidate })
  const rejectMut = useMutation({ mutationFn: () => rejectEvent(id!, rejectReason), onSuccess: invalidate })
  const flagMut = useMutation({ mutationFn: () => flagEvent(id!, flagNote), onSuccess: invalidate })
  const updateMut = useMutation({
    mutationFn: () => updateEvent(id!, editData),
    onSuccess: () => { invalidate(); setEditing(false) }
  })

  if (isLoading) return <Spinner />
  if (!event) return <div className="text-center py-5" style={{ color: 'var(--text-muted)' }}>Event not found</div>

  const canApprove = ['VERIFIED', 'NEEDS_REVIEW'].includes(event.status)
  const canReject = !['REJECTED', 'EXPIRED'].includes(event.status)

  return (
    <div className="row g-3">
      {/* Back */}
      <div className="col-12">
        <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-1" />Back
        </button>
      </div>

      {/* Main Info */}
      <div className="col-12 col-lg-8">
        <div className="stat-card mb-3">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{event.title}</h4>
              <StatusBadge status={event.status} />
            </div>
            <ConfidenceScore score={event.confidenceScore} />
          </div>

          {event.imageUrl && (
            <img src={event.imageUrl} alt={event.title}
              style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 8, marginBottom: '1rem' }} />
          )}

          {event.description && (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{event.description}</p>
          )}

          <div className="row g-3">
            {[
              { label: 'Date', value: event.date, icon: 'bi-calendar' },
              { label: 'Time', value: `${event.startTime ?? '—'}${event.endTime ? ` – ${event.endTime}` : ''}`, icon: 'bi-clock' },
              { label: 'Venue', value: event.venue, icon: 'bi-geo-alt' },
              { label: 'City', value: `${event.city ?? '—'}, ${event.province ?? '—'}`, icon: 'bi-pin-map' },
              { label: 'Price', value: event.price != null ? `R${event.price}` : 'TBA', icon: 'bi-tag' },
              { label: 'Age', value: event.ageRestriction ?? '—', icon: 'bi-person-check' },
              { label: 'Organiser', value: event.organiser ?? '—', icon: 'bi-person' },
              { label: 'Event Type', value: event.eventType, icon: 'bi-music-note' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="col-6 col-md-4">
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <i className={`bi ${icon} me-1`} />{label}
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, marginTop: '0.2rem' }}>{value ?? '—'}</div>
              </div>
            ))}
          </div>

          {event.genres.length > 0 && (
            <div className="mt-3">
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Genres</div>
              {event.genres.map(g => <span key={g} className="badge bg-secondary me-1">{g}</span>)}
            </div>
          )}

          {event.artists.length > 0 && (
            <div className="mt-3">
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Artists</div>
              {event.artists.map(a => <span key={a} className="badge bg-secondary me-1">{a}</span>)}
            </div>
          )}

          <div className="mt-3 d-flex gap-2 flex-wrap">
            {event.ticketUrl && <a href={event.ticketUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary"><i className="bi bi-ticket me-1" />Tickets</a>}
            {event.eventUrl && <a href={event.eventUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary"><i className="bi bi-link-45deg me-1" />Event Page</a>}
          </div>
        </div>

        {/* Sources */}
        <div className="stat-card mb-3">
          <h6 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Sources ({event.sources.length})
          </h6>
          {event.sources.map((src, i) => (
            <div key={i} className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-check-circle-fill text-success" />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{src.sourceName}</div>
                <a href={src.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{src.sourceUrl}</a>
              </div>
              <span className="badge bg-secondary ms-auto" style={{ fontSize: '0.65rem' }}>{src.platform}</span>
            </div>
          ))}
        </div>

        {/* Verification */}
        <div className="stat-card">
          <h6 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Verification Reasons
          </h6>
          {event.verificationReasons.map((r, i) => (
            <div key={i} className="d-flex align-items-center gap-2 mb-1">
              <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '0.8rem' }} />
              <span style={{ fontSize: '0.875rem' }}>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions Panel */}
      <div className="col-12 col-lg-4">
        <div className="stat-card mb-3">
          <h6 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Actions
          </h6>

          {canApprove && (
            <button
              className="btn btn-success w-100 mb-2"
              onClick={() => approveMut.mutate()}
              disabled={approveMut.isPending}
            >
              <i className="bi bi-check-circle me-2" />
              {approveMut.isPending ? 'Approving...' : 'Approve Event'}
            </button>
          )}

          <button className="btn btn-outline-secondary w-100 mb-2" onClick={() => setEditing(!editing)}>
            <i className="bi bi-pencil me-2" />Edit Event
          </button>

          {canReject && (
            <div className="mb-2">
              <input
                className="form-control form-control-sm mb-1"
                placeholder="Rejection reason..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
              <button
                className="btn btn-danger w-100"
                onClick={() => rejectMut.mutate()}
                disabled={rejectMut.isPending || !rejectReason}
              >
                <i className="bi bi-x-circle me-2" />
                {rejectMut.isPending ? 'Rejecting...' : 'Reject Event'}
              </button>
            </div>
          )}

          <div>
            <input
              className="form-control form-control-sm mb-1"
              placeholder="Flag note..."
              value={flagNote}
              onChange={e => setFlagNote(e.target.value)}
            />
            <button
              className="btn btn-warning w-100"
              onClick={() => flagMut.mutate()}
              disabled={flagMut.isPending || !flagNote}
            >
              <i className="bi bi-flag me-2" />Flag for Review
            </button>
          </div>
        </div>

        {/* Edit Form */}
        {editing && (
          <div className="stat-card mb-3">
            <h6 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Edit Event
            </h6>
            {(['title', 'venue', 'city', 'date', 'startTime', 'organiser'] as const).map(field => (
              <div key={field} className="mb-2">
                <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{field}</label>
                <input
                  className="form-control form-control-sm"
                  defaultValue={(event[field] as string) ?? ''}
                  onChange={e => setEditData(d => ({ ...d, [field]: e.target.value }))}
                />
              </div>
            ))}
            <div className="d-flex gap-2">
              <button className="btn btn-primary btn-sm flex-fill" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
                {updateMut.isPending ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="stat-card">
          <h6 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Metadata
          </h6>
          {[
            { label: 'Discovered', value: new Date(event.discoveredAt).toLocaleString() },
            { label: 'Last Verified', value: event.lastVerifiedAt ? new Date(event.lastVerifiedAt).toLocaleString() : '—' },
            { label: 'Created', value: new Date(event.createdAt).toLocaleString() },
            { label: 'Updated', value: new Date(event.updatedAt).toLocaleString() },
            { label: 'Coordinates', value: event.location.latitude ? `${event.location.latitude}, ${event.location.longitude}` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="mb-2">
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: '0.8rem' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
