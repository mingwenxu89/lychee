'use client'

import { useEffect, useState } from 'react'

const btnPrimary: React.CSSProperties = {
  background: 'var(--primary)',
  color: 'white',
  fontWeight: 800,
  fontSize: 16,
  border: 'none',
  borderRadius: 999,
  padding: '14px 32px',
  boxShadow: 'none',
  cursor: 'pointer'
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 16,
  border: '2px solid var(--line)',
  borderRadius: 999,
  padding: '12px 28px',
  cursor: 'pointer'
}

export function CompletionPage({
  accuracyScore,
  hasNextTrack,
  onPracticeAgain,
  onNextTrack
}: {
  accuracyScore: number
  hasNextTrack: boolean
  onPracticeAgain: () => void
  onNextTrack: () => void
}) {
  const [quote, setQuote] = useState<string | null>(null)

  useEffect(() => {
    async function loadQuote() {
      const response = await fetch('/api/learner/quotes/random')
      if (response.ok) {
        const data = await response.json()
        setQuote(data.text)
      }
    }
    loadQuote()
  }, [])

  return (
    <div
      style={{
        width: 560,
        maxWidth: '92vw',
        background: 'var(--surface)',
        borderRadius: 32,
        boxShadow: 'none',
        padding: '44px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 22
      }}
    >
      <svg width="96" height="96" viewBox="0 0 38 38" fill="none">
        <circle cx="19" cy="20" r="15" fill="var(--primary)" />
        <circle cx="13" cy="15" r="2.4" fill="white" opacity="0.85" />
        <path d="M19 6c1.8-3.4 4.6-5 7-4.4" stroke="var(--leaf)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M14 20c1-1.4 3-1.4 4 0M20 20c1-1.4 3-1.4 4 0" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M14 26c2.4 2.4 7.6 2.4 10 0" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </svg>

      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--primary-dark)' }}>Nice work!</h2>

      <div
        style={{
          background: 'oklch(96% 0.01 80)',
          borderRadius: 16,
          padding: '14px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'center'
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{Math.round(accuracyScore * 100)}%</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-faint)' }}>Accuracy</span>
      </div>

      {quote && (
        <div style={{ background: 'var(--leaf-soft)', borderRadius: 18, padding: '20px 24px', width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--leaf-dark)" opacity="0.5"><path d="M7 7h5v5a5 5 0 0 1-5 5v-3a2 2 0 0 0 2-2H7z" /><path d="M14 7h5v5a5 5 0 0 1-5 5v-3a2 2 0 0 0 2-2h-2z" /></svg>
          <span style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: 'var(--leaf-dark)', lineHeight: 1.5 }}>
            &quot;<span>{quote}</span>&quot;
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
        <button onClick={onPracticeAgain} style={btnGhost}>Practice Again</button>
        {hasNextTrack ? (
          <button onClick={onNextTrack} style={btnPrimary}>Next Track</button>
        ) : (
          <button onClick={onNextTrack} style={btnPrimary}>Back to Exercise</button>
        )}
      </div>
    </div>
  )
}
