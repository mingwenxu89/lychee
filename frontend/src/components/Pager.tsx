const pagerButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 14,
  border: '2px solid var(--line)',
  borderRadius: 999,
  padding: '8px 18px',
  cursor: 'pointer'
}

export function Pager({
  page,
  pageSize,
  totalCount,
  onPageChange
}: {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  if (totalPages <= 1) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{ ...pagerButtonStyle, opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}
      >
        Previous
      </button>
      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-faint)' }}>
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={{ ...pagerButtonStyle, opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}
      >
        Next
      </button>
    </div>
  )
}
