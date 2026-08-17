import { useQuery } from '@tanstack/react-query'
import { fetchJobQueues } from '../api/queries'
import Spinner from '../components/Spinner'

interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export default function JobQueuesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['job-queues'],
    queryFn: fetchJobQueues,
    refetchInterval: 5000,
  })

  if (isLoading) return <Spinner />

  const queues = (data as { queues?: QueueStats[] })?.queues ?? []

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Auto-refreshes every 5 seconds
      </p>
      <div className="row g-3">
        {queues.map((q: QueueStats) => (
          <div key={q.name} className="col-12 col-md-6 col-xl-4">
            <div className="stat-card">
              <h6 style={{ fontWeight: 600, marginBottom: '1rem', textTransform: 'capitalize' }}>
                <i className="bi bi-cpu me-2" style={{ color: 'var(--accent-light)' }} />
                {q.name.replace(/-/g, ' ')}
              </h6>
              <div className="row g-2">
                {[
                  { label: 'Waiting', value: q.waiting, color: '#fbbf24' },
                  { label: 'Active', value: q.active, color: '#60a5fa' },
                  { label: 'Completed', value: q.completed, color: '#34d399' },
                  { label: 'Failed', value: q.failed, color: '#f87171' },
                  { label: 'Delayed', value: q.delayed, color: '#fb923c' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="col-4">
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {queues.length === 0 && (
          <div className="col-12 text-center py-5" style={{ color: 'var(--text-muted)' }}>
            <i className="bi bi-cpu" style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }} />
            No queue data available
          </div>
        )}
      </div>
    </div>
  )
}
