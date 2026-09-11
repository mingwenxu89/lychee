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

// The dictation variant never shows the learner's own extra word (there's no reference-text
// slot to put it in) — but silently dropping it left an interior insertion completely
// invisible: with every reference word otherwise Correct, the diff looked fully right even
// though the sentence wasn't an exact match (an Extra word *inside* the reference breaks
// computeIsExactMatch's contiguity check the same as a wrong word would). This flags the next
// reference word instead, as the closest visible anchor to where the insertion happened.
// Leading/trailing extras are left alone — computeIsExactMatch already allows those, so they
// never cause a diff box to show up in the first place.
function flagInteriorExtras(list: WordDiff[]): WordDiff[] {
  const hasCorrectAfter: boolean[] = new Array(list.length).fill(false)
  for (let i = list.length - 1, seenCorrect = false; i >= 0; i--) {
    hasCorrectAfter[i] = seenCorrect
    if (list[i].status === 'Correct') seenCorrect = true
  }

  const result: WordDiff[] = []
  let seenCorrect = false
  let flagNextWord = false
  for (let i = 0; i < list.length; i++) {
    const w = list[i]
    if (w.status === 'Extra') {
      if (seenCorrect && hasCorrectAfter[i]) flagNextWord = true
      continue
    }
    if (w.status === 'Correct') seenCorrect = true
    result.push(flagNextWord ? { word: w.word, status: 'Incorrect' } : w)
    flagNextWord = false
  }
  return result
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
  // An empty word happens when textComparer split a word (a contraction like "I'm" -> "i" + "am",
  // or a hyphenated compound like "four-day" -> "four" + "day") for comparison purposes but only
  // attached the real surface text — plus whatever separator originally followed it — to the
  // first part, so the second part has nothing to show. Skip it entirely rather than rendering a
  // blank span.
  const nonEmptyWords = words.filter((w) => w.word !== '')
  const visibleWords = variant === 'dictation' ? flagInteriorExtras(nonEmptyWords) : nonEmptyWords
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
      {visibleWords.map((w, i) => {
        // w.word already carries the *exact* original text that followed this word (see
        // textComparer's tokenizeAndExpand) — a plain space in the common case, but whatever the
        // reference actually had there (a hyphen, an em dash, a doubled space, ...). No separator
        // is synthesized here; concatenating every word's own text back-to-back reproduces the
        // original string exactly, character for character, rather than rebuilding it from a
        // fixed idea of what a "word boundary" looks like — which is exactly the kind of gap that
        // let earlier bugs (a dropped hyphen, a dropped apostrophe) drop symbols from what was
        // shown. Only trailing *whitespace* is pulled out of the colored/highlighted span — for
        // a Missing word's background+padding, that keeps the highlight from visually swallowing
        // the space before the next word — everything else (the word's own attached punctuation,
        // any non-whitespace separator) stays inside the styled span, exactly as written.
        const trimmed = w.word.replace(/\s+$/, '')
        const trailingWhitespace = w.word.slice(trimmed.length)
        return (
          <span key={i}>
            <span data-status={w.status} style={resolvedStyle(w, i)}>{trimmed}</span>
            {trailingWhitespace}
          </span>
        )
      })}
    </span>
  )
}
