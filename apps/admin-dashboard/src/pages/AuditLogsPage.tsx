import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAuditLogs } from '../api/queries'
import Pagination from '../components/Pagination'
import Spinner from '../components/Spinner'

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => fetchAuditLogs({ page, pageSize: 30 }),
  })

  return (
    <div className="data-table">
      {isLoading ? <Spinner /> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>{log.userName}</td>
                    <td>
                      <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>{log.action}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{log.entityType}</span>
                      <span className="ms-1" style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{log.entityId.slice(0, 8)}…</span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {JSON.stringify(log.details).slice(0, 60)}
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-5" style={{ color: 'var(--text-muted)' }}>No audit logs</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
