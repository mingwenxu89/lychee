import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import ExercisesPage from './page'

const exercises = [
  { id: 'ex-1', title: 'Short Stories', category: 'Short Stories', difficultyRangeLabel: 'A1-C1', trackCount: 10, completedTrackCount: 2, lastPracticedAt: '2026-08-30T00:00:00Z' },
  { id: 'ex-2', title: 'TED Talks', category: 'TED Talks', difficultyRangeLabel: 'C1-C2', trackCount: 5, completedTrackCount: 0, lastPracticedAt: null }
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(exercises), { status: 200 })))
})

describe('ExercisesPage', () => {
  it('lists every exercise with its difficulty range and lesson count', async () => {
    render(<ExercisesPage />)

    const shortStoriesCards = (await screen.findAllByText('Short Stories')).filter(el => el.tagName === 'H3')
    expect(shortStoriesCards.length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText('TED Talks').filter(el => el.tagName === 'H3').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText('A1-C1').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText(/10 lessons/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows a recently-practiced ribbon only for exercises with practice history', async () => {
    render(<ExercisesPage />)
    await screen.findAllByText('Short Stories')

    expect(screen.getAllByText('Short Stories').length).toBeGreaterThan(1) // once in the ribbon, once in the grid
  })

  it('filters by category chip', async () => {
    render(<ExercisesPage />)
    await screen.findAllByText('TED Talks')

    fireEvent.click(screen.getByRole('button', { name: /^ted talks$/i }))

    // After filtering by TED Talks, only TED Talks exercises should appear in the grid
    // (the ribbon still shows all recently practiced, but we verify the grid is filtered)
    const grid = screen.getByTestId('exercise-grid')
    await waitFor(() => {
      expect(within(grid).getByText('TED Talks')).toBeInTheDocument()
    })
    expect(within(grid).getByText(/5 lessons/i)).toBeInTheDocument()
    // Short Stories has trackCount 10 and a non-null lastPracticedAt, so it still
    // appears in the ribbon, but must be gone from the filtered grid.
    expect(within(grid).queryByText('Short Stories')).not.toBeInTheDocument()
    expect(screen.getAllByText('Short Stories').length).toBeGreaterThanOrEqual(1) // still in the ribbon
  })

  it('filters by search text', async () => {
    render(<ExercisesPage />)
    await screen.findAllByText('TED Talks')

    fireEvent.change(screen.getByPlaceholderText(/search exercises/i), { target: { value: 'ted' } })

    // After searching for 'ted', only TED Talks exercises should appear in the grid
    // (the ribbon still shows all recently practiced, but we verify the grid is filtered)
    const grid = screen.getByTestId('exercise-grid')
    await waitFor(() => {
      expect(within(grid).getByText('TED Talks')).toBeInTheDocument()
    })
    expect(within(grid).getByText(/5 lessons/i)).toBeInTheDocument()
    // Short Stories has trackCount 10 and a non-null lastPracticedAt, so it still
    // appears in the ribbon, but must be gone from the filtered grid.
    expect(within(grid).queryByText('Short Stories')).not.toBeInTheDocument()
    expect(screen.getAllByText('Short Stories').length).toBeGreaterThanOrEqual(1) // still in the ribbon
  })

  it('links each card to its Exercise detail page', async () => {
    render(<ExercisesPage />)
    await screen.findAllByText('TED Talks')

    const tedTalksElement = screen.getAllByText('TED Talks').find(el => el.tagName === 'H3')
    expect(tedTalksElement?.closest('a')).toHaveAttribute('href', '/exercises/ex-2')
  })
})
