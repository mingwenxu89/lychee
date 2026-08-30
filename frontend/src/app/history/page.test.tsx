// frontend/src/app/history/page.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import HistoryPage from './page'

const entries = [
  { trackId: 'track-1', trackTitle: 'The First Snowfall', exerciseCategory: 'Short Stories', practiceType: 'Practice', status: 'InProgress', accuracy: null, currentSentenceIndex: 4, totalSentences: 21, timestamp: new Date().toISOString() },
  { trackId: 'track-2', trackTitle: 'At the Coffee Shop', exerciseCategory: 'Conversations', practiceType: 'Practice', status: 'Completed', accuracy: 0.92, currentSentenceIndex: null, totalSentences: null, timestamp: new Date().toISOString() },
  { trackId: 'track-3', trackTitle: 'The Power of Learning', exerciseCategory: 'VOA Slow English', practiceType: 'Recitation', status: 'Completed', accuracy: 0.86, currentSentenceIndex: null, totalSentences: null, timestamp: new Date().toISOString() }
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(entries), { status: 200 })))
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
})
