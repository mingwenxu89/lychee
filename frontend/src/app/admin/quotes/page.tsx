'use client'

import { useEffect, useState } from 'react'

type Quote = { id: string; text: string; isActive: boolean }

const btnPrimary: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--primary)',
  color: 'white',
  fontWeight: 800,
  fontSize: 15,
  border: 'none',
  borderRadius: 999,
  padding: '14px 28px',
  boxShadow: 'none',
  cursor: 'pointer'
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 15,
  border: '2px solid var(--line)',
  borderRadius: 999,
  padding: '12px 26px',
  cursor: 'pointer'
}

const btnGhostSmall: React.CSSProperties = {
  background: 'transparent',
  border: '2px solid var(--line)',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 12.5,
  borderRadius: 999,
  padding: '8px 14px',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}

const iconButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: 'transparent',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer'
}

const textareaStyle: React.CSSProperties = {
  border: '2px solid var(--line)',
  borderRadius: 16,
  padding: '14px 16px',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--ink)',
  fontFamily: 'inherit',
  minHeight: 90,
  resize: 'vertical'
}

const labelStyle: React.CSSProperties = { fontWeight: 800, fontSize: 13, color: 'var(--ink-faint)' }

const headerRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 120px 160px',
  alignItems: 'center',
  padding: '14px 24px',
  background: 'oklch(96% 0.01 80)',
  borderBottom: '1px solid var(--line)',
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22
}

const headerCellStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--ink-faint)',
  letterSpacing: '0.03em',
  textTransform: 'uppercase'
}

function rowStyle(isLast: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '1fr 120px 160px',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: isLast ? 'none' : '1px solid var(--line)',
    borderBottomLeftRadius: isLast ? 22 : 0,
    borderBottomRightRadius: isLast ? 22 : 0
  }
}

const activePillStyle: React.CSSProperties = {
  background: 'var(--leaf-soft)',
  color: 'var(--leaf-dark)',
  fontWeight: 800,
  fontSize: 12,
  padding: '6px 14px',
  borderRadius: 999,
  width: 'fit-content'
}

const inactivePillStyle: React.CSSProperties = {
  background: 'oklch(93% 0.008 80)',
  color: 'var(--ink-faint)',
  fontWeight: 800,
  fontSize: 12,
  padding: '6px 14px',
  borderRadius: 999,
  width: 'fit-content'
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function QuoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--violet)" opacity="0.7">
      <path d="M7 7h5v5a5 5 0 0 1-5 5v-3a2 2 0 0 0 2-2H7z" />
      <path d="M14 7h5v5a5 5 0 0 1-5 5v-3a2 2 0 0 0 2-2h-2z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function DeleteConfirmPopover({
  error,
  onCancel,
  onConfirm
}: {
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        right: 24,
        width: 260,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        boxShadow: 'none',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 5
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>Delete this quote?</span>
        <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 600, lineHeight: 1.4 }}>This can&apos;t be undone.</span>
      </div>
      {error && (
        <span role="alert" style={{ fontSize: 12.5, color: 'var(--error)', fontWeight: 700 }}>
          {error}
        </span>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ ...btnGhostSmall, fontSize: 13, padding: '8px 16px' }}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{ background: 'var(--error)', color: 'white', fontWeight: 800, fontSize: 13, border: 'none', borderRadius: 999, padding: '8px 16px', boxShadow: 'none', cursor: 'pointer' }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function NewQuoteModal({
  text,
  onChange,
  onSubmit,
  onClose,
  error,
  isSaving
}: {
  text: string
  onChange: (text: string) => void
  onSubmit: (event: React.FormEvent) => void
  onClose: () => void
  error: string | null
  isSaving: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(22% 0.03 270 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <form
        onSubmit={onSubmit}
        style={{ width: 480, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 28, boxShadow: 'none', padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>New Quote</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-faint)', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="quote-text" style={labelStyle}>Quote</label>
          <textarea
            id="quote-text"
            required
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Nice work — every sentence counts!"
            style={textareaStyle}
          />
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0, fontSize: 14 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="submit" disabled={isSaving} style={btnPrimary}>
            {isSaving ? 'Saving...' : 'Add Quote'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function QuotesAdminPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [text, setText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function loadQuotes() {
    const response = await fetch('/api/admin/quotes')
    if (response.ok) {
      setQuotes(await response.json())
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadQuotes()
  }, [])

  function openModal() {
    setText('')
    setFormError(null)
    setIsModalOpen(true)
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setFormError(null)

    const response = await fetch('/api/admin/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })

    setIsSaving(false)
    if (!response.ok) {
      setFormError('Failed to create quote')
      return
    }
    setIsModalOpen(false)
    await loadQuotes()
  }

  async function toggleActive(quote: Quote) {
    await fetch(`/api/admin/quotes/${quote.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: quote.text, isActive: !quote.isActive })
    })
    await loadQuotes()
  }

  async function handleDelete(id: string) {
    setDeleteError(null)
    const response = await fetch(`/api/admin/quotes/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setDeleteError('Failed to delete quote')
      return
    }
    setConfirmingDeleteId(null)
    await loadQuotes()
  }

  return (
    <main style={{ padding: '24px 40px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Quotes</h1>
          <span style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 }}>Shown to learners after completing a practice</span>
        </div>
        <button onClick={openModal} style={btnPrimary}>
          <PlusIcon />
          New Quote
        </button>
      </div>

      {isLoading ? (
        <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</span>
      ) : quotes.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: '48px 24px', textAlign: 'center', color: 'var(--ink-soft)', fontWeight: 700 }}>
          No quotes yet. Add your first one to get started.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22 }}>
          <div style={headerRowStyle}>
            <span style={headerCellStyle}>Quote</span>
            <span style={headerCellStyle}>Status</span>
            <span style={{ ...headerCellStyle, textAlign: 'right' }}>Actions</span>
          </div>
          {quotes.map((quote, index) => (
            <div key={quote.id} style={{ position: 'relative', ...rowStyle(index === quotes.length - 1) }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 16, minWidth: 0 }}>
                <QuoteIcon />
                <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.4 }}>{quote.text}</span>
              </div>
              <span style={quote.isActive ? activePillStyle : inactivePillStyle}>
                {quote.isActive ? 'Active' : 'Inactive'}
              </span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => toggleActive(quote)} style={btnGhostSmall}>
                  {quote.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  aria-label="Delete quote"
                  onClick={() => {
                    setDeleteError(null)
                    setConfirmingDeleteId(quote.id)
                  }}
                  style={iconButtonStyle}
                >
                  <TrashIcon />
                </button>
              </div>

              {confirmingDeleteId === quote.id && (
                <DeleteConfirmPopover
                  error={deleteError}
                  onCancel={() => {
                    setConfirmingDeleteId(null)
                    setDeleteError(null)
                  }}
                  onConfirm={() => handleDelete(quote.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <NewQuoteModal
          text={text}
          onChange={setText}
          onSubmit={handleCreate}
          onClose={() => setIsModalOpen(false)}
          error={formError}
          isSaving={isSaving}
        />
      )}
    </main>
  )
}
