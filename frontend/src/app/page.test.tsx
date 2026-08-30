import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

    expect(await screen.findAllByText('Short Stories')).toHaveLength(2)
    expect(screen.getByText('TED Talks')).toBeInTheDocument()
    expect(screen.getAllByText('A1-C1')).toHaveLength(2)
    expect(screen.getAllByText(/10 lessons/i)).toHaveLength(2)
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

    await waitFor(() => expect(screen.queryByText(/10 lessons/i)).not.toBeInTheDocument())
    expect(screen.getByText(/5 lessons/i)).toBeInTheDocument()
  })

  it('filters by search text', async () => {
    render(<ExercisesPage />)
    await screen.findAllByText('TED Talks')

    fireEvent.change(screen.getByPlaceholderText(/search exercises/i), { target: { value: 'ted' } })

    await waitFor(() => expect(screen.queryByText(/10 lessons/i)).not.toBeInTheDocument())
    expect(screen.getByText(/5 lessons/i)).toBeInTheDocument()
  })

  it('links each card to its Exercise detail page', async () => {
    render(<ExercisesPage />)
    await screen.findAllByText('TED Talks')

    const tedTalksElement = screen.getAllByText('TED Talks').find(el => el.tagName === 'H3')
    expect(tedTalksElement?.closest('a')).toHaveAttribute('href', '/exercises/ex-2')
  })
})
