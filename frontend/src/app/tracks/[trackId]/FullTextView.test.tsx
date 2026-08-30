import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FullTextView } from './FullTextView'
import type { LearnerTrack } from './page'

const track: LearnerTrack = {
  id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', level: 'A1', duration: '00:00:04',
  audioUrl: 'https://example.test/audio.mp3',
  sentences: [
    { id: 's1', index: 0, text: 'Hello there.', startTime: '00:00:00', endTime: '00:00:02' },
    { id: 's2', index: 1, text: 'Good morning.', startTime: '00:00:02', endTime: '00:00:04' }
  ],
  nextTrackId: null
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('FullTextView', () => {
  it('hides the transcript by default and reveals it on click', () => {
    render(<FullTextView track={track} onEnterSentenceMode={vi.fn()} onRecitationCompleted={vi.fn()} />)

    expect(screen.queryByText('Hello there.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show text/i }))

    expect(screen.getByText('Hello there.')).toBeInTheDocument()
  })

  it('lets the user change playback speed', () => {
    render(<FullTextView track={track} onEnterSentenceMode={vi.fn()} onRecitationCompleted={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/speed/i), { target: { value: '1.5' } })

    expect(screen.getByLabelText(/speed/i)).toHaveValue('1.5')
  })

  it('clicking a revealed sentence enters sentence-practice mode at that index', () => {
    const onEnterSentenceMode = vi.fn()
    render(<FullTextView track={track} onEnterSentenceMode={onEnterSentenceMode} onRecitationCompleted={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /show text/i }))

    fireEvent.click(screen.getByText('Good morning.'))

    expect(onEnterSentenceMode).toHaveBeenCalledWith(1)
  })

  it('opens the recitation panel from the Recite Full Text button', () => {
    render(<FullTextView track={track} onEnterSentenceMode={vi.fn()} onRecitationCompleted={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /recite full text/i }))

    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })
})
