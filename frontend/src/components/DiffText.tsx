export type WordDiff = { word: string; status: 'Correct' | 'Incorrect' | 'Missing' | 'Extra' }

// Matches the mockups' word-diff language: a correct word looks like plain text
// (no color needed for the common case), a wrong/skipped word is flagged in red,
// and an extra/inserted word gets a distinct gold flag. Unlike the mockups' own
// "struck-through wrong word → arrow → correct word" pairing, the backend only
// returns one word per diff entry (the reference word, for Incorrect/Missing —
// not what the learner actually typed), so there is no second word to show after
// an arrow here.
function wordStyle(status: WordDiff['status']): React.CSSProperties {
  switch (status) {
    case 'Correct':
      return { color: 'var(--ink)' }
    case 'Incorrect':
      return { color: 'var(--error)', fontWeight: 700 }
    case 'Missing':
      return { color: 'var(--error)', fontWeight: 700, background: 'oklch(94% 0.04 18)', borderRadius: 5, padding: '0 4px' }
    case 'Extra':
      return { color: 'var(--gold)', fontWeight: 700, textDecoration: 'line-through' }
  }
}

// The sentence-dictation view wants a simpler read: a matched word is green,
// anything that didn't match (wrong or skipped) is plain black text with no
// special flagging, and anything the learner typed beyond the reference
// sentence isn't shown at all rather than struck through.
function dictationWordStyle(status: WordDiff['status']): React.CSSProperties {
  switch (status) {
    case 'Correct':
      return { color: 'var(--leaf-dark)' }
    case 'Incorrect':
    case 'Missing':
      return { color: 'var(--ink)' }
    case 'Extra':
      return {}
  }
}

export function DiffText({ words, variant = 'default' }: { words: WordDiff[]; variant?: 'default' | 'dictation' }) {
  const visibleWords = variant === 'dictation' ? words.filter((w) => w.status !== 'Extra') : words
  const styleFor = variant === 'dictation' ? dictationWordStyle : wordStyle

  return (
    <span>
      {visibleWords.map((w, i) => (
        <span key={i} data-status={w.status} style={{ ...styleFor(w.status), marginRight: 6 }}>
          {w.word}
        </span>
      ))}
    </span>
  )
}
