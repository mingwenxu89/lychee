import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ exerciseId: 'ex-1' })
}))

import ExerciseDetailPage from './page'

const detail = {
  id: 'ex-1', title: 'Short Stories', description: 'Cozy short stories',
  units: [
    {
      id: 'unit-1', title: 'Unit 1', order: 1,
      tracks: [
        { id: 'track-1', title: 'The First Snowfall', description: 'A quiet winter morning.', level: 'A1', duration: '00:03:12', sentenceCount: 21, wordsPerMinute: 118, isCompletedByUser: true },
        { id: 'track-2', title: 'At the Coffee Shop', description: null, level: 'A2', duration: '00:02:40', sentenceCount: 14, wordsPerMinute: 132, isCompletedByUser: false }
      ]
    },
    {
      id: 'unit-2', title: 'Unit 2', order: 2,
      tracks: [
        { id: 'track-3', title: 'The Power of Learning', description: null, level: 'B1', duration: '00:04:00', sentenceCount: 32, wordsPerMinute: 145, isCompletedByUser: false }
      ]
    }
  ]
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 })))
})

describe('ExerciseDetailPage', () => {
  it('shows a breadcrumb with Exercises linking back and the Exercise title as the current page', async () => {
    render(<ExerciseDetailPage />)

    expect(await screen.findByText('Exercises')).toHaveAttribute('href', '/')
    expect(screen.getByText('Short Stories')).toBeInTheDocument()
    expect(screen.getByText('Short Stories').closest('a')).toBeNull()
  })

  it('expands the first Unit by default and keeps later Units collapsed', async () => {
    render(<ExerciseDetailPage />)

    expect(await screen.findByText('The First Snowfall')).toBeInTheDocument()
    expect(screen.queryByText('The Power of Learning')).not.toBeInTheDocument()
  })

  it('toggles a Unit open and closed on click', async () => {
    render(<ExerciseDetailPage />)
    await screen.findByText('Unit 2')

    fireEvent.click(screen.getByText('Unit 2'))
    expect(await screen.findByText('The Power of Learning')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Unit 1'))
    await waitFor(() => expect(screen.queryByText('The First Snowfall')).not.toBeInTheDocument())
  })

  it('shows each Unit\'s completed count out of its total', async () => {
    render(<ExerciseDetailPage />)

    expect(await screen.findByText('1 / 2 completed')).toBeInTheDocument()
    expect(screen.getByText('0 / 1 completed')).toBeInTheDocument()
  })

  it('shows description, sentence count, and words per minute for each Track', async () => {
    render(<ExerciseDetailPage />)

    expect(await screen.findByText('A quiet winter morning.')).toBeInTheDocument()
    expect(screen.getByText(/21 sentences/)).toBeInTheDocument()
    expect(screen.getByText(/118 wpm/)).toBeInTheDocument()
  })

  it('links each track to its practice page', async () => {
    render(<ExerciseDetailPage />)

    expect(await screen.findByText('The First Snowfall')).toBeInTheDocument()
    expect(screen.getByText('The First Snowfall').closest('a')).toHaveAttribute('href', '/tracks/track-1')
  })

  it('colors a completed track\'s row background differently from an incomplete one', async () => {
    render(<ExerciseDetailPage />)
    await screen.findByText('The First Snowfall')

    const completedRow = screen.getByText('The First Snowfall').closest('a')
    const incompleteRow = screen.getByText('At the Coffee Shop').closest('a')
    expect(completedRow).toHaveStyle({ background: 'oklch(95% 0.04 20)' })
    expect(incompleteRow).toHaveStyle({ background: 'var(--surface)' })
  })
})
