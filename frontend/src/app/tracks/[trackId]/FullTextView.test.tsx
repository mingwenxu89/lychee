import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FullTextView } from './FullTextView'
import type { LearnerTrack } from './page'

const track: LearnerTrack = {
  id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'Test Track', description: null, exerciseTitle: 'Test Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:04',
  audioUrl: 'https://example.test/audio.mp3',
  sentences: [
    { id: 's1', index: 1, text: 'Hello there.', startTime: '00:00:00', endTime: '00:00:02', isFavorited: false },
    { id: 's2', index: 2, text: 'Good morning.', startTime: '00:00:02', endTime: '00:00:04', isFavorited: false }
  ],
  nextTrackId: null,
  isFavorited: false
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('FullTextView', () => {
  it('hides the transcript by default and reveals it on click', () => {
    render(<FullTextView track={track} onRecitationCompleted={vi.fn()} />)

    expect(screen.queryByText('Hello there.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show text/i }))

    expect(screen.getByText('Hello there.')).toBeInTheDocument()
  })

  it('lets the user change playback speed', () => {
    render(<FullTextView track={track} onRecitationCompleted={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/speed/i), { target: { value: '1.5' } })

    expect(screen.getByLabelText(/speed/i)).toHaveValue('1.5')
  })

  it('clicking a revealed sentence does not navigate anywhere — the text is plain, freely selectable', () => {
    render(<FullTextView track={track} onRecitationCompleted={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /show text/i }))

    fireEvent.click(screen.getByText('Good morning.'))

    // No navigation callback exists any more — clicking is a no-op, verified by nothing throwing
    // and the page staying on the same sentence list.
    expect(screen.getByText('Good morning.')).toBeInTheDocument()
  })

  it('every sentence keeps a trailing play icon, separated by a divider, that seeks that sentence', () => {
    render(<FullTextView track={track} onRecitationCompleted={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /show text/i }))

    const playSentence1 = screen.getByRole('button', { name: 'Play sentence 1' })
    const playSentence2 = screen.getByRole('button', { name: 'Play sentence 2' })
    expect(playSentence1).toBeInTheDocument()
    expect(playSentence2).toBeInTheDocument()

    fireEvent.click(playSentence2)

    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(2)
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it('opens the recitation panel from the Recite button', () => {
    render(<FullTextView track={track} onRecitationCompleted={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^recite$/i }))

    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('Show Text toggles back to Hide Text and collapses the transcript again', () => {
    render(<FullTextView track={track} onRecitationCompleted={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /show text/i }))
    expect(screen.getByText('Hello there.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /hide text/i }))
    expect(screen.queryByText('Hello there.')).not.toBeInTheDocument()
  })

  it('toggles the play button to a pause icon while the audio plays, with no separate pause button', async () => {
    const { container } = render(<FullTextView track={track} onRecitationCompleted={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^pause$/i })).not.toBeInTheDocument()

    const audio = container.querySelector('audio')!
    fireEvent.click(screen.getByRole('button', { name: /^play$/i }))
    fireEvent(audio, new Event('play'))

    expect(await screen.findByRole('button', { name: /^pause$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^play$/i })).not.toBeInTheDocument()
  })

  it('Space toggles play/pause, but does nothing while the speed select is focused', () => {
    render(<FullTextView track={track} onRecitationCompleted={vi.fn()} />)

    const select = screen.getByLabelText(/speed/i)
    select.focus()
    fireEvent.keyDown(window, { key: ' ' })
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()

    select.blur()
    fireEvent.keyDown(window, { key: ' ' })
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it('toggles a sentence favorite and calls the favorite endpoint, without seeking or navigating', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<FullTextView track={track} onRecitationCompleted={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /show text/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Add sentence 2 to favorites' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/learner/sentences/s2/favorite', { method: 'PUT' })
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Remove sentence 2 from favorites' })).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('seeks to the initial sentence and reveals the text, without autoplaying', () => {
    // initialSentenceIndex is the sentence's `index` field (caption cue number), not its
    // array position — sentence "Good morning." has index 2 but sits at array position 1.
    render(<FullTextView track={track} initialSentenceIndex={2} onRecitationCompleted={vi.fn()} />)

    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(2)
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    expect(screen.getByText('Good morning.')).toBeInTheDocument()
  })
})
