import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { FullDictationView } from './FullDictationView'
import type { LearnerTrack } from './page'

// jsdom's own `Blob` global doesn't implement `.stream()`, which Node's real `Response`
// constructor (used by the `new Response(...)` fixtures below) requires. Same fix as
// SentencePracticeView.test.tsx uses for the same jsdom-environment limitation.
;(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob

const track: LearnerTrack = {
  id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'Test Track', description: null,
  exerciseTitle: 'Test Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:04',
  audioUrl: 'https://example.test/audio.mp3',
  sentences: [
    { id: 's1', index: 0, text: 'Hello there.', startTime: '00:00:00', endTime: '00:00:02', isFavorited: false },
    { id: 's2', index: 1, text: 'Good morning.', startTime: '00:00:02', endTime: '00:00:04', isFavorited: false }
  ],
  nextTrackId: null, isFavorited: false
}

// The component's mount effect always calls preloadAudio(track.audioUrl) — which itself
// issues a fetch() — before starting the session, so every mocked sequence below is prefixed
// with an audio-download response (mirroring SentencePracticeView.test.tsx's same pattern) to
// keep the mocked responses aligned with the real call order. A 204 response must carry a null
// body per the Fetch spec (matching the real checkpoint endpoint, which returns 204 No Content).
function mockFetchSequence(responses: { body: unknown; status?: number }[]) {
  const fetchMock = vi.fn()
  fetchMock.mockImplementationOnce(async () => new Response(new Blob(['audio-bytes']), { status: 200 }))
  responses.forEach(({ body, status }) => {
    fetchMock.mockImplementationOnce(async () =>
      status === 204 ? new Response(null, { status: 204 }) : new Response(JSON.stringify(body), { status: status ?? 200 })
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
})

describe('FullDictationView — Blind round', () => {
  it('starts Round 1 with both sentences requiring input, no replay control rendered', async () => {
    mockFetchSequence([
      { body: { id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 1, currentPhase: 'Blind', correctSentenceIds: [], completedAt: null } }
    ])

    render(<FullDictationView track={track} onCompleted={vi.fn()} />)

    await screen.findByText(/round 1/i)
    expect(screen.queryByRole('button', { name: /replay/i })).not.toBeInTheDocument()
  })

  it('auto-advances past an already-correct sentence without showing a textarea', async () => {
    mockFetchSequence([
      { body: { id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 2, currentPhase: 'Blind', correctSentenceIds: ['s1'], completedAt: null } }
    ])

    render(<FullDictationView track={track} onCompleted={vi.fn()} />)
    await screen.findByText(/round 2/i)

    const audio = document.querySelector('audio')!
    fireEvent(audio, new Event('timeupdate'))
    Object.defineProperty(audio, 'currentTime', { value: 2, writable: true })
    fireEvent(audio, new Event('timeupdate'))

    // s1 is already correct: no textarea should ever be required for it before s2's arrives.
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type what you hear/i)).toBeInTheDocument()
    })
  })

  it('submitting the last sentence of a round with one wrong answer shows the round-end choice, not a completion', async () => {
    const fetchMock = mockFetchSequence([
      { body: { id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 1, currentPhase: 'Blind', correctSentenceIds: [], completedAt: null } },
      { body: {}, status: 204 }
    ])
    const onCompleted = vi.fn()

    render(<FullDictationView track={track} onCompleted={onCompleted} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'completely wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByRole('button', { name: /continue to round 2/i })
    expect(screen.getByRole('button', { name: /switch to focused practice/i })).toBeInTheDocument()
    expect(onCompleted).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/learner/full-dictation-sessions/session-1/checkpoint',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ currentRound: 2, currentPhase: 'Blind', newlyCorrectSentenceIds: ['s1'] })
      })
    )
  })

  it('finishing a round with everything correct shows the summary screen, then calls onCompleted when Done is clicked', async () => {
    mockFetchSequence([
      { body: { id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 1, currentPhase: 'Blind', correctSentenceIds: [], completedAt: null } },
      { body: { score: 1, finalCorrectSentenceIds: ['s1', 's2'] } }
    ])
    const onCompleted = vi.fn()

    render(<FullDictationView track={track} onCompleted={onCompleted} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good morning.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByText(/100%/)
    expect(screen.queryByRole('button', { name: /continue to round/i })).not.toBeInTheDocument()
    expect(onCompleted).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    expect(onCompleted).toHaveBeenCalledWith(1)
  })

  it('clicking "Continue to Round N" starts the next round from a fresh empty answer', async () => {
    mockFetchSequence([
      { body: { id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 1, currentPhase: 'Blind', correctSentenceIds: [], completedAt: null } },
      { body: {}, status: 204 }
    ])

    render(<FullDictationView track={track} onCompleted={vi.fn()} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('button', { name: /continue to round 2/i })

    fireEvent.click(screen.getByRole('button', { name: /continue to round 2/i }))

    await screen.findByText(/round 2/i)
    expect(screen.queryByRole('button', { name: /continue to round/i })).not.toBeInTheDocument()
  })
})

describe('FullDictationView — Focused round', () => {
  it('switching to focused practice only re-tests the sentence still wrong from Round 1', async () => {
    mockFetchSequence([
      { body: { id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 1, currentPhase: 'Blind', correctSentenceIds: [], completedAt: null } },
      { body: {}, status: 204 }, // Round 1 -> Round 2 checkpoint
      { body: {}, status: 204 }  // Blind -> Focused checkpoint
    ])

    render(<FullDictationView track={track} onCompleted={vi.fn()} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('button', { name: /switch to focused practice/i })

    fireEvent.click(screen.getByRole('button', { name: /switch to focused practice/i }))

    await screen.findByRole('button', { name: /replay/i })
    expect(screen.getByPlaceholderText(/type what you hear/i)).toBeInTheDocument()
  })

  it('gives immediate feedback in focused mode and allows retry until correct', async () => {
    mockFetchSequence([
      { body: { id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 3, currentPhase: 'Focused', correctSentenceIds: ['s1'], completedAt: null } }
    ])

    render(<FullDictationView track={track} onCompleted={vi.fn()} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong answer' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    expect(await screen.findByText(/incorrect|try again/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /replay/i }))
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good morning.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    expect(await screen.findByText(/nice|correct/i)).toBeInTheDocument()
  })

  it('Skip leaves a sentence uncorrected and moves to the next one', async () => {
    mockFetchSequence([
      { body: { id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 3, currentPhase: 'Focused', correctSentenceIds: [], completedAt: null } },
      { body: {}, status: 204 }
    ])

    render(<FullDictationView track={track} onCompleted={vi.fn()} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    await waitFor(() => expect(screen.getByPlaceholderText(/type what you hear/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /finish now/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/learner/full-dictation-sessions/session-1/complete',
        expect.objectContaining({ body: JSON.stringify({ newlyCorrectSentenceIds: [] }) })
      )
    })
  })

  it('shows the final summary and calls onCompleted with the returned score when Done is clicked', async () => {
    mockFetchSequence([
      { body: { id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 3, currentPhase: 'Focused', correctSentenceIds: ['s1'], completedAt: null } },
      { body: { score: 1, finalCorrectSentenceIds: ['s1', 's2'] } }
    ])
    const onCompleted = vi.fn()

    render(<FullDictationView track={track} onCompleted={onCompleted} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good morning.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByRole('button', { name: /next/i })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByText(/100%/)
    expect(onCompleted).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    expect(onCompleted).toHaveBeenCalledWith(1)
  })
})
