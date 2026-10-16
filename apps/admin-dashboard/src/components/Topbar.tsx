import { useLocation } from 'react-router-dom'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/mining': 'Data Mining',
  '/analytics': 'Analytics',
  '/events': 'All Events',
  '/events/review': 'Review Queue',
  '/events/approved': 'Approved Events',
  '/events/duplicates': 'Duplicate Events',
  '/sources': 'Source Registry',
  '/sources/discovery': 'Source Discovery',
  '/sources/review': 'Source Review',
  '/jobs': 'Job Queues',
  '/audit': 'Audit Logs',
  '/monitoring': 'System Monitoring',
  '/settings': 'Settings',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'Event Intelligence'

  return (
    <div className="topbar">
      <h6 style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>{title}</h6>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-circle-fill text-success me-1" style={{ fontSize: '0.5rem' }} />
          System Online
        </span>
      </div>
    </div>
  )
}
