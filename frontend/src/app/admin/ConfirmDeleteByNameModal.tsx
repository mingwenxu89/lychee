'use client'

import { useState } from 'react'

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

const inputStyle: React.CSSProperties = {
  border: '2px solid var(--line)',
  borderRadius: 14,
  padding: '12px 16px',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--ink)',
  fontFamily: 'inherit'
}

const labelStyle: React.CSSProperties = { fontWeight: 800, fontSize: 13, color: 'var(--ink-faint)' }

export function ConfirmDeleteByNameModal({
  kind,
  name,
  onCancel,
  onConfirm,
  error,
  isDeleting
}: {
  kind: string
  name: string
  onCancel: () => void
  onConfirm: () => void
  error: string | null
  isDeleting: boolean
}) {
  const [typedName, setTypedName] = useState('')
  const matches = typedName === name

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (matches) onConfirm()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(22% 0.03 270 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <form
        onSubmit={handleSubmit}
        style={{ width: 460, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 28, boxShadow: 'none', padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Delete this {kind}?</h2>
          <span style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600, lineHeight: 1.5 }}>
            This permanently deletes &quot;{name}&quot; and everything inside it — including all units, tracks, sentences, and audio files — and can&apos;t be undone.
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="confirm-delete-name" style={labelStyle}>
            Type &quot;{name}&quot; to confirm
          </label>
          <input
            id="confirm-delete-name"
            autoFocus
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={name}
            style={inputStyle}
          />
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0, fontSize: 14 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onCancel} style={btnGhost}>Cancel</button>
          <button
            type="submit"
            disabled={!matches || isDeleting}
            style={{
              background: 'var(--error)',
              color: 'white',
              fontWeight: 800,
              fontSize: 15,
              border: 'none',
              borderRadius: 999,
              padding: '12px 26px',
              boxShadow: 'none',
              cursor: matches && !isDeleting ? 'pointer' : 'default',
              opacity: matches ? 1 : 0.5
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </form>
    </div>
  )
}
