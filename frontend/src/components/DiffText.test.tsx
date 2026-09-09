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
    const { container } = render(
      <DiffText
        words={[
          { word: "I'm", status: 'Correct' },
          { word: '', status: 'Correct' },
          { word: 'ready', status: 'Correct' }
        ]}
      />
    )

    expect(container.textContent).toBe("I'm ready")
  })

  it('separates words with a real space character so the text is copyable, not just visually spaced by CSS', () => {
    const { container } = render(
      <DiffText
        words={[
          { word: 'I', status: 'Correct' },
          { word: 'saw', status: 'Correct' },
          { word: 'snow', status: 'Correct' }
        ]}
      />
    )

    expect(container.textContent).toBe('I saw snow')
  })
})
