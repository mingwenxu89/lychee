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

// The sentence-dictation view wants a simpler read: a matched word is plain
// black text, a wrong/skipped word is bold red, and anything the learner
// typed beyond the reference sentence isn't shown at all rather than struck
// through. (With `firstMismatchOnly`, only the first wrong/skipped word keeps
// this red styling — see below.)
function dictationWordStyle(status: WordDiff['status']): React.CSSProperties {
  switch (status) {
    case 'Correct':
      return { color: 'var(--ink)' }
    case 'Incorrect':
    case 'Missing':
      return { color: 'var(--error)', fontWeight: 700 }
    case 'Extra':
      return {}
  }
}

export function DiffText({
  words,
  variant = 'default',
  correctColor,
  incorrectColor,
  firstMismatchOnly = false
}: {
  words: WordDiff[]
  variant?: 'default' | 'dictation'
  // Override the dictation variant's "Correct"/"Incorrect"+"Missing" word colors for callers
  // that want their own palette (e.g. Full Dictation's result screens, which distinguish right
  // from wrong purely by color, no checkmark) without changing every other DiffText usage.
  correctColor?: string
  incorrectColor?: string
  // Dictation variant only: flag just the first Incorrect/Missing word instead of every one,
  // so the learner sees where they first went wrong without every later mismatch also
  // lighting up red. Later mismatches render as plain text, same as a Correct word.
  firstMismatchOnly?: boolean
}) {
  // An empty word happens when textComparer split a contraction (e.g. "I'm" -> "i" + "am")
  // for comparison purposes but only attached the real surface text to the first part, so the
  // second part has nothing to show — skip it entirely rather than rendering a blank span with
  // its own space, which would show up as an awkward double space.
  const nonEmptyWords = words.filter((w) => w.word !== '')
  const visibleWords = variant === 'dictation' ? nonEmptyWords.filter((w) => w.status !== 'Extra') : nonEmptyWords
  const styleFor = variant === 'dictation' ? dictationWordStyle : wordStyle

  const firstMismatchIndex = firstMismatchOnly
    ? visibleWords.findIndex((w) => w.status === 'Incorrect' || w.status === 'Missing')
    : -1

  function resolvedStyle(word: WordDiff, index: number): React.CSSProperties {
    const isMismatch = word.status === 'Incorrect' || word.status === 'Missing'
    const displayStatus = isMismatch && firstMismatchOnly && index !== firstMismatchIndex ? 'Correct' : word.status
    const base = styleFor(displayStatus)
    if (correctColor && displayStatus === 'Correct') return { ...base, color: correctColor }
    if (incorrectColor && (displayStatus === 'Incorrect' || displayStatus === 'Missing')) return { ...base, color: incorrectColor }
    return base
  }

  return (
    <span>
      {visibleWords.map((w, i) => (
        // The gap between words is a real space character, not CSS margin, so
        // selecting and copying this text reproduces actual spaces rather than
        // running every word together.
        <span key={i}>
          <span data-status={w.status} style={resolvedStyle(w, i)}>{w.word}</span>
          {i < visibleWords.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}
