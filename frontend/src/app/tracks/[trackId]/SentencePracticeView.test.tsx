import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { SentencePracticeView } from './SentencePracticeView'
import type { LearnerTrack } from './page'

// jsdom's own `Blob` global doesn't implement `.stream()`, which Node's real
// `Response` constructor (used by the `new Response(...)` fixtures below) requires.
// This is a jsdom-environment limitation local to this file's fixtures, not a
// production concern, so the fix is scoped here rather than in the shared
// vitest.setup.ts (see: prior Task 10 revert of a global jsdom monkey-patch).
;(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob

const track: LearnerTrack = {
  id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'Test Track', description: null, exerciseTitle: 'Test Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:04',
  audioUrl: 'https://example.test/audio.mp3',
  sentences: [
    { id: 's1', index: 1, text: 'Hello there.', startTime: '00:00:00', endTime: '00:00:02' },
    { id: 's2', index: 2, text: 'Good morning.', startTime: '00:00:02', endTime: '00:00:04' }
  ],
  nextTrackId: null
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
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^check$/i })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())
  })

  it('Check compares locally and, on a wrong answer, shows the diff without contacting the backend', async () => {
    const fetchMock = mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello world.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    expect(await screen.findByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('there.')).toBeInTheDocument()
    // A wrong answer is never sent to the backend at all — only the audio preload and
    // session-start calls have happened.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // The "So close" icon and message are gone — only the diff itself is shown.
    expect(screen.queryByText(/so close/i)).not.toBeInTheDocument()
  })

  it('on a correct answer, hides the diff text and shows only the checkmark and message', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'Hello', status: 'Correct' }, { word: 'there.', status: 'Correct' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    expect(await screen.findByText('Nice — that\'s right!')).toBeInTheDocument()
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
  })

  it('on a correct answer, replaces the typed text with the clean reference sentence', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'well', status: 'Extra' }, { word: 'Hello', status: 'Correct' }, { word: 'there.', status: 'Correct' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'well Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    await screen.findByText('Nice — that\'s right!')
    expect(screen.getByRole('textbox')).toHaveValue('Hello there.')
  })

  it('Skip advances the session and calls onCompleted after the last sentence', async () => {
    const onCompleted = vi.fn()
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 1, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 2, isCompleted: true, overallAccuracy: 0.9 }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={onCompleted} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))

    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(0.9))
  })

  it('Next advances after a correct submission', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 1, isCorrect: true, words: [{ word: 'Hello', status: 'Correct' }] }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByText('Nice — that\'s right!')

    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 1 })
    })))
  })

  it('Try Again is always visible and clears the result once one exists', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 0, isCorrect: false, words: [{ word: 'Hello', status: 'Incorrect' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    expect(screen.getByRole('button', { name: /^try again$/i })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Wrong answer' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByText('Hello')

    const tryAgain = screen.getByRole('button', { name: /^try again$/i })
    expect(tryAgain).toBeInTheDocument()
    // Check and Skip remain available at the bottom alongside Try Again.
    expect(screen.getByRole('button', { name: /^check$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^skip$/i })).toBeInTheDocument()

    fireEvent.click(tryAgain)

    await waitFor(() => expect(screen.queryByText('Hello')).not.toBeInTheDocument())
  })

  it('jumps to a clicked sentence in the list', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByText('2'))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 1 })
    })))
  })

  it('clicking a Progress number only navigates, without marking anything done', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByText('2'))
    await waitFor(() => expect(screen.getByRole('button', { name: /previous sentence/i })).not.toBeDisabled())

    // Sentence 1 must still show its plain number, not a green checkmark — jumping via the
    // Progress list is pure navigation and must not mark anything as done.
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('the previous/next navigation arrows do not mark sentences as done in Progress', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /next sentence/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /previous sentence/i })).not.toBeDisabled())

    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('Skip marks the current sentence as done in Progress', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))

    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument())
  })

  it('still shows the correct result locally, but shows an inline error when saving the record fails', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(null, { status: 500 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))

    expect(await screen.findByText('Nice — that\'s right!')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to save your progress/i))
    expect(screen.getByRole('textbox')).toHaveValue('Hello there.')
  })

  it('shows an inline error and keeps the current sentence when advance fails', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(null, { status: 500 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'my draft answer' } })
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to save your progress/i))
    expect(screen.getByRole('textbox')).toHaveValue('my draft answer')
  })

  it('toggles the play button to a pause icon while the audio plays', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    const { container } = render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
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
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 1, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 0, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /previous sentence/i }))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 0 })
    })))
  })

  it('disables the previous-sentence button on the first sentence', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    expect(screen.getByRole('button', { name: /previous sentence/i })).toBeDisabled()
  })

  it('the next-sentence button next to the play control advances like Skip', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /next sentence/i }))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
      body: JSON.stringify({ toIndex: 1 })
    })))
  })

  it('the answer field is a multi-line textarea with 3 default rows', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
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
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
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
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
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

  it('positions Try Again to the left of the mic button after a wrong submission', async () => {
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
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
      new Response(JSON.stringify({ accuracyScore: 0, isCorrect: false, words: [{ word: 'Hello', status: 'Incorrect' }] }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Wrong answer' } })
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
    await screen.findByText('Hello')

    const tryAgain = screen.getByRole('button', { name: /^try again$/i })
    const mic = screen.getByRole('button', { name: /use microphone/i })
    expect(tryAgain.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    vi.unstubAllGlobals()
  })

  it('shows the replay hint and opens/closes the shortcuts list', async () => {
    mockFetchSequence([
      new Response(new Blob(['audio-bytes']), { status: 200 }),
      new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
    ])

    render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
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
        new Response(new Blob(['audio-bytes']), { status: 200 }),
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.click(screen.getByRole('button', { name: /view other shortcuts/i }))
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there.' } })
      fireEvent.keyDown(window, { key: 'Enter' })

      // Enter must not have triggered Check while the modal is open — no "Nice" result appears.
      expect(screen.queryByText('Nice — that\'s right!')).not.toBeInTheDocument()
    })

    it('Enter checks the answer, and Enter again advances after a correct check', async () => {
      mockFetchSequence([
        new Response(new Blob(['audio-bytes']), { status: 200 }),
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
        new Response(null, { status: 204 }),
        new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
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
        new Response(new Blob(['audio-bytes']), { status: 200 }),
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      const { container } = render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
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
        new Response(new Blob(['audio-bytes']), { status: 200 }),
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: ' ' })
      expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: /^play$/i }))
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })

    it('holding Ctrl and pressing an arrow navigates sentences without triggering play/pause', async () => {
      mockFetchSequence([
        new Response(new Blob(['audio-bytes']), { status: 200 }),
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
        new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true })
      fireEvent.keyUp(window, { key: 'ArrowRight' })
      fireEvent.keyUp(window, { key: 'Control' })

      await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
        body: JSON.stringify({ toIndex: 1 })
      })))
      expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    })

    it('Ctrl+ArrowLeft moves to the previous sentence', async () => {
      mockFetchSequence([
        new Response(new Blob(['audio-bytes']), { status: 200 }),
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 1, status: 'InProgress', completedAt: null }), { status: 200 }),
        new Response(JSON.stringify({ currentSentenceIndex: 0, isCompleted: false, overallAccuracy: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true })

      await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
        body: JSON.stringify({ toIndex: 0 })
      })))
    })

    it('Ctrl+ArrowUp clears the result, same as clicking Try Again', async () => {
      mockFetchSequence([
        new Response(new Blob(['audio-bytes']), { status: 200 }),
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Wrong answer' } })
      fireEvent.click(screen.getByRole('button', { name: /^check$/i }))
      await screen.findByText('Hello')

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: 'ArrowUp', ctrlKey: true })

      await waitFor(() => expect(screen.queryByText('Hello')).not.toBeInTheDocument())
    })

    it('Ctrl+Enter triggers Skip', async () => {
      mockFetchSequence([
        new Response(new Blob(['audio-bytes']), { status: 200 }),
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 }),
        new Response(JSON.stringify({ currentSentenceIndex: 1, isCompleted: false, overallAccuracy: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

      await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/learner/practice-sessions/session-1/advance', expect.objectContaining({
        body: JSON.stringify({ toIndex: 1 })
      })))
      // Skipping marks Progress, unlike plain navigation — sentence 1 no longer shows its number.
      await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument())
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
        new Response(new Blob(['audio-bytes']), { status: 200 }),
        new Response(JSON.stringify({ id: 'session-1', trackId: 'track-1', currentSentenceIndex: 0, status: 'InProgress', completedAt: null }), { status: 200 })
      ])

      render(<SentencePracticeView track={track} onCompleted={vi.fn()} />)
      await waitFor(() => expect(screen.getByRole('button', { name: /^check$/i })).not.toBeDisabled())

      fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
      fireEvent.keyDown(window, { key: 'm', ctrlKey: true })

      expect(screen.getByLabelText('Recording')).toBeInTheDocument()

      vi.unstubAllGlobals()
    })
  })
})
