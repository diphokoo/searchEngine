import { useQuery } from '@tanstack/react-query'
import { fetchSystemHealth } from '../api/queries'
import Spinner from '../components/Spinner'

interface ServiceHealth {
  name: string
  status: 'ok' | 'degraded' | 'down'
  latency?: number
  message?: string
}

export default function MonitoringPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchSystemHealth,
    refetchInterval: 10_000,
  })

  if (isLoading) return <Spinner />

  const services = (data as { services?: ServiceHealth[] })?.services ?? []

  const statusColor = (s: string) =>
    s === 'ok' ? '#34d399' : s === 'degraded' ? '#fbbf24' : '#f87171'
  const statusIcon = (s: string) =>
    s === 'ok' ? 'bi-check-circle-fill' : s === 'degraded' ? 'bi-exclamation-circle-fill' : 'bi-x-circle-fill'

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Auto-refreshes every 10 seconds
      </p>
      <div className="row g-3">
        {services.map((svc: ServiceHealth) => (
          <div key={svc.name} className="col-12 col-md-6 col-xl-4">
            <div className="stat-card">
              <div className="d-flex align-items-center gap-3">
                <i className={`bi ${statusIcon(svc.status)}`} style={{ fontSize: '1.5rem', color: statusColor(svc.status) }} />
                <div className="flex-fill">
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{svc.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {svc.message ?? svc.status.toUpperCase()}
                    {svc.latency != null && <span className="ms-2">{svc.latency}ms</span>}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '0.2em 0.6em',
                  borderRadius: 20, background: `${statusColor(svc.status)}22`, color: statusColor(svc.status)
                }}>
                  {svc.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <div className="col-12 text-center py-5" style={{ color: 'var(--text-muted)' }}>
            <i className="bi bi-activity" style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }} />
            No monitoring data available
          </div>
        )}
      </div>
    </div>
  )
}
