// frontend/src/app/admin/exercises/[exerciseId]/units/[unitId]/page.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ exerciseId: 'exercise-1', unitId: 'unit-1' })
}))

import UnitDetailPage from './page'

const track = {
  id: 'track-1',
  unitId: 'unit-1',
  title: 'Original Title',
  audioUrl: 'https://example.com/audio.mp3',
  srtUrl: 'https://example.com/track.srt',
  duration: '00:00:05',
  level: 'A1',
  isPublished: true,
  sentenceCount: 2
}

describe('UnitDetailPage track editing', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([track]), { status: 200 }))
    )
  })

  it('saves an edited title and level and reflects the server response', async () => {
    render(<UnitDetailPage />)

    const titleInput = await screen.findByLabelText('Edit track title')
    const levelInput = screen.getByLabelText('Edit track level')

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...track, title: 'Updated Title', level: 'B1' }), { status: 200 })
    )

    fireEvent.change(titleInput, { target: { value: 'Updated Title' } })
    fireEvent.change(levelInput, { target: { value: 'B1' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Updated Title')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('B1')).toBeInTheDocument()

    expect(fetch).toHaveBeenLastCalledWith('/api/admin/tracks/track-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title', level: 'B1' })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error and keeps the edited values when the save request fails', async () => {
    render(<UnitDetailPage />)

    const titleInput = await screen.findByLabelText('Edit track title')

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Bad Request' }), { status: 400 }))

    fireEvent.change(titleInput, { target: { value: 'Edited but unsaved' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save track Edited but unsaved')
    })
    expect(screen.getByDisplayValue('Edited but unsaved')).toBeInTheDocument()
  })
})
