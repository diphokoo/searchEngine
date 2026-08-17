interface Props {
  page: number
  totalPages: number
  onPage: (p: number) => void
}

export default function Pagination({ page, totalPages, onPage }: Props) {
  if (totalPages <= 1) return null
  return (
    <div className="d-flex justify-content-center align-items-center gap-2 py-3">
      <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <i className="bi bi-chevron-left" />
      </button>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Page {page} of {totalPages}
      </span>
      <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        <i className="bi bi-chevron-right" />
      </button>
    </div>
  )
}
