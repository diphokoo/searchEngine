import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { fetchStats, fetchChartData } from '../api/queries'
import Spinner from '../components/Spinner'

const COLORS = ['#7c3aed', '#34d399', '#fbbf24', '#60a5fa', '#f87171', '#fb923c', '#a78bfa', '#4ade80']

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <div className="stat-value" style={{ color }}>{value.toLocaleString()}</div>
          <div className="stat-label">{label}</div>
        </div>
        <i className={`bi ${icon}`} style={{ fontSize: '1.5rem', color, opacity: 0.6 }} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['stats'], queryFn: fetchStats })
  const { data: timelineData } = useQuery({ queryKey: ['chart', 'timeline'], queryFn: () => fetchChartData('timeline') })
  const { data: provinceData } = useQuery({ queryKey: ['chart', 'province'], queryFn: () => fetchChartData('province') })
  const { data: genreData } = useQuery({ queryKey: ['chart', 'genre'], queryFn: () => fetchChartData('genre') })

  if (isLoading) return <Spinner />

  const s = stats!

  return (
    <div>
      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Total Events', value: s.totalEvents, icon: 'bi-calendar-event', color: '#a78bfa' },
          { label: 'New Today', value: s.newToday, icon: 'bi-plus-circle', color: '#34d399' },
          { label: 'Needs Review', value: s.needsReview, icon: 'bi-exclamation-circle', color: '#fbbf24' },
          { label: 'Verified', value: s.verified, icon: 'bi-shield-check', color: '#60a5fa' },
          { label: 'Approved', value: s.approved, icon: 'bi-check-circle', color: '#a78bfa' },
          { label: 'Rejected', value: s.rejected, icon: 'bi-x-circle', color: '#f87171' },
          { label: 'Active Sources', value: s.activeSources, icon: 'bi-diagram-3', color: '#34d399' },
          { label: 'Failed Sources', value: s.failedSources, icon: 'bi-exclamation-triangle', color: '#f87171' },
        ].map(c => (
          <div key={c.label} className="col-6 col-md-4 col-xl-3">
            <StatCard {...c} />
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-8">
          <div className="chart-card">
            <h6>Events Discovered Over Time</h6>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timelineData ?? []}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid #252840', borderRadius: 8, color: '#e2e8f0' }} />
                <Area type="monotone" dataKey="value" stroke="#7c3aed" fill="url(#grad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="col-12 col-lg-4">
          <div className="chart-card">
            <h6>Events by Province</h6>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={provinceData ?? []} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ label }) => label}>
                  {(provinceData ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid #252840', borderRadius: 8, color: '#e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="chart-card">
            <h6>Events by Genre</h6>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={genreData ?? []} layout="vertical">
                <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid #252840', borderRadius: 8, color: '#e2e8f0' }} />
                <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="chart-card">
            <h6>Verification Success Rate</h6>
            <div className="d-flex flex-column gap-2 mt-2">
              {[
                { label: 'Approved', pct: s.totalEvents ? Math.round(s.approved / s.totalEvents * 100) : 0, color: '#a78bfa' },
                { label: 'Verified', pct: s.totalEvents ? Math.round(s.verified / s.totalEvents * 100) : 0, color: '#34d399' },
                { label: 'Needs Review', pct: s.totalEvents ? Math.round(s.needsReview / s.totalEvents * 100) : 0, color: '#fbbf24' },
                { label: 'Rejected', pct: s.totalEvents ? Math.round(s.rejected / s.totalEvents * 100) : 0, color: '#f87171' },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color }}>{pct}%</span>
                  </div>
                  <div className="confidence-bar">
                    <div className="confidence-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
