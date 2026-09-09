'use client'

import { useEffect, useRef, useState } from 'react'
import { parseTimeSpanToSeconds } from '@/lib/timeSpan'
import { isSpeechRecognitionSupported, createContinuousRecognizer } from '@/lib/speechRecognition'
import { compare } from '@/lib/textComparer'
import { DiffText } from '@/components/DiffText'
import { SentenceProgressGrid } from './SentenceProgressGrid'
import { buildBlindRoundSteps, gradeBlindRound, type RoundStep } from './fullDictationEngine'
import type { LearnerTrack } from './page'

type SessionState = { id: string }
type StartResponse = {
  id: string
  currentSentenceIndex: number
  correctSentenceIds: string[]
  submittedTexts: Record<string, string>
}
type CompleteResponse = { score: number; finalCorrectSentenceIds: string[] }
type SummaryState = { score: number; finalCorrectSentenceIds: string[] }

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  boxShadow: 'none'
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--primary)',
  color: 'white',
  fontWeight: 800,
  fontSize: 16,
  border: 'none',
  borderRadius: 999,
  padding: '14px 30px',
  boxShadow: 'none',
  cursor: 'pointer'
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 16,
  border: '2px solid var(--line)',
  borderRadius: 999,
  padding: '12px 26px',
  cursor: 'pointer'
}

// Matches SentencePracticeView's btnPrimarySmall — the per-sentence Next action here plays
// the exact same UX role as that view's Check/Next button, so it should read as the same size.
const btnPrimarySmall: React.CSSProperties = {
  ...btnPrimary,
  fontSize: 14,
  padding: '11px 24px',
  boxShadow: 'none'
}

// Matches SentencePracticeView's btnGhostSmall — used so "Next Round"/"Finish Now" read at the
// same size as Check/Skip rather than the larger default btnPrimary/btnGhost.
const btnGhostSmall: React.CSSProperties = {
  ...btnGhost,
  fontSize: 14,
  padding: '9px 20px'
}

// A deeper green than the shared --leaf-dark token, used only for the result screens' correct-
// word text/checkmark — --leaf-dark is a widely shared token (admin pages, other success
// banners), so it's overridden locally here rather than darkened everywhere.
const resultCorrectColor = 'oklch(38% 0.13 145)'

// Matches RecitationPanel's result screen exactly, so a round's end reads the same whether it
// came from Full Dictation or Recite: a neutral hueless gray behind the per-sentence review list.
const resultPanelBg = 'oklch(96% 0 0)'

// Matches SentencePracticeView's shortcuts-modal styling exactly.
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'oklch(22% 0.03 270 / 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10
}

const modalStyle: React.CSSProperties = {
  width: 420,
  maxWidth: '92vw',
  background: 'var(--surface)',
  borderRadius: 28,
  boxShadow: 'none',
  padding: '32px 36px',
  display: 'flex',
  flexDirection: 'column',
  gap: 18
}

const keyBadgeStyle: React.CSSProperties = {
  background: 'oklch(96% 0.01 80)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '4px 10px',
  fontWeight: 800,
  fontSize: 13,
  color: 'var(--ink-soft)',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap'
}

// Full Dictation's actual shortcut set — no Previous/Next sentence or Skip shortcuts here (there's
// no sentence-navigation control), unlike SentencePracticeView's fuller list.
const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'Enter', description: 'Next' },
  { keys: 'Ctrl', description: 'Play / Pause' },
  { keys: 'Ctrl + /', description: 'Reset' },
  { keys: 'Ctrl + M', description: 'Toggle microphone' }
]

// Shared by the round-choice and final-summary screens (see their render sites) so both present
// the score identically — an icon+title on the left, sentence count and score badge on the right.
function ResultHeader({ title, correctCount, total, score }: { title: string; correctCount: number; total: number; score: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--leaf-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--leaf-dark)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600 }}>Graded sentence by sentence</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
          {correctCount} / {total} sentences
        </span>
        <span style={{ background: 'var(--leaf-dark)', color: 'white', fontWeight: 800, fontSize: 14, borderRadius: 999, padding: '8px 18px' }}>
          {Math.round(score * 100)}% correct
        </span>
      </div>
    </div>
  )
}

// Matches SentencePracticeView's chipStyle exactly, so the "Sentence N / Total" badge reads
// identically in both views.
const chipStyle: React.CSSProperties = {
  background: 'oklch(96% 0.01 80)',
  borderRadius: 999,
  padding: '8px 16px',
  fontWeight: 700,
  fontSize: 13,
  color: 'var(--ink-soft)'
}

type AnsweredEntry = { sentenceId: string; referenceText: string; submittedText: string | null }

// Matches SentencePracticeView's formatTime exactly, for the elapsed/duration display in the
// playback row.
function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function FullDictationView({
  track,
  audioObjectUrl,
  audioError,
  onCompleted,
  onBack
}: {
  track: LearnerTrack
  audioObjectUrl: string | null
  audioError: string | null
  onCompleted: (accuracyScore: number) => void
  onBack: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionState | null>(null)
  const [correctSentenceIds, setCorrectSentenceIds] = useState<Set<string>>(new Set())
  const [roundSteps, setRoundSteps] = useState<RoundStep[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [roundAnswers, setRoundAnswers] = useState<Map<string, string>>(new Map())
  const [answer, setAnswer] = useState('')
  const [roundChoiceVisible, setRoundChoiceVisible] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsedInSentence, setElapsedInSentence] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [summary, setSummary] = useState<SummaryState | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  // A running, cross-round log of every sentence the learner has moved past, newest last — the
  // UI shows only the trailing slice of this so the learner can scroll back through the last few
  // sentences and get a sense of the passage as a whole. Holds what they actually typed, not the
  // reference text.
  const [answeredHistory, setAnsweredHistory] = useState<AnsweredEntry[]>([])
  // What the learner most recently submitted per sentence (this round or an earlier one) — used
  // to pre-fill a step's textarea (so the learner edits rather than retypes from scratch) and to
  // preview the upcoming sentence's prior answer below the textarea. Also what a resumed session
  // is rebuilt from, alongside correctSentenceIds.
  const [previousRoundAnswers, setPreviousRoundAnswers] = useState<Map<string, string>>(new Map())
  // Which sentence is currently playing on a result screen (Round Complete / Full Dictation
  // Complete), for highlighting its row — null the rest of the time. Mirrored into a ref since
  // playResultSentence's own event-listener closures need the current value without re-binding.
  const [playingResultSentenceId, setPlayingResultSentenceId] = useState<string | null>(null)
  const playingResultSentenceIdRef = useRef<string | null>(null)
  const resultStopTimerCleanupRef = useRef<(() => void) | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const historyEndRef = useRef<HTMLDivElement>(null)
  const recognizerRef = useRef<{ start: () => void; stop: () => void; resetSegment: () => void } | null>(null)
  const baseAnswerRef = useRef('')
  // Tracks whether the audio-sequencing effect has ever auto-played anything — false only for
  // the very first sentence of the very first round (entering Full Dictation fresh), so that
  // one sentence starts paused and waits for the learner to press Play themselves. Every step
  // after that (including a later round's first sentence) auto-plays as usual.
  const hasAutoPlayedRef = useRef(false)
  // Distinguishes a bare tap of Ctrl (play/pause) from Ctrl held as a modifier for a combo
  // (Reset, mic) — see the combined keyboard-shortcut effect below, mirroring
  // SentencePracticeView's identical mechanism.
  const ctrlComboFiredRef = useRef(false)
  // Guards the state-derived round-completion effect below so a finished round's completion
  // logic fires exactly once per round, even though stepIndex staying >= roundSteps.length (while
  // the round-choice screen or an error is shown) would otherwise re-satisfy the effect's
  // condition on every unrelated re-render.
  const blindRoundFinishRequestedRef = useRef(false)
  // Holds a thunk that redoes whatever /complete call last failed, so the "Retry" button
  // rendered alongside actionError can retry the exact same request without the caller needing
  // to re-derive its arguments. Cleared (null) whenever the last attempt succeeded.
  const retryActionRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (audioError) {
      setError(audioError)
      return
    }
    if (audioObjectUrl === null) return // still downloading, at the page level

    async function init() {
      const response = await fetch(`/api/learner/tracks/${track.id}/full-dictation-session/start`, { method: 'POST' })
      if (!response.ok) {
        setError('Failed to start full dictation session.')
        return
      }
      const started: StartResponse = await response.json()
      const resumedAnswers = new Map(Object.entries(started.submittedTexts ?? {}))
      setSession({ id: started.id })
      setCorrectSentenceIds(new Set(started.correctSentenceIds))
      setPreviousRoundAnswers(resumedAnswers)
      // Always straight into dictation — a resumed session (a fresh page load, not just a still-
      // open tab) lands on the exact sentence it left off at, the same way Sentence Dictation
      // resumes, rather than showing a round-choice review for whatever pass was interrupted.
      const steps = buildBlindRoundSteps(track.sentences)
      setRoundSteps(steps)
      const resumeIndex = Math.min(Math.max(0, started.currentSentenceIndex), Math.max(0, steps.length - 1))
      setStepIndex(resumeIndex)
      const resumeStep = steps[resumeIndex]
      setAnswer(resumeStep ? resumedAnswers.get(resumeStep.sentenceId) ?? '' : '')
    }
    init()
  }, [track.id, track.sentences, audioObjectUrl, audioError])

  const currentStep = roundSteps[stepIndex] ?? null
  const currentSentence = currentStep ? track.sentences.find((s) => s.id === currentStep.sentenceId) ?? null : null
  const sentenceStart = currentSentence ? parseTimeSpanToSeconds(currentSentence.startTime) : 0
  const sentenceEnd = currentSentence ? parseTimeSpanToSeconds(currentSentence.endTime) : 0
  const sentenceDuration = Math.max(0.001, sentenceEnd - sentenceStart)

  // What the textarea should start from when a step becomes current: whatever's already been
  // typed for it this round (revisiting after a jump) takes priority over what was typed for it
  // last round (round 2+ pre-fill), which takes priority over blank.
  function prefillFor(sentenceId: string, thisRoundAnswers: Map<string, string>): string {
    return thisRoundAnswers.get(sentenceId) ?? previousRoundAnswers.get(sentenceId) ?? ''
  }

  // Fire-and-forget POST for per-sentence progress — mirrors SentencePracticeView's own Submit
  // call exactly (same non-blocking, non-retried error handling): a failure here is reported via
  // actionError but never blocks the learner from continuing, and finishBlindRound's own
  // end-of-round sweep re-submits every sentence anyway, so a single dropped request self-heals.
  function fireAndForget(url: string, body: unknown) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then((response) => {
      if (!response.ok) setActionError('Failed to save your progress. Please try again.')
    })
  }

  // Seeks to the current step's sentence and plays it; a step transition (stepIndex change,
  // whether sequential or a jump via the Progress grid) always (re)starts playback for the new
  // step — except the very first sentence of the whole session, which seeks but stays paused
  // until the learner presses Play themselves (hasAutoPlayedRef). Matches SentencePracticeView
  // exactly otherwise: reaching the sentence's end pauses AND rewinds back to its start, so
  // clicking Play again (the playback row's only control, now that there's no separate Replay
  // button) naturally replays it — there's no auto-advance, only Next moves forward.
  useEffect(() => {
    if (!audioRef.current || !currentSentence || roundChoiceVisible) return
    const audio = audioRef.current
    audio.currentTime = sentenceStart
    setElapsedInSentence(0)
    if (hasAutoPlayedRef.current) {
      audio.play()
    } else {
      hasAutoPlayedRef.current = true
    }

    // Stopping at sentenceEnd used to be driven off the 'timeupdate' event, but that event
    // only fires every ~250ms (browser-dependent), so playback would audibly run 100-200ms
    // past the boundary before the check even ran. A precisely-scheduled setTimeout, armed
    // whenever playback actually starts/resumes/seeks, stops right on time instead — same
    // fix as SentencePracticeView.
    let stopTimer: ReturnType<typeof setTimeout> | null = null

    function clearStopTimer() {
      if (stopTimer !== null) {
        clearTimeout(stopTimer)
        stopTimer = null
      }
    }

    function scheduleStopTimer() {
      clearStopTimer()
      const remainingMs = (sentenceEnd - audio.currentTime) * 1000
      if (remainingMs <= 0) return
      stopTimer = setTimeout(() => {
        audio.pause()
        audio.currentTime = sentenceStart
        setElapsedInSentence(0)
      }, remainingMs)
    }

    function onTimeUpdate() {
      setElapsedInSentence(Math.max(0, audio.currentTime - sentenceStart))
    }
    function onPlay() {
      scheduleStopTimer()
    }
    function onPause() {
      clearStopTimer()
    }
    function onSeeked() {
      if (!audio.paused) scheduleStopTimer()
    }
    // 'ended' backs up the timer for the final sentence: if the SRT's endTime slightly
    // exceeds the real audio duration, currentTime may never quite reach `sentenceEnd`,
    // but playback still fires 'ended' when it runs out.
    function onEnded() {
      clearStopTimer()
      audio.pause()
      audio.currentTime = sentenceStart
      setElapsedInSentence(0)
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('ended', onEnded)
      clearStopTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, currentSentence?.id, roundChoiceVisible])

  // Round completion is state-derived: this fires once stepIndex has advanced past the last
  // step, whether that happened by sequentially clicking through or by jumping straight to the
  // last sentence via the Progress grid and clicking Next from there. Also covers the
  // zero-sentence-track case: roundSteps is empty and stepIndex(0) >= roundSteps.length(0) from
  // the start.
  useEffect(() => {
    if (!session) return
    if (roundChoiceVisible) return
    if (stepIndex < roundSteps.length) return
    if (blindRoundFinishRequestedRef.current) return
    blindRoundFinishRequestedRef.current = true
    finishBlindRound(roundAnswers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundChoiceVisible, stepIndex, roundSteps, roundAnswers])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  // Auto-focus the textarea as soon as a new step becomes current, so the learner can start
  // typing without an extra click.
  useEffect(() => {
    if (currentStep) textareaRef.current?.focus()
  }, [currentStep?.sentenceId])

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [answeredHistory])

  // The mic must only ever stop via an explicit user action (click or Ctrl+M — see
  // handleMicClick) — it must never auto-stop just because the sentence changed. But the
  // underlying recognizer's event.results never shrinks or resets on its own, so if left
  // completely alone across a sentence boundary it would keep prepending the PREVIOUS sentence's
  // words onto every new transcript. This marks a fresh transcript "segment" boundary — right as
  // the next sentence's audio starts — without touching isRecording or calling stop(), so
  // listening stays uninterrupted while each onresult only reports text recognized since this
  // sentence began.
  useEffect(() => {
    if (!isRecording) return
    recognizerRef.current?.resetSegment()
    baseAnswerRef.current = ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  // Keyboard shortcuts, matching SentencePracticeView's scheme: Ctrl+/ resets the current
  // sentence, Ctrl+M toggles the mic, and a bare tap of Ctrl (pressed and released with nothing
  // else in between) plays/pauses the current sentence — mirroring that view's tap-vs-modifier
  // disambiguation (ctrlComboFiredRef), since holding Ctrl to reach either combo also fires a
  // bare Control keydown first. Gated to only fire while a step is actually active (nothing to
  // act on otherwise).
  useEffect(() => {
    if (!currentStep || showShortcuts) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Control') {
        ctrlComboFiredRef.current = false
        return
      }
      if (!e.ctrlKey) return
      if (e.key === '/') {
        e.preventDefault()
        ctrlComboFiredRef.current = true
        handleReset()
      } else if (e.key.toLowerCase() === 'm' && isSpeechRecognitionSupported()) {
        e.preventDefault()
        ctrlComboFiredRef.current = true
        handleMicClick()
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Control') return
      if (!ctrlComboFiredRef.current) handlePlayPauseClick()
      ctrlComboFiredRef.current = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isRecording, answer, showShortcuts])

  // Shared POST helper for /complete: checks response.ok and catches a network-level rejection
  // (not just a non-ok response), reporting either the same way via actionError instead of
  // letting it become an unhandled rejection. Returns null on any failure so callers can bail
  // out without advancing local state past what was actually persisted — the learner shouldn't
  // be told progress saved when it didn't.
  async function postJson(url: string, body: unknown): Promise<Response | null> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        setActionError('Failed to save your progress. Please try again.')
        return null
      }
      setActionError(null)
      return response
    } catch {
      setActionError('Failed to save your progress. Please try again.')
      return null
    }
  }

  // Posts to /complete and, once a score comes back, hands off to the final summary screen
  // rather than calling onCompleted directly — the summary's own Done button is what fires
  // onCompleted. Every sentence's correctness was already persisted via /submit as the learner
  // went (plus finishBlindRound's own end-of-round sweep), so there's nothing left to send here.
  async function completeSession() {
    if (!session) return
    setIsSubmitting(true)
    const response = await postJson(`/api/learner/full-dictation-sessions/${session.id}/complete`, {})
    setIsSubmitting(false)
    if (!response) {
      retryActionRef.current = () => completeSession()
      return
    }
    retryActionRef.current = null
    try {
      const result: CompleteResponse = await response.json()
      setSummary({ score: result.score, finalCorrectSentenceIds: result.finalCorrectSentenceIds })
    } catch {
      // no parseable body — nothing to show a summary for
    }
  }

  async function finishBlindRound(finalAnswers: Map<string, string>) {
    if (!session) return
    // A sentence the learner jumped past via the Progress grid without ever typing anything has
    // no entry here — treat it as an empty (incorrect) submission rather than silently excluding
    // it from grading. Every sentence in the round — visited via Next (already submitted
    // individually) or not — is resubmitted here too; the ones already sent are a harmless
    // repeat, and this guarantees the server ends up consistent with what's shown locally even
    // if a sentence was only ever touched via a jump.
    const completeAnswers = new Map(finalAnswers)
    for (const s of track.sentences) {
      if (!completeAnswers.has(s.id)) completeAnswers.set(s.id, '')
    }
    // Every round re-grades every sentence fresh — correctness replaces last round's, it doesn't
    // just accumulate, so an edit that breaks a previously-correct sentence actually shows up as
    // wrong again.
    const correctThisRound = gradeBlindRound(track.sentences, completeAnswers)
    const correctThisRoundSet = new Set(correctThisRound)
    for (const [sentenceId, submittedText] of completeAnswers) {
      fireAndForget(`/api/learner/full-dictation-sessions/${session.id}/submit`, {
        sentenceId,
        isCorrect: correctThisRoundSet.has(sentenceId),
        submittedText
      })
    }
    // Persisted alongside correctness so a resumed session (a fresh page load, not just a still-
    // open tab) can rebuild this round's review screen — see the mount effect above.
    setPreviousRoundAnswers(completeAnswers)

    if (correctThisRound.length === track.sentences.length) {
      await completeSession()
      return
    }

    setCorrectSentenceIds(correctThisRoundSet)
    fireAndForget(`/api/learner/full-dictation-sessions/${session.id}/advance`, { toIndex: 0 })
    setRoundChoiceVisible(true)
  }

  // Only records the answer and advances stepIndex — round completion is entirely state-derived
  // (see the effect above). Submits this one sentence immediately (not batched until round end)
  // so a mid-round close and resume never loses progress within the round that was interrupted.
  function handleAdvanceStep() {
    if (!currentStep || !currentSentence || !session) return
    const isCorrect = compare(currentSentence.text, answer).isExactMatch
    fireAndForget(`/api/learner/full-dictation-sessions/${session.id}/submit`, {
      sentenceId: currentStep.sentenceId,
      isCorrect,
      submittedText: answer
    })

    const nextAnswers = new Map(roundAnswers)
    nextAnswers.set(currentStep.sentenceId, answer)
    setAnsweredHistory((prev) =>
      [...prev, { sentenceId: currentStep.sentenceId, referenceText: currentSentence.text, submittedText: answer }].slice(-5)
    )
    const nextIndex = stepIndex + 1
    const nextStep = roundSteps[nextIndex]
    setAnswer(nextStep ? prefillFor(nextStep.sentenceId, nextAnswers) : '')
    setRoundAnswers(nextAnswers)
    // Only persist a position that's actually within this round — reaching the end is handled by
    // finishBlindRound's own advance-to-0 (new round) or the session completing entirely.
    if (nextIndex < roundSteps.length) {
      fireAndForget(`/api/learner/full-dictation-sessions/${session.id}/advance`, { toIndex: nextIndex })
    }
    setStepIndex(nextIndex)
  }

  // Jumping (via the Progress grid) saves whatever's currently typed for the step being left,
  // same as a normal Next would, then seeds the target step from whatever's already been typed
  // for it — either earlier this round (revisiting after a jump) or last round (pre-fill).
  function handleJumpToStep(index: number) {
    if (!currentStep || !session) return
    const targetStep = roundSteps[index]
    if (!targetStep) return
    const nextAnswers = new Map(roundAnswers)
    nextAnswers.set(currentStep.sentenceId, answer)
    setRoundAnswers(nextAnswers)
    setAnswer(prefillFor(targetStep.sentenceId, nextAnswers))
    setStepIndex(index)
    fireAndForget(`/api/learner/full-dictation-sessions/${session.id}/advance`, { toIndex: index })
  }

  function handleContinueBlindRound() {
    blindRoundFinishRequestedRef.current = false
    retryActionRef.current = null
    setActionError(null)
    const steps = buildBlindRoundSteps(track.sentences)
    setRoundSteps(steps)
    setStepIndex(0)
    setRoundAnswers(new Map())
    setAnswer(steps[0] ? prefillFor(steps[0].sentenceId, new Map()) : '')
    setRoundChoiceVisible(false)
  }

  // The round-choice screen's escape hatch — does not require every sentence to be correct.
  // finishBlindRound's own submit calls already persisted this round's correct/incorrect
  // sentences, so this just finalizes the session with what's already known server-side.
  async function handleFinishNow() {
    await completeSession()
  }

  // Matches SentencePracticeView's Play/Pause button exactly. There's no separate Replay
  // control: a sentence that reaches its end auto-rewinds to its start (see the audio effect
  // above), so clicking Play again is how replay works here too.
  function handlePlayPauseClick() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play()
    } else {
      audio.pause()
    }
  }

  // Matches SentencePracticeView's Reset: clears whatever's typed for the current sentence and
  // replays it from the start.
  function handleReset() {
    if (!currentSentence) return
    setAnswer('')
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = sentenceStart
    setElapsedInSentence(0)
    audio.play()
  }

  // Mirrors SentencePracticeView's mic handling exactly: a continuous recognizer that appends
  // onto whatever was already typed (captured once into baseAnswerRef when recording starts)
  // rather than replacing it, so switching between typing and speaking mid-sentence doesn't
  // lose anything.
  function handleMicClick() {
    if (isRecording) {
      recognizerRef.current?.stop()
      // Return focus to the textarea: clicking the mic button moves DOM focus onto it, and
      // Enter is only wired up via the textarea's own onKeyDown (unlike SentencePracticeView,
      // which listens globally) — left unfixed, a focused mic button "eats" the next Enter
      // press (toggling the mic again) instead of submitting/advancing.
      textareaRef.current?.focus()
      return
    }
    baseAnswerRef.current = answer
    const recognizer = createContinuousRecognizer(
      (text) => setAnswer(baseAnswerRef.current ? `${baseAnswerRef.current} ${text}` : text),
      () => setIsRecording(false)
    )
    recognizerRef.current = recognizer
    setIsRecording(true)
    recognizer.start()
    textareaRef.current?.focus()
  }

  // Used only on the result screens (Round Complete / Full Dictation Complete): plays exactly one
  // sentence and stops at its end, with no auto-advance to the next one — unlike the active-
  // dictation playback effect above, there is no "current step" here to move on to. Clicking the
  // row that's already playing pauses it instead of restarting it; clicking a different row while
  // one is playing tears down that row's own end-of-sentence listener first, so it can't fire late
  // and cut off the newly selected sentence.
  function playResultSentence(sentence: { id: string; startTime: string; endTime: string }) {
    const audio = audioRef.current
    if (!audio) return

    if (playingResultSentenceIdRef.current === sentence.id) {
      stopPlayingResultSentence()
      return
    }
    stopPlayingResultSentence()

    const start = parseTimeSpanToSeconds(sentence.startTime)
    const end = parseTimeSpanToSeconds(sentence.endTime)
    audio.currentTime = start
    setPlayingResultSentenceId(sentence.id)
    playingResultSentenceIdRef.current = sentence.id

    // A setTimeout scheduled once up front, not a 'timeupdate' check — same reasoning as the
    // active-dictation playback effects above: timeupdate only fires every ~250ms, so it lets
    // playback run audibly past `end` before a check could catch it.
    const stopTimer = setTimeout(() => stopPlayingResultSentence(), Math.max(0, (end - start) * 1000))
    resultStopTimerCleanupRef.current = () => clearTimeout(stopTimer)
    audio.play()
  }

  function stopPlayingResultSentence() {
    if (playingResultSentenceIdRef.current === null) return
    audioRef.current?.pause()
    resultStopTimerCleanupRef.current?.()
    resultStopTimerCleanupRef.current = null
    playingResultSentenceIdRef.current = null
    setPlayingResultSentenceId(null)
  }

  if (error) return <p role="alert" style={{ color: 'var(--error)', fontWeight: 700 }}>{error}</p>

  if (summary) {
    return (
      <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 20, width: 760, maxWidth: '100%' }}>
        <audio ref={audioRef} src={audioObjectUrl ?? undefined} />
        <ResultHeader
          title="Full Dictation Complete"
          correctCount={summary.finalCorrectSentenceIds.length}
          total={track.sentences.length}
          score={summary.score}
        />
        {/* Capped and independently scrollable so a long track's full sentence list doesn't push
            the Done button off-screen — only this list scrolls, not the whole page. */}
        <div style={{ background: resultPanelBg, borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '50vh', overflowY: 'auto' }}>
          {track.sentences.map((s, i) => {
            // Shows what the learner actually typed for this sentence in their last attempt,
            // word-diffed against the reference — correct words in green, incorrect/missing
            // ones in pink, pure color differentiation with no checkmark needed.
            const { words } = compare(s.text, previousRoundAnswers.get(s.id) ?? '')
            return (
              <div
                key={s.id}
                onClick={() => playResultSentence(s)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '4px 8px',
                  margin: '-4px -8px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: playingResultSentenceId === s.id ? 'var(--primary-soft)' : 'transparent'
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 13, lineHeight: '30.6px', width: 22, flexShrink: 0, color: 'var(--ink-faint)' }}>{i + 1}</span>
                <span style={{ fontSize: 17, lineHeight: 1.8, fontWeight: 400, flex: 1 }}>
                  <DiffText words={words} variant="dictation" correctColor={resultCorrectColor} incorrectColor="var(--primary)" />
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); playResultSentence(s) }}
                  aria-label={`Play sentence ${i + 1}`}
                  style={{
                    marginTop: 4,
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary)"><path d="M8 5v14l11-7z" /></svg>
                </button>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => onCompleted(summary.score)} style={btnPrimarySmall}>
            Done
          </button>
        </div>
      </div>
    )
  }

  const actionErrorBanner = actionError ? (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--error)', fontWeight: 700 }}>{actionError}</span>
      {retryActionRef.current && (
        <button onClick={() => retryActionRef.current?.()} disabled={isSubmitting} style={btnGhost}>
          Retry
        </button>
      )}
    </div>
  ) : null

  // The trailing slice of answeredHistory, shown just above the input so the learner can scroll
  // back through the last few sentences and get a sense of the passage as a whole — newest
  // (closest to the current input) last. Auto-scrolls to the newest entry as it grows.
  const historyFeed = answeredHistory.length > 0 ? (
    <div
      style={{
        maxHeight: 160,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        // A distinct background/border, not just spacing, so this reads as its own "past
        // sentences" panel rather than looking like leftover text sitting in the textarea below.
        background: 'oklch(96% 0.01 80)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '10px 14px'
      }}
    >
      {answeredHistory.map((entry, i) => (
        <span key={`${entry.sentenceId}-${i}`} style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
          {entry.submittedText ?? entry.referenceText}
        </span>
      ))}
      <div ref={historyEndRef} />
    </div>
  ) : null

  const backButton = (
    <button
      onClick={onBack}
      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-soft)', fontWeight: 800, fontSize: 15, flexShrink: 0 }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.5"><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Back
    </button>
  )

  const micButton = isSpeechRecognitionSupported() ? (
    <button
      onClick={handleMicClick}
      aria-label={isRecording ? 'Stop microphone' : 'Use microphone'}
      title={isRecording ? 'Stop microphone (Ctrl+M)' : 'Use microphone (Ctrl+M)'}
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        borderRadius: 999,
        background: 'var(--primary-soft)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: 'pointer'
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0" strokeLinecap="round" /></svg>
      {isRecording && (
        <span
          aria-label="Recording"
          className="recording-dot"
          style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: 999, background: 'var(--error)' }}
        />
      )}
    </button>
  ) : null

  // Matches SentencePracticeView's Reset button exactly, placed to the left of the mic.
  const resetButton = (
    <button
      onClick={handleReset}
      aria-label="Reset"
      title="Reset (Ctrl+/)"
      disabled={!currentSentence}
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: 'transparent',
        border: '2px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: currentSentence ? 'pointer' : 'default',
        opacity: currentSentence ? 1 : 0.5
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.5">
        <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
        <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )

  const stepNumber = stepIndex + 1
  const totalSteps = roundSteps.length
  // A peek at what the learner wrote for the upcoming sentence last time (this round's earlier
  // pass or an earlier one), so they have a sense of what's coming next.
  const nextStepSentenceId = roundSteps[stepIndex + 1]?.sentenceId
  const nextStepPreview = nextStepSentenceId ? previousRoundAnswers.get(nextStepSentenceId) : undefined

  // A jump-to-any-sentence panel, shared with Sentence Dictation's identical one — shown only
  // while actively working through a round (not on the round-end score screen, which has no
  // "current step" to anchor it to).
  const progressPanel = !roundChoiceVisible ? (
    <SentenceProgressGrid
      count={track.sentences.length}
      onJump={handleJumpToStep}
      getStatus={(i) => {
        if (i === stepIndex) return 'current'
        const s = track.sentences[i]
        // Reuses the exact same word-match check the round's own grading uses, computed live as
        // soon as the learner leaves a sentence — an answered-but-wrong sentence stays the
        // neutral "touched" tint, an answered-and-correct one turns green immediately, without
        // waiting for the round to officially end. A sentence not yet revisited this round falls
        // back to last round's correctness — otherwise everything would show blank the instant a
        // new round starts, even sentences still holding their (pre-filled, unedited) correct
        // answer from before.
        const isAnsweredThisRound = roundAnswers.has(s.id)
        const isCorrect = isAnsweredThisRound
          ? compare(s.text, roundAnswers.get(s.id) ?? '').isExactMatch
          : correctSentenceIds.has(s.id)
        if (isCorrect) return 'correct'
        if (isAnsweredThisRound) return 'touched'
        return 'untouched'
      }}
    />
  ) : null

  return (
    <div style={{ display: 'flex', gap: 24, width: '100%', maxWidth: 1040 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 760, maxWidth: '100%' }}>
        <audio ref={audioRef} src={audioObjectUrl ?? undefined} />

        <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {backButton}
            {session && !roundChoiceVisible && totalSteps > 0 && (
              <span style={{ ...chipStyle, background: 'var(--primary-soft)' }}>
                Sentence {Math.min(stepNumber, totalSteps)} / {totalSteps}
              </span>
            )}
            {/* Matches SentencePracticeView's progress bar exactly, filling the remaining header
                width — hidden on the round-choice/score screen, same as the chip above. */}
            {!roundChoiceVisible && totalSteps > 0 && (
              <div style={{ flex: 1, height: 10, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(Math.min(stepNumber, totalSteps) / totalSteps) * 100}%`,
                    height: '100%',
                    background: 'var(--primary)',
                    borderRadius: 999
                  }}
                />
              </div>
            )}
          </div>

          {actionErrorBanner}

          {roundChoiceVisible ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Matches the final summary screen's review exactly — same score presentation and
                  same per-sentence word-diff highlighting — so every round's end looks and reads
                  the same, whether it's the round that finishes the session or not. */}
              <ResultHeader
                title="Round Complete"
                correctCount={correctSentenceIds.size}
                total={track.sentences.length}
                score={correctSentenceIds.size / Math.max(1, track.sentences.length)}
              />
              {/* Capped and independently scrollable so a long track's full sentence list
                  doesn't push the Next Round/Finish Now buttons off-screen. */}
              <div style={{ background: resultPanelBg, borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '50vh', overflowY: 'auto' }}>
                {track.sentences.map((s, i) => {
                  const { words } = compare(s.text, previousRoundAnswers.get(s.id) ?? '')
                  return (
                    <div
                      key={s.id}
                      onClick={() => playResultSentence(s)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '4px 8px',
                        margin: '-4px -8px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: playingResultSentenceId === s.id ? 'var(--primary-soft)' : 'transparent'
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: 13, lineHeight: '30.6px', width: 22, flexShrink: 0, color: 'var(--ink-faint)' }}>{i + 1}</span>
                      <span style={{ fontSize: 17, lineHeight: 1.8, fontWeight: 400, flex: 1 }}>
                        <DiffText words={words} variant="dictation" correctColor={resultCorrectColor} incorrectColor="var(--primary)" />
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); playResultSentence(s) }}
                        aria-label={`Play sentence ${i + 1}`}
                        style={{
                          marginTop: 4,
                          flexShrink: 0,
                          width: 24,
                          height: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary)"><path d="M8 5v14l11-7z" /></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <button onClick={handleContinueBlindRound} disabled={isSubmitting} style={btnPrimarySmall}>
                  Next Round
                </button>
                <button onClick={handleFinishNow} disabled={isSubmitting} style={btnGhostSmall}>
                  Finish Now
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Matches SentencePracticeView's playback row exactly, minus the Previous/Next
                  sentence buttons — Full Dictation has no sentence-navigation controls, only
                  Next (below) and the Progress grid. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  background: 'oklch(96% 0.01 80)',
                  borderRadius: 20,
                  padding: '16px 20px'
                }}
              >
                <button
                  onClick={handlePlayPauseClick}
                  disabled={!currentSentence}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  title={isPlaying ? 'Pause (Ctrl)' : 'Play (Ctrl)'}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 999,
                    background: 'var(--primary)',
                    boxShadow: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: currentSentence ? 'pointer' : 'default',
                    opacity: currentSentence ? 1 : 0.5
                  }}
                >
                  {isPlaying ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3, height: 32 }}>
                  {[14, 24, 10, 30, 18, 8, 20, 12, 22, 10].map((height, i) => (
                    <div
                      key={i}
                      style={{ width: 4, height, borderRadius: 2, background: i < 5 ? 'var(--primary)' : 'oklch(88% 0.01 80)' }}
                    />
                  ))}
                </div>
                <span style={{ fontWeight: 700, color: 'var(--ink-soft)', fontSize: 13 }}>
                  {formatTime(elapsedInSentence)} / {formatTime(sentenceDuration)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '-8px 0' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>
                  Press &quot;Ctrl&quot; to play or pause.
                </span>
                <button
                  onClick={() => setShowShortcuts(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--ink-faint)',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  View other shortcuts
                </button>
              </div>

              {currentStep && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historyFeed}
                  <textarea
                    ref={textareaRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type what you hear, or tap the mic to speak it instead"
                    rows={3}
                    style={{
                      width: '100%',
                      border: '2px solid var(--line)',
                      borderRadius: 16,
                      padding: '16px 18px',
                      fontSize: 17,
                      lineHeight: 1.8,
                      fontWeight: 400,
                      color: 'var(--ink)',
                      fontFamily: 'inherit',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAdvanceStep()
                      }
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <button onClick={handleAdvanceStep} title="Next (Enter)" style={btnPrimarySmall}>
                      Next
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {resetButton}
                      {micButton}
                    </div>
                  </div>
                  {nextStepPreview && (
                    <span style={{ fontSize: 16, lineHeight: 1.6, fontStyle: 'italic', color: 'var(--ink-soft)' }}>
                      Next: {nextStepPreview}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {progressPanel}

      {showShortcuts && (
        <div style={overlayStyle} onClick={() => setShowShortcuts(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-faint)', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SHORTCUTS.map((s) => (
                <div key={s.keys} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>{s.description}</span>
                  <span style={keyBadgeStyle}>{s.keys}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
