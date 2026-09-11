import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DiffText } from './DiffText'

describe('DiffText', () => {
  it('renders every word and marks each status distinctly', () => {
    render(
      <DiffText
        words={[
          { word: 'I', status: 'Correct' },
          { word: 'first', status: 'Incorrect' },
          { word: 'the', status: 'Missing' },
          { word: 'extra', status: 'Extra' }
        ]}
      />
    )

    expect(screen.getByText('I')).toHaveAttribute('data-status', 'Correct')
    expect(screen.getByText('first')).toHaveAttribute('data-status', 'Incorrect')
    expect(screen.getByText('the')).toHaveAttribute('data-status', 'Missing')
    expect(screen.getByText('extra')).toHaveAttribute('data-status', 'Extra')
  })

  it('in the dictation variant, colors correct words black, flags mismatches bold red, and hides Extra words', () => {
    render(
      <DiffText
        variant="dictation"
        words={[
          { word: 'I', status: 'Correct' },
          { word: 'first', status: 'Incorrect' },
          { word: 'the', status: 'Missing' },
          { word: 'extra', status: 'Extra' }
        ]}
      />
    )

    expect(screen.getByText('I')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.getByText('first')).toHaveStyle({ color: 'var(--error)', fontWeight: '700' })
    expect(screen.getByText('the')).toHaveStyle({ color: 'var(--error)', fontWeight: '700' })
    expect(screen.queryByText('extra')).not.toBeInTheDocument()
  })

  it('in the dictation variant, an Extra word inserted between two otherwise-correct words flags the next word red instead of vanishing without a trace', () => {
    render(
      <DiffText
        variant="dictation"
        words={[
          { word: 'I', status: 'Correct' },
          { word: 'really', status: 'Extra' },
          { word: 'saw', status: 'Correct' },
          { word: 'snow', status: 'Correct' }
        ]}
      />
    )

    expect(screen.queryByText('really')).not.toBeInTheDocument()
    // "saw" is otherwise a perfectly correct word, but since it's the closest visible word to
    // where the extra "really" was inserted, it's the one that gets flagged as the error.
    expect(screen.getByText('saw')).toHaveStyle({ color: 'var(--error)', fontWeight: '700' })
    expect(screen.getByText('snow')).toHaveStyle({ color: 'var(--ink)' })
  })

  it('in the dictation variant, a leading Extra word (before the first reference word) is still hidden with no word flagged', () => {
    render(
      <DiffText
        variant="dictation"
        words={[
          { word: 'well', status: 'Extra' },
          { word: 'I', status: 'Correct' },
          { word: 'saw', status: 'Correct' }
        ]}
      />
    )

    expect(screen.queryByText('well')).not.toBeInTheDocument()
    expect(screen.getByText('I')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.getByText('saw')).toHaveStyle({ color: 'var(--ink)' })
  })

  it('in the dictation variant, a trailing Extra word (after the last reference word) is still hidden with no word flagged', () => {
    render(
      <DiffText
        variant="dictation"
        words={[
          { word: 'I', status: 'Correct' },
          { word: 'saw', status: 'Correct' },
          { word: 'snow', status: 'Correct' },
          { word: 'yesterday', status: 'Extra' }
        ]}
      />
    )

    expect(screen.queryByText('yesterday')).not.toBeInTheDocument()
    expect(screen.getByText('I')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.getByText('saw')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.getByText('snow')).toHaveStyle({ color: 'var(--ink)' })
  })

  it('with firstMismatchOnly, flags only the first Incorrect/Missing word and renders later mismatches as plain text', () => {
    render(
      <DiffText
        variant="dictation"
        firstMismatchOnly
        words={[
          { word: 'I', status: 'Correct' },
          { word: 'first', status: 'Incorrect' },
          { word: 'the', status: 'Missing' },
          { word: 'snow', status: 'Correct' }
        ]}
      />
    )

    // "first" is the earliest mismatch, so it alone gets flagged.
    expect(screen.getByText('first')).toHaveStyle({ color: 'var(--error)', fontWeight: '700' })
    // "the" is a later mismatch — rendered plain, same as a Correct word, not flagged again.
    expect(screen.getByText('the')).toHaveStyle({ color: 'var(--ink)' })
    // The real status is still exposed via data-status even though the display style is downgraded.
    expect(screen.getByText('the')).toHaveAttribute('data-status', 'Missing')
    expect(screen.getByText('I')).toHaveStyle({ color: 'var(--ink)' })
  })

  it('skips an empty-display word with no extra space (e.g. the unattached second half of an expanded contraction like "I\'m")', () => {
    // textComparer bakes the original trailing separator onto the *first* part of a split word
    // (see tokenizeAndExpand) — DiffText no longer inserts a space of its own, so this fixture
    // includes the trailing space on "I'm" itself, exactly as compare() would produce it.
    const { container } = render(
      <DiffText
        words={[
          { word: "I'm ", status: 'Correct' },
          { word: '', status: 'Correct' },
          { word: 'ready', status: 'Correct' }
        ]}
      />
    )

    expect(container.textContent).toBe("I'm ready")
  })

  it('separates words with a real space character so the text is copyable, not just visually spaced by CSS', () => {
    // Each word's own trailing space is baked into its text (matching what compare() actually
    // produces) — DiffText concatenates them with no separator of its own.
    const { container } = render(
      <DiffText
        words={[
          { word: 'I ', status: 'Correct' },
          { word: 'saw ', status: 'Correct' },
          { word: 'snow', status: 'Correct' }
        ]}
      />
    )

    expect(container.textContent).toBe('I saw snow')
  })
})
