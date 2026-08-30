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
})
