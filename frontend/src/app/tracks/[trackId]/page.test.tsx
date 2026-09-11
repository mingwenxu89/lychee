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

const baseTrackResponse = {
  id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'The First Snowfall', description: null, exerciseTitle: 'Verify Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:05',
  audioUrl: 'https://example.test/audio.mp3',
  sentences: [{ id: 's1', index: 0, text: 'Hello.', startTime: '00:00:00', endTime: '00:00:02' }],
  nextTrackId: null
}

describe('TrackPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(baseTrackResponse), { status: 200 })
    ))
  })

  it('fetches the track and defaults to Full Listen (no more tab switcher)', async () => {
    render(<TrackPage />)

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/learner/tracks/track-1'))
    expect(await screen.findByRole('button', { name: /^recite$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sentence dictation/i })).toBeInTheDocument()
    // Full Dictation's entry button is commented out in FullTextView (the mode didn't work well
    // in practice) — it must not render.
    expect(screen.queryByRole('button', { name: /full dictation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^by sentence$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^full listen$/i })).not.toBeInTheDocument()
  })

  it('switches to By Sentence mode when Start By Sentence is clicked, and Back returns to Full Listen', async () => {
    const fetchMock = vi.fn()
    // 1: the track itself.
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(baseTrackResponse), { status: 200 }))
    // 2: the page preloads the full audio file itself as soon as the track loads (shared by
    // whichever of Sentence/Full Dictation the learner opens, so switching between them never
    // re-downloads it) — not something SentencePracticeView triggers on its own mount.
    fetchMock.mockImplementationOnce(async () => new Response(new Blob(['audio-bytes']), { status: 200 }))
    // 3: SentencePracticeView's own session-start call once Start By Sentence is clicked.
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({
      id: 'sentence-session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<TrackPage />)
    await screen.findByRole('button', { name: /sentence dictation/i })

    fireEvent.click(screen.getByRole('button', { name: /sentence dictation/i }))

    expect(await screen.findByText(/sentence 1 \//i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(await screen.findByRole('button', { name: /sentence dictation/i })).toBeInTheDocument()
  })

  // Full Dictation's entry button is commented out in FullTextView (the mode didn't work well
  // in practice) — skipped rather than deleted, since the mode itself (FullDictationView, this
  // page's 'dictation' branch) is still there, just unreachable from the UI for now.
  it.skip('switches to Full Dictation mode when Start Full Dictation is clicked from Full Listen, and back is not offered as a tab', async () => {
    const fetchMock = vi.fn()
    // 1: the track itself.
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(baseTrackResponse), { status: 200 }))
    // 2: the page preloads the full audio file itself as soon as the track loads, shared by
    // whichever dictation mode the learner opens (see the equivalent By Sentence test above).
    fetchMock.mockImplementationOnce(async () => new Response(new Blob(['audio-bytes']), { status: 200 }))
    // 3: FullDictationView's own session-start call once Start Full Dictation is clicked.
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({
      id: 'session-1', trackId: 'track-1', status: 'InProgress', currentSentenceIndex: 0, correctSentenceIds: [], completedAt: null
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<TrackPage />)
    await screen.findByRole('button', { name: /sentence dictation/i })

    fireEvent.click(screen.getByRole('button', { name: /full dictation/i }))

    expect(await screen.findByText(/sentence 1 \//i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^by sentence$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^full listen$/i })).not.toBeInTheDocument()
  })

  // Same reason as the mode-switch test above — Full Dictation's button is commented out, so
  // this scenario can no longer be driven through the UI. Skipped, not deleted.
  it.skip('downloads the track audio only once, reusing it across Sentence Dictation and Full Dictation instead of re-fetching on every switch', async () => {
    const fetchMock = vi.fn()
    // 1: the track itself. 2: the page's one-time audio preload.
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(baseTrackResponse), { status: 200 }))
    fetchMock.mockImplementationOnce(async () => new Response(new Blob(['audio-bytes']), { status: 200 }))
    // 3-4: each mode's own session-start call — no further audio-bytes response is queued, so
    // the test fails with an empty-queue rejection if either view tries to download audio again.
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({
      id: 'sentence-session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null
    }), { status: 200 }))
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({
      id: 'session-1', trackId: 'track-1', status: 'InProgress', currentSentenceIndex: 0, correctSentenceIds: [], completedAt: null
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<TrackPage />)
    await screen.findByRole('button', { name: /sentence dictation/i })

    fireEvent.click(screen.getByRole('button', { name: /sentence dictation/i }))
    await screen.findByText(/sentence 1 \//i)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    await screen.findByRole('button', { name: /full dictation/i })
    fireEvent.click(screen.getByRole('button', { name: /full dictation/i }))
    await screen.findByText(/sentence 1 \//i)

    const audioFetches = fetchMock.mock.calls.filter(([url]) => url === baseTrackResponse.audioUrl)
    expect(audioFetches).toHaveLength(1)
  })

  it('renders a breadcrumb with the Exercise and Track names, linking to Exercises and the Exercise', async () => {
    render(<TrackPage />)
    await screen.findByRole('button', { name: /sentence dictation/i })

    expect(screen.getByText('Exercises').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('Verify Exercise').closest('a')).toHaveAttribute('href', '/exercises/exercise-1')
    expect(screen.getByText('The First Snowfall').closest('a')).toBeNull()
  })

  it('shows the level and words-per-minute', async () => {
    render(<TrackPage />)
    await screen.findByRole('button', { name: /sentence dictation/i })

    expect(screen.getByText('Vocab Level: A1')).toBeInTheDocument()
    expect(screen.getByText('Speed: 120 wpm')).toBeInTheDocument()
  })

  it('shows the track description above Vocab Level/Speed when present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...baseTrackResponse, description: 'A short passage about winter.' }), { status: 200 })
    ))

    render(<TrackPage />)
    await screen.findByRole('button', { name: /sentence dictation/i })

    expect(screen.getByText('A short passage about winter.')).toBeInTheDocument()
  })

  it('toggles the track favorite button and calls the favorite endpoint', async () => {
    render(<TrackPage />)
    await screen.findByRole('button', { name: /sentence dictation/i })

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
