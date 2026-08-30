import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ exerciseId: 'ex-1' })
}))

import ExerciseDetailPage from './page'

const detail = {
  id: 'ex-1', title: 'Short Stories', description: 'Cozy short stories', category: 'Short Stories',
  units: [
    {
      id: 'unit-1', title: 'Unit 1', order: 1,
      tracks: [
        { id: 'track-1', title: 'The First Snowfall', level: 'A1', duration: '00:03:12', isCompletedByUser: true },
        { id: 'track-2', title: 'At the Coffee Shop', level: 'A2', duration: '00:02:40', isCompletedByUser: false }
      ]
    }
  ]
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 })))
})

describe('ExerciseDetailPage', () => {
  it('fetches and lists every Unit and Track', async () => {
    render(<ExerciseDetailPage />)

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/learner/exercises/ex-1'))
    expect(await screen.findByText('Short Stories')).toBeInTheDocument()
    expect(screen.getByText('Unit 1')).toBeInTheDocument()
    expect(screen.getByText('The First Snowfall')).toBeInTheDocument()
    expect(screen.getByText('At the Coffee Shop')).toBeInTheDocument()
  })

  it('links each track to its practice page', async () => {
    render(<ExerciseDetailPage />)
    await screen.findByText('The First Snowfall')

    expect(screen.getByText('The First Snowfall').closest('a')).toHaveAttribute('href', '/tracks/track-1')
  })

  it('shows a completed indicator only for tracks the user finished', async () => {
    render(<ExerciseDetailPage />)
    await screen.findByText('The First Snowfall')

    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent(/completed/i)
    expect(rows[1]).not.toHaveTextContent(/completed/i)
  })
})
