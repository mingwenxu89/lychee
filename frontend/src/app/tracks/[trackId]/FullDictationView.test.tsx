import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { FullDictationView } from './FullDictationView'
import type { LearnerTrack } from './page'

const track: LearnerTrack = {
  id: 'track-1', unitId: 'unit-1', exerciseId: 'exercise-1', title: 'Test Track', description: null,
  exerciseTitle: 'Test Exercise', level: 'A1', wordsPerMinute: 120, duration: '00:00:04',
  audioUrl: 'https://example.test/audio.mp3',
  sentences: [
    { id: 's1', index: 0, text: 'Hello there.', startTime: '00:00:00', endTime: '00:00:02', translation: null },
    { id: 's2', index: 1, text: 'Good morning.', startTime: '00:00:02', endTime: '00:00:04', translation: null }
  ],
  nextTrackId: null, isFavorited: false
}

type StartFixture = {
  id?: string
  status?: string
  currentSentenceIndex?: number
  correctSentenceIds?: string[]
  submittedTexts?: Record<string, string>
  completedAt?: string | null
}

// Routes by URL/method rather than a strict call-order queue — submit and advance are fired
// fire-and-forget, often several in a row (every Next, plus a whole-round resubmission sweep
// when a round ends), so asserting on exact call order would be brittle. Callers inspect
// fetchMock.mock.calls directly, filtered by URL, to check what was actually sent.
function mockFetch(options: {
  start?: StartFixture
  complete?: { score: number; finalCorrectSentenceIds: string[] }
  submitStatus?: number
  advanceStatus?: number
  completeStatus?: number
} = {}) {
  const {
    start = { id: 'session-1', status: 'InProgress', currentSentenceIndex: 0, correctSentenceIds: [], submittedTexts: {}, completedAt: null },
    complete = { score: 0, finalCorrectSentenceIds: [] },
    submitStatus = 204,
    advanceStatus = 204,
    completeStatus = 200
  } = options

  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/full-dictation-session/start')) {
      return new Response(JSON.stringify({ trackId: 'track-1', ...start }), { status: 200 })
    }
    if (url.includes('/submit')) {
      return new Response(null, { status: submitStatus })
    }
    if (url.includes('/advance')) {
      return new Response(null, { status: advanceStatus })
    }
    if (url.includes('/complete')) {
      return completeStatus === 200
        ? new Response(JSON.stringify(complete), { status: 200 })
        : new Response(null, { status: completeStatus })
    }
    throw new Error(`Unhandled fetch in test: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Extracts the parsed JSON bodies of every call whose URL contains `urlFragment`, in call order.
function bodiesFor(fetchMock: ReturnType<typeof vi.fn>, urlFragment: string): unknown[] {
  return fetchMock.mock.calls
    .filter((call: unknown[]) => (call[0] as string).includes(urlFragment))
    .map((call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string))
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

// Safety net for the couple of tests below that use vi.useFakeTimers() to simulate the
// setTimeout-scheduled sentence-boundary stop: if a test throws before reaching its own
// vi.useRealTimers() call, fake timers would otherwise stay active for every test that runs
// after it in this file (and even in later files sharing the same worker), silently breaking
// unrelated async assertions like screen.findByText's polling.
afterEach(() => {
  vi.useRealTimers()
})

describe('FullDictationView — Blind round', () => {
  it('starts with a Play/Pause control (matching SentencePracticeView, minus Previous/Next sentence buttons) and the first sentence ready for input', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)

    await screen.findByText(/sentence 1 \/ 2/i)
    expect(screen.getByRole('button', { name: /play|pause/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /previous sentence/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next sentence/i })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type what you hear/i)).toBeInTheDocument()
  })

  it('does not auto-play the very first sentence on entering Full Dictation — the learner presses Play themselves; every step after that auto-plays as usual', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>
    expect(playSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(playSpy).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)

    // s2 auto-plays without a manual click — only the very first sentence required one.
    expect(playSpy).toHaveBeenCalledTimes(2)
  })

  it('Reset clears the current answer and replays the sentence from its start, matching SentencePracticeView', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    const audio = document.querySelector('audio')!
    Object.defineProperty(audio, 'currentTime', { value: 1.5, writable: true })
    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>
    playSpy.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /^reset$/i }))

    expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('')
    expect(audio.currentTime).toBe(0)
    expect(playSpy).toHaveBeenCalled()
  })

  it('supports keyboard shortcuts: Ctrl+/ resets, and a bare tap of Ctrl plays/pauses', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>
    playSpy.mockClear()

    fireEvent.keyDown(window, { key: 'Control' })
    fireEvent.keyDown(window, { key: '/', ctrlKey: true })
    fireEvent.keyUp(window, { key: 'Control' })

    // The Ctrl+/ combo fired Reset (clearing the answer) — the bare-tap-plays-on-release
    // branch must not ALSO fire just because Control itself was released afterward.
    expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('')
    expect(playSpy).toHaveBeenCalledTimes(1)

    playSpy.mockClear()
    fireEvent.keyDown(window, { key: 'Control' })
    fireEvent.keyUp(window, { key: 'Control' })

    // A bare Ctrl tap (down, then up, with nothing else in between) plays/pauses.
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('shows a Play/Pause shortcut hint on hover and a link to view the rest of the shortcuts', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    expect(screen.getByRole('button', { name: /play/i })).toHaveAttribute('title', 'Play (Ctrl)')
    expect(screen.getByText('Press "Ctrl" to play or pause.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /view other shortcuts/i }))

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Play / Pause')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
    expect(screen.getByText('Toggle microphone')).toBeInTheDocument()
    // Full Dictation has no sentence-navigation or Skip controls, unlike SentencePracticeView.
    expect(screen.queryByText('Previous sentence')).not.toBeInTheDocument()
    expect(screen.queryByText('Skip')).not.toBeInTheDocument()
  })

  it('the Play/Pause button label updates to Pause once playing, matching its shortcut hint', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    const audio = document.querySelector('audio')!
    Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true })
    fireEvent(audio, new Event('play'))

    expect(screen.getByRole('button', { name: /pause/i })).toHaveAttribute('title', 'Pause (Ctrl)')
  })

  it('closing the shortcuts modal re-enables keyboard shortcuts, and they are suspended while it is open', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    fireEvent.click(screen.getByRole('button', { name: /view other shortcuts/i }))
    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>
    playSpy.mockClear()

    // Ctrl tap must not play/pause while the modal has focus.
    fireEvent.keyDown(window, { key: 'Control' })
    fireEvent.keyUp(window, { key: 'Control' })
    expect(playSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Control' })
    fireEvent.keyUp(window, { key: 'Control' })
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('shows a header progress bar matching SentencePracticeView\'s, tracking position within the round', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByText(/sentence 1 \/ 2/i)

    const bar = document.querySelector('div[style*="height: 10px"] > div') as HTMLElement
    expect(bar.style.width).toBe('50%')

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByText(/sentence 2 \/ 2/i)
    expect(bar.style.width).toBe('100%')
  })

  it('reaching the end of a sentence pauses and rewinds it back to its start, matching SentencePracticeView — so clicking Play again replays it (there is no separate Replay button)', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    const audio = document.querySelector('audio')!
    // s1 runs 00:00:00 -> 00:00:02: starting playback at 0 schedules a stop 2s later
    // (a setTimeout now, not a 'timeupdate' check — see the effect for why).
    vi.useFakeTimers()
    Object.defineProperty(audio, 'currentTime', { value: 0, writable: true })
    fireEvent(audio, new Event('play'))
    audio.currentTime = 1.5 // simulate real playback having advanced partway through
    vi.advanceTimersByTime(2000)
    vi.useRealTimers()

    expect(audio.currentTime).toBe(0)
  })

  it('clicking Play/Pause toggles playback directly, matching SentencePracticeView', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    const audio = document.querySelector('audio')!
    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>
    const pauseSpy = window.HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>
    playSpy.mockClear()
    pauseSpy.mockClear()

    // jsdom doesn't drive `paused`/fire play-pause events from stubbed play()/pause() calls, so
    // both are set explicitly here — `paused` for the click handler's own branch, the event for
    // the button's aria-label (driven by isPlaying, updated via the real play/pause listeners).
    Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true })
    fireEvent(audio, new Event('play'))
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(pauseSpy).toHaveBeenCalled()

    Object.defineProperty(audio, 'paused', { value: true, writable: true, configurable: true })
    fireEvent(audio, new Event('pause'))
    fireEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(playSpy).toHaveBeenCalled()
  })

  it('shows a Progress grid with every sentence in the track, and jumping via it saves the current answer and pre-fills the target sentence', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    expect(screen.getByText('Progress')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => expect(screen.getByText(/sentence 2 \/ 2/i)).toBeInTheDocument())
    expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: '1' }))

    await waitFor(() => expect(screen.getByText(/sentence 1 \/ 2/i)).toBeInTheDocument())
    expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('Hello there.')
  })

  it('marks an answered sentence green in the Progress grid once its typed text is actually correct, not just answered', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    // s1 typed correctly, then jump away to s2 — s1's grid button should turn green immediately,
    // without waiting for the round to end.
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(screen.getByText(/sentence 2 \/ 2/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '1' })).toHaveStyle({ background: 'var(--leaf)', color: 'rgb(255, 255, 255)' })

    // s2 typed incorrectly, then jump back to s1 — s2's grid button stays the neutral "answered"
    // tint, not green.
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'completely wrong' } })
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    await waitFor(() => expect(screen.getByText(/sentence 1 \/ 2/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '2' })).toHaveStyle({ background: 'var(--primary-soft)' })
  })

  it('a resumed session shows last time\'s correct sentences green in the Progress grid immediately, before revisiting them', async () => {
    // s2 (not s1) was correct last time, and the resumed position (0) is s1 — s2's color must
    // reflect its carried-over correctness right away, not the "current step" styling.
    mockFetch({ start: { currentSentenceIndex: 0, correctSentenceIds: ['s2'] } })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    // Resume goes straight into dictation — no review screen first, matching Sentence Dictation.
    await screen.findByPlaceholderText(/type what you hear/i)

    // s2 was correct before and hasn't been touched at all this round — it must show green right
    // away, not only after being re-typed and left again.
    expect(screen.getByRole('button', { name: '2' })).toHaveStyle({ background: 'var(--leaf)', color: 'rgb(255, 255, 255)' })
    // s1 is the current step — neither green nor the "answered but wrong" tint, since it hasn't
    // actually been submitted this round yet.
    expect(screen.getByRole('button', { name: '1' })).toHaveStyle({ background: 'var(--surface)' })
  })

  it('grades a sentence that was jumped clean over (never visited at all) as incorrect, not silently excluded from grading', async () => {
    const threeSentenceTrack: LearnerTrack = {
      ...track,
      sentences: [
        { id: 's1', index: 0, text: 'Hello there.', startTime: '00:00:00', endTime: '00:00:02', translation: null },
        { id: 's2', index: 1, text: 'Good morning.', startTime: '00:00:02', endTime: '00:00:04', translation: null },
        { id: 's3', index: 2, text: 'How are you?', startTime: '00:00:04', endTime: '00:00:06', translation: null }
      ]
    }
    const fetchMock = mockFetch()

    render(<FullDictationView track={threeSentenceTrack} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    // Jump straight from s1 to s3 — s2 is never visited at all this round.
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    await waitFor(() => expect(screen.getByText(/sentence 3 \/ 3/i)).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'How are you?' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByRole('button', { name: /^next round$/i })
    const submitted = bodiesFor(fetchMock, '/submit') as { sentenceId: string; isCorrect: boolean; submittedText: string }[]
    const bySentence = Object.fromEntries(submitted.map((s) => [s.sentenceId, s]))
    expect(bySentence.s3).toMatchObject({ isCorrect: true, submittedText: 'How are you?' })
    expect(bySentence.s2).toMatchObject({ isCorrect: false, submittedText: '' })
    expect(bySentence.s1).toMatchObject({ isCorrect: false, submittedText: '' })
  })

  it('calls onBack when the Back button is clicked', async () => {
    mockFetch()
    const onBack = vi.fn()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={onBack} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByText(/sentence 1 \/ 2/i)

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(onBack).toHaveBeenCalled()
  })

  it('auto-focuses the textarea as soon as a step becomes ready for input', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)

    expect(await screen.findByPlaceholderText(/type what you hear/i)).toHaveFocus()
  })

  it('supports voice-to-text: shows a recording indicator while listening and appends recognized speech to what was already typed', async () => {
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

    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    expect(screen.queryByLabelText('Recording')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: /use microphone/i }))

    expect(screen.getByLabelText('Recording')).toHaveClass('recording-dot')
    expect(fakeInstance!.continuous).toBe(true)

    fakeInstance!.onresult!({ results: [[{ transcript: 'there' }]] })
    await waitFor(() => expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('Hello there'))

    fireEvent.click(screen.getByRole('button', { name: /stop microphone/i }))
    fakeInstance!.onend!()

    await waitFor(() => expect(screen.queryByLabelText('Recording')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /use microphone/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('Hello there')

    vi.unstubAllGlobals()
  })

  it('returns focus to the textarea after clicking the mic button, so Enter still submits/advances instead of re-toggling the still-focused mic button', async () => {
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

    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    const textarea = await screen.findByPlaceholderText(/type what you hear/i)

    // A real browser moves DOM focus onto a button as part of clicking it, before the click
    // handler runs — fireEvent.click doesn't simulate that focus shift, so it's done explicitly
    // here (focusing first, then clicking) to reproduce the reported bug's starting condition.
    const micButton = screen.getByRole('button', { name: /use microphone/i })
    micButton.focus()
    fireEvent.click(micButton)
    expect(textarea).toHaveFocus()

    const stopButton = screen.getByRole('button', { name: /stop microphone/i })
    stopButton.focus()
    fireEvent.click(stopButton)
    expect(textarea).toHaveFocus()

    vi.unstubAllGlobals()
  })

  it('keeps recording across a sentence advance (only an explicit click/shortcut may stop the mic), and resets the transcript segment so the old sentence\'s text cannot bleed into the new one', async () => {
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

    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    // Start recording on sentence 1 and leave it running (never click "Stop microphone").
    fireEvent.click(screen.getByRole('button', { name: /use microphone/i }))
    fakeInstance!.onresult!({ results: [[{ transcript: 'Hello there' }]] })
    await waitFor(() => expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('Hello there'))

    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)

    // The mic must never auto-stop just because the sentence advanced — only an explicit click
    // or Ctrl+M may stop it.
    expect(fakeInstance!.stop).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Recording')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop microphone/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('')

    // The underlying recognizer's own transcript never resets on its own — event.results keeps
    // growing for the whole session — so a fresh result for sentence 2 arrives alongside
    // sentence 1's old entry still in the array. Only the NEW segment should show up as the
    // answer, not sentence 1's words prepended onto it.
    fakeInstance!.onresult!({ results: [[{ transcript: 'Hello there' }], [{ transcript: 'Good morning' }]] })
    await waitFor(() => expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('Good morning'))

    vi.unstubAllGlobals()
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

    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    fireEvent.keyDown(window, { key: 'm', ctrlKey: true })

    expect(await screen.findByRole('button', { name: /stop microphone/i })).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('shows previously answered sentences in a scrollback feed, with what the learner actually typed', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello their' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByPlaceholderText(/type what you hear/i)
    expect(screen.getByText('Hello their')).toBeInTheDocument()
    expect(await screen.findByPlaceholderText(/type what you hear/i)).toHaveFocus()
  })

  it('a resumed already-correct sentence still pauses and requires input — every round re-tests every sentence', async () => {
    mockFetch({ start: { currentSentenceIndex: 0, correctSentenceIds: ['s1'] } })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)

    // s1 is already correct from before, but this round must still pause and wait for input on
    // it rather than auto-playing straight through — the audio must never advance to s2 without
    // the learner submitting s1 first.
    await screen.findByPlaceholderText(/type what you hear/i)
    const audio = document.querySelector('audio')!
    Object.defineProperty(audio, 'currentTime', { value: 2, writable: true })
    fireEvent(audio, new Event('timeupdate'))

    expect(screen.getByText(/sentence 1 \/ 2/i)).toBeInTheDocument()
  })

  it('submitting the last sentence of a round with one wrong answer shows a score and lets the learner continue or finish, not a completion', async () => {
    const fetchMock = mockFetch()
    const onCompleted = vi.fn()

    render(<FullDictationView track={track} onCompleted={onCompleted} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'completely wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByRole('button', { name: /^next round$/i })
    // The round-choice screen shows the same score + word-diff review as the final summary.
    expect(screen.getByText('50% correct')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finish now/i })).toBeInTheDocument()
    expect(onCompleted).not.toHaveBeenCalled()

    const submitted = bodiesFor(fetchMock, '/submit') as { sentenceId: string; isCorrect: boolean }[]
    const bySentence = Object.fromEntries(submitted.map((s) => [s.sentenceId, s.isCorrect]))
    expect(bySentence).toEqual({ s1: true, s2: false })
    // The round ended without everything correct — position resets to 0 for the next round.
    expect(bodiesFor(fetchMock, '/advance')).toContainEqual({ toIndex: 0 })
  })

  it('Finish Now on the round-choice screen completes the session without requiring another round', async () => {
    const fetchMock = mockFetch({ complete: { score: 0.5, finalCorrectSentenceIds: ['s1'] } })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('button', { name: /finish now/i })

    fireEvent.click(screen.getByRole('button', { name: /finish now/i }))

    // "Done" only exists on the final summary screen (not the round-choice screen, which now
    // also shows a score) — waiting for it confirms Finish Now actually completed the session.
    await screen.findByRole('button', { name: /^done$/i })
    expect(screen.getByText('50% correct')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/learner/full-dictation-sessions/session-1/complete',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('finishing a round with everything correct shows the summary screen, then calls onCompleted when Done is clicked', async () => {
    mockFetch({ complete: { score: 1, finalCorrectSentenceIds: ['s1', 's2'] } })
    const onCompleted = vi.fn()

    render(<FullDictationView track={track} onCompleted={onCompleted} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good morning.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByText(/100%/)
    expect(screen.queryByRole('button', { name: /^next round$/i })).not.toBeInTheDocument()
    expect(onCompleted).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    expect(onCompleted).toHaveBeenCalledWith(1)
  })

  it('the summary screen shows what the learner actually typed for each sentence, with correct words in green', async () => {
    mockFetch({ complete: { score: 0.5, finalCorrectSentenceIds: ['s1'] } })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good evening.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    fireEvent.click(await screen.findByRole('button', { name: /finish now/i }))

    await screen.findByText(/50%/)

    // s1 ("Hello there.") was typed correctly — every word shows the deep-green "correct" color.
    expect(screen.getByText('Hello')).toHaveStyle({ color: 'oklch(38% 0.13 145)' })
    expect(screen.getByText('there.')).toHaveStyle({ color: 'oklch(38% 0.13 145)' })

    // s2 ("Good morning.") was typed as "Good evening." — "Good" matched (green), "morning."
    // (the reference word, since dictation-variant DiffText shows reference text) is pink,
    // since the learner's actual word didn't match.
    expect(screen.getByText('morning.')).toHaveStyle({ color: 'var(--primary)' })
  })

  it('the summary screen lets the learner replay a single sentence, stopping at its own end without advancing to the next one', async () => {
    mockFetch({ complete: { score: 1, finalCorrectSentenceIds: ['s1', 's2'] } })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good morning.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText(/100%/)

    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>
    const pauseSpy = window.HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>
    playSpy.mockClear()

    // playResultSentence schedules its stop as a setTimeout (see there for why it's not a
    // 'timeupdate' check), so fake timers need to be active before the click that starts it.
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Play sentence 2' }))

    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(2)
    expect(playSpy).toHaveBeenCalledTimes(1)

    // Reaching s2's own end (00:00:04) pauses — it must not keep playing into whatever (there is
    // no sentence 3) would come after it.
    vi.advanceTimersByTime(2000)
    vi.useRealTimers()
    expect(pauseSpy).toHaveBeenCalledTimes(1)
  })

  it('the round-choice screen also lets the learner replay a single sentence', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('button', { name: /^next round$/i })

    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>
    playSpy.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Play sentence 1' }))

    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(0)
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('clicking anywhere on a result row plays that sentence, not just its trailing play button', async () => {
    mockFetch({ complete: { score: 1, finalCorrectSentenceIds: ['s1', 's2'] } })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good morning.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText(/100%/)

    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>
    playSpy.mockClear()

    // "Good morning." is s2's reference text — click the word itself, not the play button.
    fireEvent.click(screen.getByText('morning.'))

    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(2)
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('highlights the currently-playing result row, and clicking it again pauses and clears the highlight', async () => {
    mockFetch({ complete: { score: 1, finalCorrectSentenceIds: ['s1', 's2'] } })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good morning.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText(/100%/)

    const pauseSpy = window.HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>
    const row2 = screen.getByRole('button', { name: 'Play sentence 2' }).closest('div')!

    fireEvent.click(screen.getByRole('button', { name: 'Play sentence 2' }))
    expect(row2).toHaveStyle({ background: 'var(--primary-soft)' })

    pauseSpy.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Play sentence 2' }))
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(row2).toHaveStyle({ background: 'transparent' })
  })

  it('switching to a different result row while one is playing clears the old highlight and sets the new one', async () => {
    mockFetch({ complete: { score: 1, finalCorrectSentenceIds: ['s1', 's2'] } })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good morning.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText(/100%/)

    const row1 = screen.getByRole('button', { name: 'Play sentence 1' }).closest('div')!
    const row2 = screen.getByRole('button', { name: 'Play sentence 2' }).closest('div')!

    fireEvent.click(screen.getByRole('button', { name: 'Play sentence 1' }))
    expect(row1).toHaveStyle({ background: 'var(--primary-soft)' })

    fireEvent.click(screen.getByRole('button', { name: 'Play sentence 2' }))
    expect(row1).toHaveStyle({ background: 'transparent' })
    expect(row2).toHaveStyle({ background: 'var(--primary-soft)' })

    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(2)
  })

  it('re-grades a previously-correct sentence fresh each round: editing it wrong sends it back as incorrect, not permanently correct', async () => {
    // s2 was already correct from before, but this round still requires input for it (see the
    // "still pauses" test above) — submit a wrong edit for both sentences and confirm the
    // end-of-round submissions report both as incorrect rather than silently keeping s2 correct.
    const fetchMock = mockFetch({ start: { currentSentenceIndex: 0, correctSentenceIds: ['s2'] } })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'not morning at all' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByRole('button', { name: /^next round$/i })
    const submitted = bodiesFor(fetchMock, '/submit') as { sentenceId: string; isCorrect: boolean }[]
    const bySentence = Object.fromEntries(submitted.map((s) => [s.sentenceId, s.isCorrect]))
    expect(bySentence).toEqual({ s1: false, s2: false })
  })

  it('the round-choice screen shows the same score and word-diff review as the final summary screen', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await screen.findByRole('button', { name: /^next round$/i })
    expect(screen.getByText('50% correct')).toBeInTheDocument()
    // s1 was typed correctly — every word shows the deep-green "correct" color, same treatment
    // as the final summary screen.
    expect(screen.getByText('Hello')).toHaveStyle({ color: 'oklch(38% 0.13 145)' })
    expect(screen.getByText('there.')).toHaveStyle({ color: 'oklch(38% 0.13 145)' })
  })

  it('resuming mid-loop lands directly in dictation at the persisted sentence position, pre-filled from what was last submitted — no review screen first', async () => {
    mockFetch({
      start: {
        currentSentenceIndex: 1,
        correctSentenceIds: ['s1'],
        submittedTexts: { s1: 'Hello there.', s2: 'completely wrong' }
      }
    })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)

    await screen.findByText(/sentence 2 \/ 2/i)
    expect(screen.queryByRole('button', { name: /^next round$/i })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('completely wrong')
    expect(screen.getByRole('button', { name: '1' })).toHaveStyle({ background: 'var(--leaf)', color: 'rgb(255, 255, 255)' })
  })

  it('previews the upcoming sentence\'s previous-round answer below the textarea in round 2, and shows nothing in round 1', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)

    // Round 1: no prior round to preview from.
    expect(screen.queryByText(/^next:/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('button', { name: /^next round$/i })

    fireEvent.click(screen.getByRole('button', { name: /^next round$/i }))
    await screen.findByText(/sentence 1 \/ 2/i)

    // On round 2's first sentence (s1), the preview shows what was typed for the NEXT sentence
    // (s2) last round.
    expect(screen.getByText('Next: wrong')).toBeInTheDocument()
  })

  it('finishes an empty-track round immediately instead of showing a stuck empty screen', async () => {
    const emptyTrack: LearnerTrack = { ...track, sentences: [] }
    mockFetch({ complete: { score: 0, finalCorrectSentenceIds: [] } })

    render(<FullDictationView track={emptyTrack} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)

    await screen.findByText(/0%/)
  })

  it('shows an error and does not show the summary when the complete call fails, and Retry redoes it', async () => {
    mockFetch({ completeStatus: 500 })

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Good morning.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Both sentences correct — this goes straight for /complete, which fails (500): the summary
    // must not appear, since that would tell the learner their session finished when it didn't.
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to save/i)
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument()

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/complete')) return new Response(JSON.stringify({ score: 1, finalCorrectSentenceIds: ['s1', 's2'] }), { status: 200 })
      return new Response(null, { status: 204 })
    }))
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await screen.findByText(/100%/)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clicking "Next Round" starts the next round pre-filled with what was submitted for that sentence last round, so the learner edits rather than retypes', async () => {
    mockFetch()

    render(<FullDictationView track={track} onCompleted={vi.fn()} onBack={vi.fn()} audioObjectUrl="blob:fake" audioError={null} />)
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'Hello there.' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByPlaceholderText(/type what you hear/i)
    fireEvent.change(screen.getByPlaceholderText(/type what you hear/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('button', { name: /^next round$/i })

    fireEvent.click(screen.getByRole('button', { name: /^next round$/i }))

    await screen.findByText(/sentence 1 \/ 2/i)
    expect(screen.queryByRole('button', { name: /^next round$/i })).not.toBeInTheDocument()
    // Round 2 starts on s1 again, pre-filled with round 1's answer for it (not blank).
    expect(screen.getByPlaceholderText(/type what you hear/i)).toHaveValue('Hello there.')
  })
})
