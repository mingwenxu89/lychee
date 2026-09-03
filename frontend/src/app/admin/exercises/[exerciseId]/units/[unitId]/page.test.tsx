// frontend/src/app/admin/exercises/[exerciseId]/units/[unitId]/page.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ exerciseId: 'exercise-1', unitId: 'unit-1' })
}))

import UnitDetailPage from './page'

const exercise = { id: 'exercise-1', title: 'The Lighthouse Keeper\'s Daughter' }
const unit = { id: 'unit-1', title: 'Listening Practice' }
const track = {
  id: 'track-1',
  unitId: 'unit-1',
  title: 'Chapter 1: Arrival',
  description: 'Opening scene at the lighthouse.',
  audioUrl: 'https://example.com/audio.mp3',
  srtUrl: 'https://example.com/track.srt',
  duration: '00:03:24',
  level: 'A2',
  isPublished: false,
  sentenceCount: 18
}

function mockFetchOnce(body: unknown, status = 200) {
  const content = status === 204 ? null : JSON.stringify(body)
  vi.mocked(fetch).mockResolvedValueOnce(new Response(content, { status }))
}

function mockInitialLoad(tracks: unknown[] = [track]) {
  mockFetchOnce(exercise)
  mockFetchOnce(unit)
  mockFetchOnce(tracks)
}

const secondTrack = { ...track, id: 'track-2', title: 'Chapter 2: The Storm', description: null, sentenceCount: 24 }

describe('UnitDetailPage (Tracks)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    mockInitialLoad()
  })

  it('filters the track list by title as the admin types', async () => {
    vi.mocked(fetch).mockReset()
    mockInitialLoad([track, secondTrack])
    render(<UnitDetailPage />)

    await screen.findByText('Chapter 1: Arrival')
    expect(screen.getByText('Chapter 2: The Storm')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/search tracks/i), { target: { value: 'storm' } })

    expect(screen.queryByText('Chapter 1: Arrival')).not.toBeInTheDocument()
    expect(screen.getByText('Chapter 2: The Storm')).toBeInTheDocument()
  })

  it('shows a no-match message when the search has no results', async () => {
    render(<UnitDetailPage />)
    await screen.findByText('Chapter 1: Arrival')

    fireEvent.change(screen.getByPlaceholderText(/search tracks/i), { target: { value: 'nonexistent' } })

    expect(screen.queryByText('Chapter 1: Arrival')).not.toBeInTheDocument()
    expect(screen.getByText('No tracks match "nonexistent".')).toBeInTheDocument()
  })

  it('shows a breadcrumb through Exercises and the exercise and unit titles', async () => {
    render(<UnitDetailPage />)

    expect(await screen.findByText('Exercises')).toHaveAttribute('href', '/admin/exercises')
    const exerciseLink = await screen.findByText('The Lighthouse Keeper\'s Daughter')
    expect(exerciseLink).toHaveAttribute('href', '/admin/exercises/exercise-1')
    expect(await screen.findByText('Listening Practice')).toBeInTheDocument()
  })

  it('renders the track list with duration and a sentences link', async () => {
    render(<UnitDetailPage />)

    expect(await screen.findByText('Chapter 1: Arrival')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(screen.getByText('3:24')).toBeInTheDocument()
    const sentencesLink = screen.getByRole('link', { name: /18 sentences/i })
    expect(sentencesLink).toHaveAttribute('href', '/admin/exercises/exercise-1/units/unit-1/tracks/track-1')
  })

  it('requires both files before uploading a new track', async () => {
    render(<UnitDetailPage />)
    await screen.findByText('Chapter 1: Arrival')

    fireEvent.click(screen.getByRole('button', { name: /new track/i }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Chapter 2: The Storm' } })
    fireEvent.change(screen.getByLabelText('Level (CEFR)'), { target: { value: 'A2' } })
    fireEvent.click(screen.getByRole('button', { name: /upload track/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Both an audio file and an SRT file are required')
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/tracks'), expect.objectContaining({ method: 'POST' }))
  })

  it('uploads a new track with both files', async () => {
    render(<UnitDetailPage />)
    await screen.findByText('Chapter 1: Arrival')

    fireEvent.click(screen.getByRole('button', { name: /new track/i }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Chapter 2: The Storm' } })
    fireEvent.change(screen.getByLabelText('Level (CEFR)'), { target: { value: 'A2' } })

    const audioFile = new File(['audio'], 'chapter2.mp3', { type: 'audio/mpeg' })
    const srtFile = new File(['srt'], 'chapter2.srt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('Audio File'), { target: { files: [audioFile] } })
    fireEvent.change(screen.getByLabelText('SRT File'), { target: { files: [srtFile] } })

    mockFetchOnce({ ...track, id: 'track-2', title: 'Chapter 2: The Storm' }, 201)
    mockFetchOnce([track, { ...track, id: 'track-2', title: 'Chapter 2: The Storm' }])

    fireEvent.click(screen.getByRole('button', { name: /upload track/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/units/unit-1/tracks', expect.objectContaining({ method: 'POST' }))
    })
    const call = vi.mocked(fetch).mock.calls.find(
      ([url, opts]) => url === '/api/admin/units/unit-1/tracks' && (opts as RequestInit | undefined)?.method === 'POST'
    )
    const body = call?.[1]?.body as FormData
    expect(body.get('Title')).toBe('Chapter 2: The Storm')
    expect(body.get('Level')).toBe('A2')
    expect(body.get('AudioFile')).toBe(audioFile)
    expect(body.get('SrtFile')).toBe(srtFile)

    expect(await screen.findByText('Chapter 2: The Storm')).toBeInTheDocument()
  })

  it('edits a track via the pre-filled modal (no file re-upload)', async () => {
    render(<UnitDetailPage />)
    await screen.findByText('Chapter 1: Arrival')

    fireEvent.click(screen.getByRole('button', { name: /edit chapter 1: arrival/i }))

    expect(screen.getByLabelText('Title')).toHaveValue('Chapter 1: Arrival')
    expect(screen.getByLabelText('Level (CEFR)')).toHaveValue('A2')
    expect(screen.queryByLabelText('Audio File')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Level (CEFR)'), { target: { value: 'B1' } })

    mockFetchOnce({ ...track, level: 'B1' })
    mockFetchOnce([{ ...track, level: 'B1' }])

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/tracks/track-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Chapter 1: Arrival', level: 'B1', description: 'Opening scene at the lighthouse.' })
      })
    })
  })

  it('toggles publish status', async () => {
    render(<UnitDetailPage />)
    await screen.findByText('Chapter 1: Arrival')

    mockFetchOnce({ ...track, isPublished: true })
    mockFetchOnce([{ ...track, isPublished: true }])

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/tracks/track-1/publish-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: true })
      })
    })
  })

  it('deletes a track after confirming', async () => {
    render(<UnitDetailPage />)
    await screen.findByText('Chapter 1: Arrival')

    fireEvent.click(screen.getByRole('button', { name: /delete chapter 1: arrival/i }))
    expect(screen.getByText('Delete this track?')).toBeInTheDocument()

    mockFetchOnce(undefined, 204)
    mockFetchOnce([])

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/tracks/track-1', { method: 'DELETE' })
    })
    await waitFor(() => {
      expect(screen.queryByText('Chapter 1: Arrival')).not.toBeInTheDocument()
    })
  })
})
