'use client'

import { useEffect, useState } from 'react'
import { SUPPORTED_TRANSLATION_LANGUAGES } from '@/lib/supportedTranslationLanguages'

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'oklch(22% 0.03 270 / 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100
}

const modalStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 28,
  boxShadow: 'none',
  padding: '36px 40px',
  width: 400,
  maxWidth: '92vw',
  display: 'flex',
  flexDirection: 'column',
  gap: 20
}

const selectStyle: React.CSSProperties = {
  border: '2px solid var(--line)',
  borderRadius: 14,
  padding: '12px 16px',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--ink)',
  fontFamily: 'inherit'
}

const btnPrimary: React.CSSProperties = {
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

export function TranslationLanguageModal({ onClose }: { onClose: () => void }) {
  const [languageCode, setLanguageCode] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/learner/preferences/translation-language')
      if (response.ok) {
        const data: { languageCode: string | null } = await response.json()
        setLanguageCode(data.languageCode ?? '')
      }
    }
    load()
  }, [])

  async function handleSave() {
    setIsSaving(true)
    try {
      await fetch('/api/learner/preferences/translation-language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languageCode: languageCode || null })
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Translation Language</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-faint)', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 }}>
          Shown alongside the English text in Full Listen and after checking a Sentence Dictation answer, when available for that track.
        </p>

        <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} style={selectStyle}>
          <option value="">None</option>
          {SUPPORTED_TRANSLATION_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.displayName}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={isSaving} style={btnPrimary}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
