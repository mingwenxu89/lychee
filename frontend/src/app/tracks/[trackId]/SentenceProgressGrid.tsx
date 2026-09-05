'use client'

// Shared by SentencePracticeView and FullDictationView so their "jump to any sentence" side
// panels stay visually identical by construction — one place to change the grid's colors,
// sizing, or copy instead of two.
export type SentenceProgressStatus = 'current' | 'correct' | 'touched' | 'untouched'

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  boxShadow: 'none'
}

export function SentenceProgressGrid({
  count,
  getStatus,
  onJump,
  disabled = false
}: {
  count: number
  getStatus: (index: number) => SentenceProgressStatus
  onJump: (index: number) => void
  disabled?: boolean
}) {
  return (
    <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...cardStyle, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-soft)' }}>Progress</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {Array.from({ length: count }, (_, i) => {
            const status = getStatus(i)
            const digitCount = String(i + 1).length
            return (
              <button
                key={i}
                onClick={() => onJump(i)}
                disabled={disabled}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  cursor: disabled ? 'default' : 'pointer',
                  fontWeight: 800,
                  fontSize: digitCount >= 3 ? 9 : 12,
                  background:
                    status === 'current' ? 'var(--surface)'
                    : status === 'correct' ? 'var(--leaf)'
                    : status === 'touched' ? 'var(--primary-soft)'
                    : 'transparent',
                  border: status === 'current' ? '3px solid var(--primary)' : '2px solid var(--line)',
                  color: status === 'current' ? 'var(--primary)' : status === 'correct' ? 'white' : 'var(--ink-soft)'
                }}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>Tap any sentence to jump straight to it</span>
      </div>
    </div>
  )
}
