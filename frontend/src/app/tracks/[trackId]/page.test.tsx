import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'

// jsdom's own `Blob` global doesn't implement `.stream()`, which Node's real `Response`
// constructor (used for the audio-preload fixture below) requires. Same fix as
// FullDictationView.test.tsx uses for the same jsdom-environment limitation.
;(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob

vi.mock('next/navigation', () => ({
  useParams: () => ({ trackId: 'track-1' }),
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn() })
}))

import TrackPage from './page'

describe('TrackPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'The First Snowfall', description: null, exerciseTitle: 'Verify Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:05',
        audioUrl: 'https://example.test/audio.mp3',
        sentences: [{ id: 's1', index: 0, text: 'Hello.', startTime: '00:00:00', endTime: '00:00:02' }],
        nextTrackId: null
      }), { status: 200 })
    ))
  })

  it('fetches the track and defaults to Sentence mode', async () => {
    render(<TrackPage />)

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/learner/tracks/track-1'))
    expect(await screen.findByText('By Sentence')).toBeInTheDocument()
    expect(screen.getByText('By Sentence')).toHaveAttribute('aria-current', 'page')
  })

  it('switches to Full Text mode on tab click', async () => {
    render(<TrackPage />)
    await screen.findByText('By Sentence')

    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByText('Full Listen'))

    expect(screen.getByText('Full Listen')).toHaveAttribute('aria-current', 'page')
  })

  it('switches to Full Dictation mode when Start Full Dictation is clicked from Full Listen, and back is not offered as a tab', async () => {
    const fetchMock = vi.fn()
    // 1: the track itself.
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({
      id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'The First Snowfall', description: null, exerciseTitle: 'Verify Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:05',
      audioUrl: 'https://example.test/audio.mp3',
      sentences: [{ id: 's1', index: 0, text: 'Hello.', startTime: '00:00:00', endTime: '00:00:02' }],
      nextTrackId: null
    }), { status: 200 }))
    // 2-3: SentencePracticeView mounts first (the default mode) and starts its own session —
    // it must download the audio and start a practice session before we ever switch modes.
    fetchMock.mockImplementationOnce(async () => new Response(new Blob(['audio-bytes']), { status: 200 }))
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({
      id: 'sentence-session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null
    }), { status: 200 }))
    // 4-5: FullDictationView mounts once Start Full Dictation is clicked.
    fetchMock.mockImplementationOnce(async () => new Response(new Blob(['audio-bytes']), { status: 200 }))
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({
      id: 'session-1', trackId: 'track-1', status: 'InProgress', currentRound: 1, currentPhase: 'Blind', correctSentenceIds: [], completedAt: null
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<TrackPage />)
    await screen.findByText('By Sentence')

    fireEvent.click(screen.getByRole('button', { name: /full listen/i }))
    fireEvent.click(await screen.findByRole('button', { name: /start full dictation/i }))

    expect(await screen.findByText(/round 1/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^by sentence$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^full listen$/i })).not.toBeInTheDocument()
  })

  it('renders a breadcrumb with the Exercise and Track names, linking to Exercises and the Exercise', async () => {
    render(<TrackPage />)
    await screen.findByText('By Sentence')

    expect(screen.getByText('Exercises').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('Verify Exercise').closest('a')).toHaveAttribute('href', '/exercises/exercise-1')
    expect(screen.getByText('The First Snowfall').closest('a')).toBeNull()
  })

  it('shows the level and words-per-minute next to the mode toggle', async () => {
    render(<TrackPage />)
    await screen.findByText('By Sentence')

    expect(screen.getByText('Vocab Level: A1')).toBeInTheDocument()
    expect(screen.getByText('Speed: 120 wpm')).toBeInTheDocument()
  })

  it('shows the track description above Vocab Level/Speed when present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'The First Snowfall', description: 'A short passage about winter.', exerciseTitle: 'Verify Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:05',
        audioUrl: 'https://example.test/audio.mp3',
        sentences: [{ id: 's1', index: 0, text: 'Hello.', startTime: '00:00:00', endTime: '00:00:02' }],
        nextTrackId: null
      }), { status: 200 })
    ))

    render(<TrackPage />)
    await screen.findByText('By Sentence')

    expect(screen.getByText('A short passage about winter.')).toBeInTheDocument()
  })

  it('toggles the track favorite button and calls the favorite endpoint', async () => {
    render(<TrackPage />)
    await screen.findByText('By Sentence')

    const favoriteButton = screen.getByRole('button', { name: 'Add to favorites' })
    fireEvent.click(favoriteButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/learner/tracks/track-1/favorite', { method: 'PUT' })
    })
    expect(await screen.findByRole('button', { name: 'Remove from favorites' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/learner/tracks/track-1/favorite', { method: 'DELETE' })
    })
    expect(await screen.findByRole('button', { name: 'Add to favorites' })).toBeInTheDocument()
  })
})
