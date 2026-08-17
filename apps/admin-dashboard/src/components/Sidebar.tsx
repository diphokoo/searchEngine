import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { section: 'Overview', items: [
    { to: '/', icon: 'bi-speedometer2', label: 'Dashboard' },
    { to: '/analytics', icon: 'bi-bar-chart-line', label: 'Analytics' },
  ]},
  { section: 'Events', items: [
    { to: '/events', icon: 'bi-calendar-event', label: 'All Events' },
    { to: '/events/review', icon: 'bi-clipboard-check', label: 'Review Queue' },
    { to: '/events/approved', icon: 'bi-check-circle', label: 'Approved' },
    { to: '/events/duplicates', icon: 'bi-copy', label: 'Duplicates' },
  ]},
  { section: 'Sources', items: [
    { to: '/sources', icon: 'bi-diagram-3', label: 'Source Registry' },
    { to: '/sources/discovery', icon: 'bi-search', label: 'Source Discovery' },
    { to: '/sources/review', icon: 'bi-shield-check', label: 'Source Review' },
  ]},
  { section: 'System', items: [
    { to: '/jobs', icon: 'bi-cpu', label: 'Job Queues' },
    { to: '/audit', icon: 'bi-journal-text', label: 'Audit Logs' },
    { to: '/monitoring', icon: 'bi-activity', label: 'Monitoring' },
    { to: '/settings', icon: 'bi-gear', label: 'Settings' },
  ]},
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <h5><i className="bi bi-music-note-beamed me-2" />SA Nightlife Intel</h5>
        <small>Event Intelligence Platform</small>
      </div>

      <div className="sidebar-nav">
        {navItems.map(({ section, items }) => (
          <div key={section}>
            <div className="nav-section-label">{section}</div>
            {items.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <i className={`bi ${icon}`} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--sidebar-border)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          <i className="bi bi-person-circle me-2" />
          {user?.name} <span className="badge bg-secondary ms-1" style={{ fontSize: '0.6rem' }}>{user?.role}</span>
        </div>
        <button className="btn btn-sm btn-outline-secondary w-100" onClick={logout}>
          <i className="bi bi-box-arrow-right me-1" />Sign Out
        </button>
      </div>
    </nav>
  )
}
