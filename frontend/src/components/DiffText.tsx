export type WordDiff = { word: string; status: 'Correct' | 'Incorrect' | 'Missing' | 'Extra' }

const STATUS_COLOR: Record<WordDiff['status'], string> = {
  Correct: 'var(--leaf-dark)',
  Incorrect: 'var(--error)',
  Missing: 'var(--ink-faint)',
  Extra: 'var(--gold)'
}

export function DiffText({ words }: { words: WordDiff[] }) {
  return (
    <span>
      {words.map((w, i) => (
        <span
          key={i}
          data-status={w.status}
          style={{ color: STATUS_COLOR[w.status], marginRight: 6, textDecoration: w.status === 'Missing' ? 'line-through' : 'none' }}
        >
          {w.word}
        </span>
      ))}
    </span>
  )
}
