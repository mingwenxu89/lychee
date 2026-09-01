import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RecitationPanel } from './RecitationPanel'

const sentences = [{ id: 's1', text: 'Hello there' }]

describe('RecitationPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'attempt-1', createdAt: '2026-08-30T00:00:00Z' }), { status: 200 })))
  })

  it('computes the diff locally, shows it immediately, and records the attempt in the background', async () => {
    const onCompleted = vi.fn()
    render(<RecitationPanel trackId="track-1" sentences={sentences} onCompleted={onCompleted} onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(await screen.findByText('Hello')).toBeInTheDocument()
    expect(onCompleted).not.toHaveBeenCalled()

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/learner/tracks/track-1/recitation-attempts', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        submittedText: 'Hello there',
        score: 1,
        words: [
          { word: 'Hello', status: 'Correct' },
          { word: 'there', status: 'Correct' }
        ],
        qualifiedSentenceIds: ['s1']
      })
    })))

    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    expect(onCompleted).toHaveBeenCalledWith(1)
  })

  it('Recite Again clears the result and returns to recording, with no onCompleted call', async () => {
    const onCompleted = vi.fn()
    render(<RecitationPanel trackId="track-1" sentences={sentences} onCompleted={onCompleted} onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await screen.findByText('Hello')

    fireEvent.click(screen.getByRole('button', { name: /recite again/i }))

    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(onCompleted).not.toHaveBeenCalled()
  })

  it('still shows the locally computed result when the background record fails, alongside an inline error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))
    render(<RecitationPanel trackId="track-1" sentences={sentences} onCompleted={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(await screen.findByText('Hello')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to save your recitation/i))
  })

  it('close calls onClose without submitting', () => {
    const onClose = vi.fn()
    render(<RecitationPanel trackId="track-1" sentences={sentences} onCompleted={vi.fn()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
