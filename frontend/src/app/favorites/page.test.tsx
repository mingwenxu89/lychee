import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import FavoritesPage from './page'

const favoriteTrack = {
  id: 'track-1',
  title: 'The Lighthouse Keeper\'s Daughter',
  description: null,
  exerciseId: 'exercise-1',
  exerciseTitle: 'Short Stories',
  level: 'A2',
  duration: '00:03:24',
  sentenceCount: 18,
  favoritedAt: '2026-09-01T00:00:00Z'
}

const favoriteSentence = {
  id: 'sentence-1',
  index: 3,
  text: 'The wind howled across the point.',
  startTime: '00:00:10',
  endTime: '00:00:13',
  trackId: 'track-1',
  trackTitle: 'The Lighthouse Keeper\'s Daughter',
  exerciseTitle: 'Short Stories',
  audioUrl: 'https://example.test/audio.mp3',
  favoritedAt: '2026-09-01T00:00:00Z'
}

function mockFetchByUrl(map: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    for (const [key, body] of Object.entries(map)) {
      if (url.includes(key)) return new Response(JSON.stringify(body), { status: 200 })
    }
    return new Response(null, { status: 204 })
  }))
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
  mockFetchByUrl({
    '/api/learner/favorites/tracks': [favoriteTrack],
    '/api/learner/favorites/sentences': [favoriteSentence]
  })
})

describe('FavoritesPage', () => {
  it('defaults to the Tracks tab and lists favorited tracks', async () => {
    render(<FavoritesPage />)

    expect(await screen.findByText('The Lighthouse Keeper\'s Daughter')).toBeInTheDocument()
    expect(screen.getByText(/Short Stories · A2 · 18 sentences/)).toBeInTheDocument()
    expect(screen.getByText('The Lighthouse Keeper\'s Daughter').closest('a')).toHaveAttribute('href', '/tracks/track-1')
  })

  it('switches to the Sentences tab and lists favorited sentences with context', async () => {
    render(<FavoritesPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')

    fireEvent.click(screen.getByRole('button', { name: 'Sentences' }))

    expect(await screen.findByText('The wind howled across the point.')).toBeInTheDocument()
    expect(screen.getByText(/Short Stories · The Lighthouse Keeper's Daughter · 0:10/)).toBeInTheDocument()
    expect(screen.getByText('The wind howled across the point.').closest('a')).toHaveAttribute(
      'href', '/tracks/track-1?mode=full&sentence=3'
    )
  })

  it('shows an empty state when there are no favorited tracks', async () => {
    mockFetchByUrl({ '/api/learner/favorites/tracks': [], '/api/learner/favorites/sentences': [] })
    render(<FavoritesPage />)

    expect(await screen.findByText('No favorited tracks yet.')).toBeInTheDocument()
  })

  it('plays a favorited sentence inline, seeking to its start time', async () => {
    render(<FavoritesPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')
    fireEvent.click(screen.getByRole('button', { name: 'Sentences' }))
    await screen.findByText('The wind howled across the point.')

    fireEvent.click(screen.getByRole('button', { name: /play sentence/i }))

    await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled())
    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(10)
    expect(audio.src).toBe('https://example.test/audio.mp3')
    expect(await screen.findByRole('button', { name: /pause sentence/i })).toBeInTheDocument()
  })

  it('pauses when clicking the same sentence again', async () => {
    render(<FavoritesPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')
    fireEvent.click(screen.getByRole('button', { name: 'Sentences' }))
    await screen.findByText('The wind howled across the point.')

    fireEvent.click(screen.getByRole('button', { name: /play sentence/i }))
    await screen.findByRole('button', { name: /pause sentence/i })

    fireEvent.click(screen.getByRole('button', { name: /pause sentence/i }))

    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  })

  it('removes a track from the list and calls the unfavorite endpoint', async () => {
    render(<FavoritesPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')

    fireEvent.click(screen.getByRole('button', { name: /remove .* from favorites/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/learner/tracks/track-1/favorite', { method: 'DELETE' })
    })
    expect(screen.queryByText('The Lighthouse Keeper\'s Daughter')).not.toBeInTheDocument()
  })

  it('removes a sentence from the list and calls the unfavorite endpoint', async () => {
    render(<FavoritesPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')
    fireEvent.click(screen.getByRole('button', { name: 'Sentences' }))
    await screen.findByText('The wind howled across the point.')

    fireEvent.click(screen.getByRole('button', { name: 'Remove sentence from favorites' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/learner/sentences/sentence-1/favorite', { method: 'DELETE' })
    })
    expect(screen.queryByText('The wind howled across the point.')).not.toBeInTheDocument()
  })
})
