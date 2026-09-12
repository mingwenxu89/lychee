import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FullTextView } from './FullTextView'
import type { LearnerTrack } from './page'

const track: LearnerTrack = {
  id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'Test Track', description: null, exerciseTitle: 'Test Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:04',
  audioUrl: 'https://example.test/audio.mp3',
  sentences: [
    { id: 's1', index: 1, text: 'Hello there.', startTime: '00:00:00', endTime: '00:00:02' },
    { id: 's2', index: 2, text: 'Good morning.', startTime: '00:00:02', endTime: '00:00:04' }
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
  it('disables Play and shows a loading message while the track audio is still downloading', () => {
    render(<FullTextView track={track} audioObjectUrl={null} audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)

    expect(screen.getByText('Loading audio...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^play$/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /^play$/i }))
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it('shows an error and keeps Play disabled if the track audio fails to download', () => {
    render(<FullTextView track={track} audioObjectUrl={null} audioError="Failed to download audio for this track." onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to download audio for this track.')
    expect(screen.queryByText('Loading audio...')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^play$/i })).toBeDisabled()
  })

  it('hides the transcript by default and reveals it on click', () => {
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)

    expect(screen.queryByText('Hello there.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show text/i }))

    expect(screen.getByText('Hello there.')).toBeInTheDocument()
  })

  it('lets the user change playback speed', () => {
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/speed/i), { target: { value: '1.5' } })

    expect(screen.getByLabelText(/speed/i)).toHaveValue('1.5')
  })

  it('clicking anywhere on a revealed sentence row seeks to and plays that sentence', () => {
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /show text/i }))

    fireEvent.click(screen.getByText('Good morning.'))

    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(2)
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it('every sentence keeps a trailing play icon, separated by a divider, that seeks that sentence', () => {
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)
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

  it('does not offer the Article View toggle until the transcript is revealed', () => {
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /article view/i })).not.toBeInTheDocument()
  })

  it('switches to a plain, non-scrolling Article View that keeps line numbers but disables click-to-seek', () => {
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /show text/i }))
    fireEvent.click(screen.getByRole('button', { name: /article view/i }))

    // Line numbers and text both still render, one sentence per line.
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Hello there.')).toBeInTheDocument()
    expect(screen.getByText('Good morning.')).toBeInTheDocument()

    // No more click-to-seek: neither the trailing play buttons nor a row click do anything.
    expect(screen.queryByRole('button', { name: /play sentence/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Good morning.'))
    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(0)
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()

    // The seek hint only makes sense when seeking is possible.
    expect(screen.queryByText(/tap a sentence/i)).not.toBeInTheDocument()

    // Toggling back returns to the normal synced/seekable view.
    fireEvent.click(screen.getByRole('button', { name: /sync view/i }))
    expect(screen.getByRole('button', { name: 'Play sentence 1' })).toBeInTheDocument()
  })

  it('keeps every line plain black in Article View regardless of playback position, unlike Sync View\'s done/active/upcoming shading', () => {
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /show text/i }))
    fireEvent.click(screen.getByRole('button', { name: /article view/i }))

    // Advance playback into the second sentence — in Sync View this would color sentence 1
    // "done" (ink-soft) and sentence 2 "active" (ink); Article View must ignore it entirely.
    const audio = document.querySelector('audio')!
    Object.defineProperty(audio, 'currentTime', { value: 3, writable: true })
    fireEvent.timeUpdate(audio)

    expect(screen.getByText('Hello there.')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.getByText('Good morning.')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.getByText('1')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.getByText('2')).toHaveStyle({ color: 'var(--ink)' })
  })

  it('calls onStartRecite when the Recite button is clicked — Recite is a full page now, not a modal rendered here', () => {
    const onStartRecite = vi.fn()
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={onStartRecite} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^recite$/i }))

    expect(onStartRecite).toHaveBeenCalled()
  })

  // The Full Dictation button itself is commented out in FullTextView (the mode didn't work
  // well in practice) — skipped rather than deleted, matching that button still being there,
  // just disabled, in case it's revisited later.
  it.skip('calls onStartFullDictation when the Start Full Dictation button is clicked', () => {
    const onStartFullDictation = vi.fn()
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={onStartFullDictation} onStartBySentence={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /full dictation/i }))

    expect(onStartFullDictation).toHaveBeenCalled()
  })

  it('calls onStartBySentence when the Start By Sentence button is clicked', () => {
    const onStartBySentence = vi.fn()
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={onStartBySentence} />)

    fireEvent.click(screen.getByRole('button', { name: /sentence dictation/i }))

    expect(onStartBySentence).toHaveBeenCalled()
  })

  it('Show Text toggles back to Hide Text and collapses the transcript again', () => {
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /show text/i }))
    expect(screen.getByText('Hello there.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /hide text/i }))
    expect(screen.queryByText('Hello there.')).not.toBeInTheDocument()
  })

  it('toggles the play button to a pause icon while the audio plays, with no separate pause button', async () => {
    const { container } = render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^pause$/i })).not.toBeInTheDocument()

    const audio = container.querySelector('audio')!
    fireEvent.click(screen.getByRole('button', { name: /^play$/i }))
    fireEvent(audio, new Event('play'))

    expect(await screen.findByRole('button', { name: /^pause$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^play$/i })).not.toBeInTheDocument()
  })

  it('Space toggles play/pause, but does nothing while the speed select is focused', () => {
    render(<FullTextView track={track} audioObjectUrl="blob:fake" audioError={null} onStartRecite={vi.fn()} onStartFullDictation={vi.fn()} onStartBySentence={vi.fn()} />)

    const select = screen.getByLabelText(/speed/i)
    select.focus()
    fireEvent.keyDown(window, { key: ' ' })
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()

    select.blur()
    fireEvent.keyDown(window, { key: ' ' })
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

})
