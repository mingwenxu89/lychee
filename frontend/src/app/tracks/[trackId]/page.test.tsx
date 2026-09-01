import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

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
        id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'The First Snowfall', exerciseTitle: 'Verify Exercise', level: 'A1', duration: '00:00:05',
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

  it('renders a breadcrumb with the Exercise and Track names, linking to Home and the Exercise', async () => {
    render(<TrackPage />)
    await screen.findByText('By Sentence')

    expect(screen.getByText('Home').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('Verify Exercise').closest('a')).toHaveAttribute('href', '/exercises/exercise-1')
    expect(screen.getByText('The First Snowfall').closest('a')).toBeNull()
  })
})
