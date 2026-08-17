import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSources, updateSource, testSource, triggerSourceScan } from '../api/queries'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import Spinner from '../components/Spinner'

export default function SourcesPage() {
  const [page, setPage] = useState(1)
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['sources', page],
    queryFn: () => fetchSources({ page, pageSize: 20 }),
  })

  const testMut = useMutation({ mutationFn: testSource })
  const scanMut = useMutation({
    mutationFn: triggerSourceScan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }),
  })
  const toggleMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateSource(id, { status: status as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }),
  })

  return (
    <div>
      <div className="data-table">
        {isLoading ? <Spinner /> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Platform</th>
                    <th>Status</th>
                    <th>Reliability</th>
                    <th>Last Scan</th>
                    <th>Found</th>
                    <th>Imported</th>
                    <th>Errors</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map(src => (
                    <tr key={src.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{src.name}</div>
                        <a href={src.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {src.url.length > 40 ? src.url.slice(0, 40) + '…' : src.url}
                        </a>
                      </td>
                      <td>
                        <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>{src.platform}</span>
                      </td>
                      <td><StatusBadge status={src.status} /></td>
                      <td>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{src.reliabilityScore}</div>
                        <div className="confidence-bar mt-1" style={{ width: 60 }}>
                          <div className="confidence-fill confidence-high" style={{ width: `${src.reliabilityScore}%` }} />
                        </div>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {src.lastScan ? new Date(src.lastScan).toLocaleString() : '—'}
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{src.eventsFound}</td>
                      <td style={{ fontSize: '0.875rem' }}>{src.eventsImported}</td>
                      <td style={{ fontSize: '0.875rem', color: src.errorCount > 0 ? '#f87171' : 'inherit' }}>{src.errorCount}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            title="Test connector"
                            onClick={() => testMut.mutate(src.id)}
                            disabled={testMut.isPending}
                          >
                            <i className="bi bi-lightning" />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            title="Trigger scan"
                            onClick={() => scanMut.mutate(src.id)}
                            disabled={scanMut.isPending}
                          >
                            <i className="bi bi-arrow-clockwise" />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            title={src.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            onClick={() => toggleMut.mutate({
                              id: src.id,
                              status: src.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
                            })}
                          >
                            <i className={`bi ${src.status === 'ACTIVE' ? 'bi-pause' : 'bi-play'}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
