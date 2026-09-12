import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SentencePracticeView } from './SentencePracticeView'
import type { LearnerTrack } from './page'


const track: LearnerTrack = {
  id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'Test Track', description: null, exerciseTitle: 'Test Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:04',
  audioUrl: 'https://example.test/audio.mp3',
  sentences: [
    { id: 's1', index: 1, text: 'Hello there.', startTime: '00:00:00', endTime: '00:00:02', translation: null },
    { id: 's2', index: 2, text: 'Good morning.', startTime: '00:00:02', endTime: '00:00:04', translation: null }
  ],
  nextTrackId: null,
  isFavorited: false
}

function mockFetchSequence(responses: Response[]) {
  const fetchMock = vi.fn()
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:fake') })
})

describe('SentencePracticeView', () => {
  it('pre-downloads audio and starts the session before enabling checking', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)

    expect(screen.getByRole('button', { name: /^check$/i })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())
  })

  it('does not autoplay the very first sentence on entering the view — the learner presses Play themselves', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it('calls onBack when the Back button is clicked', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])
    const onBack = vi.fn()

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={onBack}  audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(onBack).toHaveBeenCalled()
  })

  it('Check compares locally and, on a wrong answer, shows the diff without contacting the backend', async () => {
    const fetchMock = mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello world.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    expect(await screen.findByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('there.')).toBeInTheDocument()
    // A wrong answer is never sent to the backend at all — only the session-start call has
    // happened (audio is preloaded at the page level now, not through this component's fetch).
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // The "So close" icon and message are gone — only the diff itself is shown.
    expect(screen.queryByText(/so close/i)).not.toBeInTheDocument()
  })

  it('on a correct answer, shows the checkmark and message alongside the text in black', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'Hello', status: 'Correct' }, { word: 'there.', status: 'Correct' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    expect(await screen.findByText('Nice — that\'s right!')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toHaveStyle({ color: 'var(--ink)' })
    expect(screen.getByText('there.')).toHaveStyle({ color: 'var(--ink)' })
  })

  it('typing again after a correct Check hides the result and reverts to Check/Skip', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'Hello', status: 'Correct' }, { word: 'there.', status: 'Correct' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByText('Nice — that\'s right!')

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there. more' } })

    expect(screen.queryByText('Nice — that\'s right!')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^check$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^skip$/i })).toBeInTheDocument()
  })

  it('speaking again after a correct Check hides the result too', async () => {
    class FakeSpeechRecognition {
      continuous = false
      interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn()
      stop = vi.fn()
    }
    vi.stubGlobal('SpeechRecognition', vi.fn().mockImplementation(function (this: unknown) {
      return new FakeSpeechRecognition()
    }))

    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'Hello', status: 'Correct' }, { word: 'there.', status: 'Correct' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByText('Nice — that\'s right!')

    fireEvent.click(screen.getByRole('button', { name: /use microphone/i }))

    expect(screen.queryByText('Nice — that\'s right!')).not.toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('clicking Next after a correct answer autoplays the next sentence', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'Hello', status: 'Correct' }, { word: 'there.', status: 'Correct' }] }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByText('Nice — that\'s right!')

    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 1 })
    })))
    await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled())
  })

  it('on a correct answer, replaces the typed text with the clean reference sentence', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'well', status: 'Extra' }, { word: 'Hello', status: 'Correct' }, { word: 'there.', status: 'Correct' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'well Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    await screen.findByText('Nice — that\'s right!')
    expect(screen.getByRole('textbox')).toHaveValue('Hello there.')
  })

  it('Skip advances the session and calls onCompleted after the last sentence', async () => {
    const onCompleted = vi.fn()
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 1, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 2, isCompleted: true }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={onCompleted} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))

    await waitFor(() => expect(onCompleted).toHaveBeenCalled())
  })

  it('Next advances after a correct submission', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'Hello', status: 'Correct' }] }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByText('Nice — that\'s right!')

    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 1 })
    })))
  })

  it('Reset is always visible and clears the result, the typed answer, and replays the audio', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 0, isCorrect: false, words: [{ word: 'Hello', status: 'Incorrect' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Wrong answer' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByText('Hello')

    const resetButton = screen.getByRole('button', { name: /^reset$/i })
    expect(resetButton).toBeInTheDocument()
    // Check and Skip remain available at the bottom alongside Reset.
    expect(screen.getByRole('button', { name: /^check$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^skip$/i })).toBeInTheDocument()

    fireEvent.click(resetButton)

    await waitFor(() => expect(screen.queryByText('Hello')).not.toBeInTheDocument())
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it('jumps to a clicked sentence in the list and autoplays it', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByText('2'))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 1 })
    })))
    await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled())
  })

  it('clicking a Progress number only navigates, without marking anything done', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByText('2'))
    await waitFor(() => expect(screen.getByRole('button', { name: /previous sentence/i })).not.toBeDisabled())

    // Sentence 1 must still show its plain number, not a green checkmark — jumping via the
    // Progress list is pure navigation and must not mark anything as done.
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('the previous/next navigation arrows do not mark sentences as done in Progress', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /next sentence/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /previous sentence/i })).not.toBeDisabled())

    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('Skip marks the current sentence as done in Progress', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))

    // Progress buttons always show the sentence number now (no checkmark) — a done sentence is
    // distinguished by its green background instead.
    await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toHaveStyle({ background: 'var(--leaf)' }))
  })

  it('still shows the correct result locally, but shows an inline error when saving the record fails', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(null, { status: 500 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    expect(await screen.findByText('Nice — that\'s right!')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to save your progress/i))
    expect(screen.getByRole('textbox')).toHaveValue('Hello there.')
  })

  it('shows an inline error and keeps the current sentence when advance fails', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(null, { status: 500 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'my draft answer' } })
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to save your progress/i))
    expect(screen.getByRole('textbox')).toHaveValue('my draft answer')
  })

  it('toggles the play button to a pause icon while the audio plays', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    const { container } = render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    const audio = container.querySelector('audio')!
    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^play$/i }))
    fireEvent(audio, new Event('play'))
    expect(await screen.findByRole('button', { name: /^pause$/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^pause$/i }))
    fireEvent(audio, new Event('pause'))
    expect(await screen.findByRole('button', { name: /^play$/i })).toBeInTheDocument()
  })

  it('the previous-sentence button is disabled on the first sentence and jumps back otherwise', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 1, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 0, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /previous sentence/i }))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 0 })
    })))
    await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled())
  })

  it('disables the previous-sentence button on the first sentence', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    expect(screen.getByRole('button', { name: /previous sentence/i })).toBeDisabled()
  })

  it('the next-sentence button next to the play control navigates and autoplays the sentence', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /next sentence/i }))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 1 })
    })))
    await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled())
  })

  it('Skip navigates to the next sentence and autoplays it', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 1 })
    })))
    await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled())
  })

  it('the answer field is a multi-line textarea with 3 default rows', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    const field = screen.getByRole('textbox')
    expect(field.tagName).toBe('TEXTAREA')
    expect(field).toHaveAttribute('rows', '3')
    expect(field).toHaveAttribute('placeholder', 'Type what you hear, or tap the mic to speak it instead')
  })

  it('shows a recording indicator while the mic is listening, and hides it when recognition ends', async () => {
    class FakeSpeechRecognition {
      continuous = false
      interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn()
      stop = vi.fn()
    }
    let fakeInstance: FakeSpeechRecognition
    vi.stubGlobal('SpeechRecognition', vi.fn().mockImplementation(function (this: unknown) {
      fakeInstance = new FakeSpeechRecognition()
      return fakeInstance
    }))

    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    expect(screen.queryByLabelText('Recording')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /use microphone/i }))

    expect(screen.getByLabelText('Recording')).toBeInTheDocument()
    expect(screen.getByLabelText('Recording')).toHaveClass('recording-dot')
    expect(fakeInstance!.continuous).toBe(true)

    const stopButton = screen.getByRole('button', { name: /stop microphone/i })
    fireEvent.click(stopButton)
    expect(fakeInstance!.stop).toHaveBeenCalled()

    fakeInstance!.onend!()

    await waitFor(() => expect(screen.queryByLabelText('Recording')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /use microphone/i })).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('appends recognized speech to whatever was already typed, rather than replacing it', async () => {
    class FakeSpeechRecognition {
      continuous = false
      interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn()
      stop = vi.fn()
    }
    let fakeInstance: FakeSpeechRecognition
    vi.stubGlobal('SpeechRecognition', vi.fn().mockImplementation(function (this: unknown) {
      fakeInstance = new FakeSpeechRecognition()
      return fakeInstance
    }))

    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: /use microphone/i }))

    fakeInstance!.onresult!({ results: [[{ transcript: 'there' }]] })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Hello there'))

    // Stopping without any further recognized speech must not clear the text.
    fireEvent.click(screen.getByRole('button', { name: /stop microphone/i }))
    fakeInstance!.onend!()
    await waitFor(() => expect(screen.queryByRole('button', { name: /use microphone/i })).toBeInTheDocument())
    expect(screen.getByRole('textbox')).toHaveValue('Hello there')

    vi.unstubAllGlobals()
  })

  it('advancing to the next sentence while recording starts a fresh transcript segment, not accumulating the old sentence\'s words', async () => {
    class FakeSpeechRecognition {
      continuous = false
      interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn()
      stop = vi.fn()
    }
    let fakeInstance: FakeSpeechRecognition
    vi.stubGlobal('SpeechRecognition', vi.fn().mockImplementation(function (this: unknown) {
      fakeInstance = new FakeSpeechRecognition()
      return fakeInstance
    }))

    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /use microphone/i }))
    fakeInstance!.onresult!({ results: [[{ transcript: 'Hello there' }]] })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Hello there'))

    fireEvent.click(screen.getByRole('button', { name: /next sentence/i }))
    // Wait for the advance to actually land (session state committed, not just the fetch call
    // recorded) before firing more speech — otherwise this races the async advance and the
    // segment-reset effect it triggers.
    await screen.findByText('Sentence 2 / 2')

    // The underlying Web Speech API's event.results is cumulative and never shrinks — this
    // fires with BOTH the old sentence's finalized result and a newly recognized one, exactly
    // as the real API would mid-recording across a sentence boundary.
    fakeInstance!.onresult!({ results: [[{ transcript: 'Hello there' }], [{ transcript: 'Good morning' }]] })

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Good morning'))

    vi.unstubAllGlobals()
  })

  it('positions Reset to the left of the mic button after a wrong submission', async () => {
    class FakeSpeechRecognition {
      continuous = false
      interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn()
      stop = vi.fn()
    }
    vi.stubGlobal('SpeechRecognition', vi.fn().mockImplementation(function (this: unknown) {
      return new FakeSpeechRecognition()
    }))

    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 0, isCorrect: false, words: [{ word: 'Hello', status: 'Incorrect' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Wrong answer' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByText('Hello')

    const resetButton = screen.getByRole('button', { name: /^reset$/i })
    const mic = screen.getByRole('button', { name: /use microphone/i })
    expect(resetButton.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    vi.unstubAllGlobals()
  })

  it('shows the replay hint and opens/closes the shortcuts list', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    expect(screen.getByText('Press "Ctrl" to replay.')).toBeInTheDocument()
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /view other shortcuts/i }))
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Toggle microphone')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument()
  })

  describe('keyboard shortcuts', () => {
    it('the shortcuts modal blocks the underlying keyboard shortcuts while open', async () => {
      mockFetchSequence([
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.click(screen.getByRole('button', { name: /view other shortcuts/i }))
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
      fireEvent.keyDown(window, { key: 'Enter' })

      // Enter must not have triggered Check while the modal is open — no "Nice" result appears.
      expect(screen.queryByText('Nice — that\'s right!')).not.toBeInTheDocument()
    })

    it('Enter checks the answer, and Enter again advances after a correct check', async () => {
      mockFetchSequence([
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
        new Response(null, { status: 204 }),
        new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(await screen.findByText('Nice — that\'s right!')).toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'Enter' })
      await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
        body: JSON.stringify({ toIndex: 1 })
      })))
    })

    it('tapping Ctrl alone rewinds to the sentence start and replays it', async () => {
      mockFetchSequence([
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      const { container } = render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      const audio = container.querySelector('audio')!
      audio.currentTime = 1.5

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyUp(window, { key: 'Control' })

      expect(audio.currentTime).toBe(0)
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })

    it('Space does not trigger play/pause — the button responds to clicks only', async () => {
      mockFetchSequence([
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: ' ' })
      expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: /^play$/i }))
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })

    it('holding Ctrl and pressing > navigates to the next sentence and autoplays it', async () => {
      mockFetchSequence([
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
        new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: '>', ctrlKey: true })
      fireEvent.keyUp(window, { key: '>' })
      fireEvent.keyUp(window, { key: 'Control' })

      await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
        body: JSON.stringify({ toIndex: 1 })
      })))
      // The solo-Ctrl-tap replay handler must not ALSO fire on top of the combo's own autoplay.
      await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1))
    })

    it('Ctrl+< moves to the previous sentence', async () => {
      mockFetchSequence([
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 1, status: 'InProgress', completedAt: null }), { status: 200 }),
        new Response(JSON.stringify({ currentSentenceIndex: 0, isCompleted: false, overallAccuracy: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: '<', ctrlKey: true })

      await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
        body: JSON.stringify({ toIndex: 0 })
      })))
    })

    it('Ctrl+/ clears the result and typed answer and replays the audio, same as clicking Reset', async () => {
      mockFetchSequence([
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Wrong answer' } })
      fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
      await screen.findByText('Hello')

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: '/', ctrlKey: true })

      await waitFor(() => expect(screen.queryByText('Hello')).not.toBeInTheDocument())
      expect(screen.getByRole('textbox')).toHaveValue('')
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })

    it('Ctrl+Enter triggers Skip', async () => {
      mockFetchSequence([
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
        new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

      await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
        body: JSON.stringify({ toIndex: 1 })
      })))
      // Skipping marks Progress, unlike plain navigation — sentence 1 turns green (Progress
      // buttons always show the sentence number, no checkmark, so the color is what changes).
      await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toHaveStyle({ background: 'var(--leaf)' }))
    })

    it('Ctrl+M toggles the microphone', async () => {
      class FakeSpeechRecognition {
        continuous = false
        interimResults = false
        onresult: ((event: unknown) => void) | null = null
        onend: (() => void) | null = null
        start = vi.fn()
        stop = vi.fn()
      }
      vi.stubGlobal('SpeechRecognition', vi.fn().mockImplementation(function (this: unknown) {
        return new FakeSpeechRecognition()
      }))

      mockFetchSequence([
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null}/>)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: 'm', ctrlKey: true })

      expect(screen.getByLabelText('Recording')).toBeInTheDocument()

      vi.unstubAllGlobals()
    })
  })
  it('shows the sentence translation under the result panel when available', async () => {
    const translatedTrack = {
      ...track,
      sentences: [{ ...track.sentences[0], translation: '你好啊。' }, track.sentences[1]]
    }
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'Hello ', status: 'Correct' }, { word: 'there.', status: 'Correct' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={translatedTrack} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    expect(await screen.findByText('你好啊。')).toBeInTheDocument()
  })

  it('does not show a translation line when the sentence has none', async () => {
    mockFetchSequence([
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'Hello ', status: 'Correct' }, { word: 'there.', status: 'Correct' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    await screen.findByText('Nice — that\'s right!')
    expect(screen.queryByText('你好啊。')).not.toBeInTheDocument()
  })
})
