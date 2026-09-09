// frontend/src/app/history/page.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import HistoryPage from './page'

const entries = [
  { trackId: 'track-1', trackTitle: 'The First Snowfall', exerciseTitle: 'Short Stories', practiceType: 'Practice', status: 'InProgress', accuracy: null, currentSentenceIndex: 4, totalSentences: 21, timestamp: new Date().toISOString() },
  { trackId: 'track-2', trackTitle: 'At the Coffee Shop', exerciseTitle: 'Conversations', practiceType: 'Practice', status: 'Completed', accuracy: 0.92, currentSentenceIndex: null, totalSentences: null, timestamp: new Date().toISOString() },
  { trackId: 'track-3', trackTitle: 'The Power of Learning', exerciseTitle: 'VOA Slow English', practiceType: 'Recitation', status: 'Completed', accuracy: 0.86, currentSentenceIndex: null, totalSentences: null, timestamp: new Date().toISOString() }
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ items: entries, totalCount: entries.length, page: 1, pageSize: 20 }),
    { status: 200 }
  )))
})

describe('HistoryPage', () => {
  it('shows an in-progress row with a Continue link to sentence mode', async () => {
    render(<HistoryPage />)

    expect(await screen.findByText('The First Snowfall')).toBeInTheDocument()
    expect(screen.getByText(/sentence 5\/21/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /continue/i })).toHaveAttribute('href', '/tracks/track-1?mode=sentence')
  })

  it('shows a completed Practice row with accuracy and a Practice Again link', async () => {
    render(<HistoryPage />)
    await screen.findByText('At the Coffee Shop')

    expect(screen.getByText(/92%/)).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: /practice again/i })
    expect(links.some((l) => l.getAttribute('href') === '/tracks/track-2?mode=sentence')).toBe(true)
  })

  it('shows a completed Recitation row linking to full-text mode', async () => {
    render(<HistoryPage />)
    await screen.findByText('The Power of Learning')

    const links = screen.getAllByRole('link', { name: /practice again/i })
    expect(links.some((l) => l.getAttribute('href') === '/tracks/track-3?mode=full')).toBe(true)
  })

  it('hides the pager when everything fits on one page', async () => {
    render(<HistoryPage />)
    await screen.findByText('The First Snowfall')

    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('fetches the next page and shows its results when Next is clicked', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ items: entries, totalCount: 25, page: 1, pageSize: 20 }), { status: 200 }
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          items: [{ trackId: 'track-4', trackTitle: 'Page Two Track', exerciseTitle: 'Short Stories', practiceType: 'Practice', status: 'InProgress', accuracy: null, currentSentenceIndex: 0, totalSentences: 5, timestamp: new Date().toISOString() }],
          totalCount: 25, page: 2, pageSize: 20
        }), { status: 200 }
      ))
    vi.stubGlobal('fetch', fetchMock)

    render(<HistoryPage />)
    await screen.findByText('The First Snowfall')
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByText('Page Two Track')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/learner/history?page=2&pageSize=20')
  })
})
