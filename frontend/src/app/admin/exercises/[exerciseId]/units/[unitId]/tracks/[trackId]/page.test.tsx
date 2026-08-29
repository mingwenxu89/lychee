// frontend/src/app/admin/exercises/[exerciseId]/units/[unitId]/tracks/[trackId]/page.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ trackId: 'track-1' })
}))

import TrackProofreadingPage from './page'

const sentence = {
  id: 'sentence-1',
  trackId: 'track-1',
  index: 1,
  text: 'Original text',
  startTime: '00:00:01',
  endTime: '00:00:02'
}

describe('TrackProofreadingPage saveSentence', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([sentence]), { status: 200 }))
    )
  })

  it('shows an error and keeps the edited text when the save request fails', async () => {
    render(<TrackProofreadingPage />)

    const textInput = await screen.findByDisplayValue('Original text')

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Bad Request' }), { status: 400 }))

    fireEvent.change(textInput, { target: { value: 'Edited but unsaved' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save sentence 1')
    })
    expect(screen.getByDisplayValue('Edited but unsaved')).toBeInTheDocument()
  })

  it('clears any previous error and reflects the server response on a successful save', async () => {
    render(<TrackProofreadingPage />)

    const textInput = await screen.findByDisplayValue('Original text')

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...sentence, text: 'Server-confirmed text' }), { status: 200 })
    )

    fireEvent.change(textInput, { target: { value: 'Edited text' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Server-confirmed text')).toBeInTheDocument()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
