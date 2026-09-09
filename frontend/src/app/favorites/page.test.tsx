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
  mockFetchByUrl({
    '/api/learner/favorites/tracks': { items: [favoriteTrack], totalCount: 1, page: 1, pageSize: 20 }
  })
})

describe('FavoritesPage', () => {
  it('lists favorited tracks', async () => {
    render(<FavoritesPage />)

    expect(await screen.findByText('The Lighthouse Keeper\'s Daughter')).toBeInTheDocument()
    expect(screen.getByText(/Short Stories · A2 · 18 sentences/)).toBeInTheDocument()
    expect(screen.getByText('The Lighthouse Keeper\'s Daughter').closest('a')).toHaveAttribute('href', '/tracks/track-1')
  })

  it('shows an empty state when there are no favorited tracks', async () => {
    mockFetchByUrl({
      '/api/learner/favorites/tracks': { items: [], totalCount: 0, page: 1, pageSize: 20 }
    })
    render(<FavoritesPage />)

    expect(await screen.findByText('No favorited tracks yet.')).toBeInTheDocument()
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

  it('hides the pager when everything fits on one page', async () => {
    render(<FavoritesPage />)

    expect(await screen.findByText('The Lighthouse Keeper\'s Daughter')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('fetches the next page of tracks when Next is clicked', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/learner/favorites/tracks') && url.includes('page=2')) {
        return new Response(JSON.stringify({
          items: [{ ...favoriteTrack, id: 'track-2', title: 'Second Track' }], totalCount: 25, page: 2, pageSize: 20
        }), { status: 200 })
      }
      if (url.includes('/api/learner/favorites/tracks')) {
        return new Response(JSON.stringify({ items: [favoriteTrack], totalCount: 25, page: 1, pageSize: 20 }), { status: 200 })
      }
      return new Response(null, { status: 204 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<FavoritesPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByText('Second Track')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })
})
