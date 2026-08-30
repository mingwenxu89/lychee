import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RecitationPanel } from './RecitationPanel'

describe('RecitationPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: 'attempt-1', score: 0.9, words: [{ word: 'Hello', status: 'Correct' }],
        qualifiedSentenceIds: ['s1'], createdAt: '2026-08-30T00:00:00Z'
      }), { status: 200 })
    ))
  })

  it('submits the manually typed transcript and shows the diff before finishing', async () => {
    const onCompleted = vi.fn()
    render(<RecitationPanel trackId="track-1" onCompleted={onCompleted} onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/learner/tracks/track-1/recitation-attempts', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ submittedText: 'Hello there' })
    })))
    expect(await screen.findByText('Hello')).toBeInTheDocument()
    expect(onCompleted).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /finish/i }))
    expect(onCompleted).toHaveBeenCalledWith(0.9)
  })

  it('Recite Again clears the result and returns to recording, with no onCompleted call', async () => {
    const onCompleted = vi.fn()
    render(<RecitationPanel trackId="track-1" onCompleted={onCompleted} onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await screen.findByText('Hello')

    fireEvent.click(screen.getByRole('button', { name: /recite again/i }))

    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(onCompleted).not.toHaveBeenCalled()
  })

  it('shows an inline error and keeps the transcript when submit fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))
    render(<RecitationPanel trackId="track-1" onCompleted={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to submit your recitation/i))
    expect(screen.getByRole('textbox')).toHaveValue('Hello there')
  })

  it('close calls onClose without submitting', () => {
    const onClose = vi.fn()
    render(<RecitationPanel trackId="track-1" onCompleted={vi.fn()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
