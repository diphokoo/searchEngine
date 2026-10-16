import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Spinner from './components/Spinner'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import ReviewQueuePage from './pages/ReviewQueuePage'
import SourcesPage from './pages/SourcesPage'
import JobQueuesPage from './pages/JobQueuesPage'
import AuditLogsPage from './pages/AuditLogsPage'
import MonitoringPage from './pages/MonitoringPage'
import DataMiningPage from './pages/DataMiningPage'

function ProtectedLayout() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />

  return (
    <>
      <Sidebar />
      <div className="main-layout">
        <Topbar />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/mining" element={<DataMiningPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/events/review" element={<ReviewQueuePage />} />
            <Route path="/events/approved" element={<EventsPage />} />
            <Route path="/events/duplicates" element={<EventsPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/sources/discovery" element={<SourcesPage />} />
            <Route path="/sources/review" element={<SourcesPage />} />
            <Route path="/jobs" element={<JobQueuesPage />} />
            <Route path="/audit" element={<AuditLogsPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
            <Route path="/analytics" element={<DashboardPage />} />
            <Route path="/settings" element={<div className="stat-card"><p style={{ color: 'var(--text-muted)' }}>Settings — coming in Phase 5</p></div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
