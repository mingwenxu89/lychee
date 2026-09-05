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
    render(<RecitationPanel trackId="track-1" sentences={sentences} onCompleted={onCompleted} onBack={vi.fn()} />)

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
    // The result is scored per sentence now — the single reference sentence here is fully
    // matched, so 1 of 1 sentences is correct.
    expect(screen.getByText('1 / 1 sentences')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    expect(onCompleted).toHaveBeenCalledWith(1)
  })

  it('Recite Again clears the result and returns to recording, with no onCompleted call', async () => {
    const onCompleted = vi.fn()
    render(<RecitationPanel trackId="track-1" sentences={sentences} onCompleted={onCompleted} onBack={vi.fn()} />)

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
    render(<RecitationPanel trackId="track-1" sentences={sentences} onCompleted={vi.fn()} onBack={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(await screen.findByText('Hello')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to save your recitation/i))
  })

  it('Back calls onBack without submitting', () => {
    const onBack = vi.fn()
    render(<RecitationPanel trackId="track-1" sentences={sentences} onCompleted={vi.fn()} onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(onBack).toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows a mic button (not a "Start Recording" text button) that starts and stops the recognizer', () => {
    class FakeSpeechRecognition {
      continuous = false
      interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn()
      stop = vi.fn()
    }
    vi.stubGlobal('SpeechRecognition', vi.fn().mockImplementation(function (this: unknown) {
      return new FakeSpeechRecognition()
    }))

    render(<RecitationPanel trackId="track-1" sentences={sentences} onCompleted={vi.fn()} onBack={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /start recording/i })).not.toBeInTheDocument()
    const micButton = screen.getByRole('button', { name: /use microphone/i })

    fireEvent.click(micButton)
    expect(screen.getByRole('button', { name: /stop microphone/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Recording')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /stop microphone/i }))
    expect(screen.getByRole('button', { name: /use microphone/i })).toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
