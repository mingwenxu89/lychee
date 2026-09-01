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

  it('in the dictation variant, colors correct words green, leaves mismatches plain black, and hides Extra words', () => {
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

    expect(screen.getByText('I')).toHaveStyle({ color: 'var(--leaf-dark)' })
    expect(screen.getByText('first')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.getByText('the')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.queryByText('extra')).not.toBeInTheDocument()
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
