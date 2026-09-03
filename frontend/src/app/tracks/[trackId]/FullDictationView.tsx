'use client'

import { useEffect, useRef, useState } from 'react'
import { preloadAudio } from '@/lib/audioPreload'
import { parseTimeSpanToSeconds } from '@/lib/timeSpan'
import { compare, type WordDiff } from '@/lib/textComparer'
import { DiffText } from '@/components/DiffText'
import { buildBlindRoundSteps, buildFocusedRoundSteps, gradeBlindRound, type RoundStep } from './fullDictationEngine'
import type { LearnerTrack } from './page'

type SessionState = { id: string; currentRound: number; currentPhase: 'Blind' | 'Focused' }
type StartResponse = { id: string; currentRound: number; currentPhase: 'Blind' | 'Focused'; correctSentenceIds: string[] }
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

export function FullDictationView({
  track,
  onCompleted
}: {
  track: LearnerTrack
  onCompleted: (accuracyScore: number) => void
}) {
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionState | null>(null)
  const [correctSentenceIds, setCorrectSentenceIds] = useState<Set<string>>(new Set())
  const [roundSteps, setRoundSteps] = useState<RoundStep[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [roundAnswers, setRoundAnswers] = useState<Map<string, string>>(new Map())
  const [answer, setAnswer] = useState('')
  const [awaitingInput, setAwaitingInput] = useState(false)
  const [roundChoiceVisible, setRoundChoiceVisible] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [focusedSteps, setFocusedSteps] = useState<RoundStep[]>([])
  const [focusedStepIndex, setFocusedStepIndex] = useState(0)
  const [focusedRoundNewlyCorrect, setFocusedRoundNewlyCorrect] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<{ words: WordDiff[]; isCorrect: boolean } | null>(null)
  const [summary, setSummary] = useState<SummaryState | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  // Guards the state-derived round-completion effect below so a finished round's checkpoint/
  // complete call fires exactly once per round, even though stepIndex staying >= roundSteps.length
  // (while the round-choice screen or an error is shown) would otherwise re-satisfy the effect's
  // condition on every unrelated re-render.
  const blindRoundFinishRequestedRef = useRef(false)
  // Holds a thunk that redoes whatever checkpoint/complete call last failed, so the "Retry"
  // button rendered alongside actionError can retry the exact same request without the caller
  // needing to re-derive its arguments. Cleared (null) whenever the last attempt succeeded.
  const retryActionRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    async function init() {
      try {
        setAudioObjectUrl(await preloadAudio(track.audioUrl))
      } catch {
        setError('Failed to download audio for this track.')
        return
      }
      const response = await fetch(`/api/learner/tracks/${track.id}/full-dictation-session/start`, { method: 'POST' })
      if (!response.ok) {
        setError('Failed to start full dictation session.')
        return
      }
      const started: StartResponse = await response.json()
      const startedCorrectIds = new Set(started.correctSentenceIds)
      setSession({ id: started.id, currentRound: started.currentRound, currentPhase: started.currentPhase })
      setCorrectSentenceIds(startedCorrectIds)
      if (started.currentPhase === 'Blind') {
        setRoundSteps(buildBlindRoundSteps(track.sentences, startedCorrectIds))
        setStepIndex(0)
      } else {
        setFocusedSteps(buildFocusedRoundSteps(track.sentences, startedCorrectIds))
        setFocusedStepIndex(0)
      }
    }
    init()
  }, [track.id, track.audioUrl, track.sentences])

  const currentStep = roundSteps[stepIndex] ?? null
  const currentSentence = currentStep ? track.sentences.find((s) => s.id === currentStep.sentenceId) ?? null : null

  const currentFocusedStep = focusedSteps[focusedStepIndex] ?? null
  const currentFocusedSentence = currentFocusedStep
    ? track.sentences.find((s) => s.id === currentFocusedStep.sentenceId) ?? null
    : null

  // Seeks to the current step's sentence and plays it; a step transition (stepIndex change)
  // always (re)starts playback for the new step.
  useEffect(() => {
    if (!audioRef.current || !currentSentence || roundChoiceVisible || session?.currentPhase === 'Focused') return
    const audio = audioRef.current
    const start = parseTimeSpanToSeconds(currentSentence.startTime)
    const end = parseTimeSpanToSeconds(currentSentence.endTime)
    audio.currentTime = start
    // A step requiring input shows its textarea as soon as the step begins — the learner can
    // type while still listening — rather than waiting for playback to reach the sentence's end.
    // Already-correct steps show nothing and simply keep playing until the pause-at-end below
    // advances past them automatically.
    setAwaitingInput(currentStep!.requiresInput)
    audio.play()

    function advancePastStep() {
      audio.pause()
      if (!currentStep!.requiresInput) {
        setStepIndex((i) => i + 1)
      }
    }
    function onTimeUpdate() {
      if (audio.currentTime < end) return
      advancePastStep()
    }
    // 'ended' backs up 'timeupdate' for the final sentence: if the SRT's endTime slightly
    // exceeds the real audio duration, currentTime may never quite reach `end` via timeupdate,
    // but playback still fires 'ended' when it runs out — without this, that step would never
    // auto-advance.
    function onEnded() {
      advancePastStep()
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, currentSentence?.id, roundChoiceVisible, session?.currentPhase])

  // Round completion is state-derived rather than only triggered from handleAdvanceStep: an
  // already-correct trailing step advances stepIndex via the timeupdate/ended handlers above
  // with no submit involved, so relying solely on handleAdvanceStep's "was this the last step"
  // check misses that path entirely and leaves stepIndex pointing past the end of roundSteps
  // forever (currentStep becomes null — a dead screen). This also covers the zero-sentence-track
  // case: roundSteps is empty and stepIndex(0) >= roundSteps.length(0) is true from the start.
  useEffect(() => {
    if (!session || session.currentPhase !== 'Blind') return
    if (roundChoiceVisible) return
    if (stepIndex < roundSteps.length) return
    if (blindRoundFinishRequestedRef.current) return
    blindRoundFinishRequestedRef.current = true
    finishBlindRound(roundAnswers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currentPhase, roundChoiceVisible, stepIndex, roundSteps, roundAnswers])

  // Focused mode plays each sentence once automatically when the step begins; the persisted
  // 'timeupdate' listener also backs the Replay button below, which just rewinds and calls
  // play() again without needing a separate listener registration.
  useEffect(() => {
    if (!audioRef.current || !currentFocusedSentence || roundChoiceVisible || session?.currentPhase !== 'Focused') return
    const audio = audioRef.current
    const start = parseTimeSpanToSeconds(currentFocusedSentence.startTime)
    const end = parseTimeSpanToSeconds(currentFocusedSentence.endTime)
    audio.currentTime = start
    audio.play()

    function onTimeUpdate() {
      if (audio.currentTime < end) return
      audio.pause()
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    return () => audio.removeEventListener('timeupdate', onTimeUpdate)
  }, [focusedStepIndex, currentFocusedSentence?.id, roundChoiceVisible, session?.currentPhase])

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

  // Shared POST helper for all 4 checkpoint/complete calls: checks response.ok and catches a
  // network-level rejection (not just a non-ok response), reporting either the same way via
  // actionError instead of letting it become an unhandled rejection. Returns null on any
  // failure so callers can bail out without advancing local state past what was actually
  // persisted (don't flip roundChoiceVisible, don't fold newly-correct ids into
  // correctSentenceIds, etc.) — the learner shouldn't be told progress saved when it didn't.
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

  // Shared by both phases' round-end logic: posts to /complete and, once a score comes back,
  // hands off to the final summary screen rather than calling onCompleted directly — the
  // summary's own Done button is what fires onCompleted. A response with no parseable body
  // (nothing but a mocked bare 204 should ever produce that in practice) just leaves the
  // summary unset rather than throwing an unhandled rejection.
  async function completeSession(newlyCorrectSentenceIds: string[]) {
    if (!session) return
    setIsSubmitting(true)
    const response = await postJson(`/api/learner/full-dictation-sessions/${session.id}/complete`, { newlyCorrectSentenceIds })
    setIsSubmitting(false)
    if (!response) {
      retryActionRef.current = () => completeSession(newlyCorrectSentenceIds)
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
    const newlyCorrect = gradeBlindRound(track.sentences, finalAnswers)
    const updatedCorrectIds = new Set([...correctSentenceIds, ...newlyCorrect])

    if (updatedCorrectIds.size === track.sentences.length) {
      await completeSession(newlyCorrect)
      return
    }

    const nextRound = session.currentRound + 1
    setIsSubmitting(true)
    const response = await postJson(`/api/learner/full-dictation-sessions/${session.id}/checkpoint`, {
      currentRound: nextRound,
      currentPhase: 'Blind',
      newlyCorrectSentenceIds: newlyCorrect
    })
    setIsSubmitting(false)
    if (!response) {
      retryActionRef.current = () => finishBlindRound(finalAnswers)
      return
    }
    retryActionRef.current = null
    setCorrectSentenceIds(updatedCorrectIds)
    setSession({ ...session, currentRound: nextRound })
    setRoundChoiceVisible(true)
  }

  // Only records the answer and advances stepIndex — round completion is entirely state-derived
  // (see the effect above), so this no longer needs to special-case "was this the last step":
  // that check missed the auto-advance-through-an-already-correct-last-step path entirely.
  function handleAdvanceStep() {
    if (!currentStep) return
    const nextAnswers = new Map(roundAnswers)
    if (currentStep.requiresInput) nextAnswers.set(currentStep.sentenceId, answer)
    setAnswer('')
    setAwaitingInput(false)
    setRoundAnswers(nextAnswers)
    setStepIndex((i) => i + 1)
  }

  function handleContinueBlindRound() {
    blindRoundFinishRequestedRef.current = false
    retryActionRef.current = null
    setActionError(null)
    setRoundSteps(buildBlindRoundSteps(track.sentences, correctSentenceIds))
    setStepIndex(0)
    setRoundAnswers(new Map())
    setAnswer('')
    setRoundChoiceVisible(false)
  }

  async function handleSwitchToFocused() {
    if (!session) return
    // No new corrections at this transition — the Blind round's own checkpoint (in
    // finishBlindRound) already recorded them.
    setIsSubmitting(true)
    const response = await postJson(`/api/learner/full-dictation-sessions/${session.id}/checkpoint`, {
      currentRound: session.currentRound,
      currentPhase: 'Focused',
      newlyCorrectSentenceIds: []
    })
    setIsSubmitting(false)
    if (!response) {
      retryActionRef.current = () => handleSwitchToFocused()
      return
    }
    retryActionRef.current = null
    setSession((s) => (s ? { ...s, currentPhase: 'Focused' } : s))
    setFocusedSteps(buildFocusedRoundSteps(track.sentences, correctSentenceIds))
    setFocusedStepIndex(0)
    setFocusedRoundNewlyCorrect(new Set())
    setFeedback(null)
    setAnswer('')
    setRoundChoiceVisible(false)
  }

  function handleFocusedReplay() {
    const audio = audioRef.current
    if (!audio || !currentFocusedSentence) return
    audio.currentTime = parseTimeSpanToSeconds(currentFocusedSentence.startTime)
    audio.play()
  }

  function handleFocusedSubmit() {
    if (!currentFocusedSentence) return
    const result = compare(currentFocusedSentence.text, answer)
    setFeedback({ words: result.words, isCorrect: result.isExactMatch })
    setAnswer('')
    if (result.isExactMatch) {
      const sentenceId = currentFocusedSentence.id
      setFocusedRoundNewlyCorrect((prev) => new Set(prev).add(sentenceId))
    }
  }

  async function finishFocusedRound() {
    if (!session) return
    const updatedCorrectIds = new Set([...correctSentenceIds, ...focusedRoundNewlyCorrect])

    if (updatedCorrectIds.size === track.sentences.length) {
      await completeSession([...focusedRoundNewlyCorrect])
      return
    }

    const nextRound = session.currentRound + 1
    setIsSubmitting(true)
    const response = await postJson(`/api/learner/full-dictation-sessions/${session.id}/checkpoint`, {
      currentRound: nextRound,
      currentPhase: 'Focused',
      newlyCorrectSentenceIds: [...focusedRoundNewlyCorrect]
    })
    setIsSubmitting(false)
    if (!response) {
      retryActionRef.current = () => finishFocusedRound()
      return
    }
    retryActionRef.current = null
    setCorrectSentenceIds(updatedCorrectIds)
    setSession({ ...session, currentRound: nextRound })
    setFocusedRoundNewlyCorrect(new Set())
    setRoundChoiceVisible(true)
  }

  // Shared by the "Next" and "Skip" buttons — the only difference between them is whether
  // the current sentence's id was already added to focusedRoundNewlyCorrect, which happens
  // (or doesn't) before this is ever called: Next only shows once a submit found an exact
  // match, Skip is clicked instead of ever submitting.
  async function advanceFocusedStep() {
    const nextIndex = focusedStepIndex + 1
    setFeedback(null)
    setAnswer('')
    if (nextIndex >= focusedSteps.length) {
      await finishFocusedRound()
    } else {
      setFocusedStepIndex(nextIndex)
    }
  }

  function handleContinueFocusedRound() {
    retryActionRef.current = null
    setActionError(null)
    setFocusedSteps(buildFocusedRoundSteps(track.sentences, correctSentenceIds))
    setFocusedStepIndex(0)
    setFocusedRoundNewlyCorrect(new Set())
    setFeedback(null)
    setAnswer('')
    setRoundChoiceVisible(false)
  }

  // The escape hatch from spec §3.2 — does not require every sentence to be correct.
  // Sends whatever this round has accumulated so far: empty if nothing new since the last
  // checkpoint (e.g. clicked from the round-end choice screen), or this round's in-progress
  // successes if clicked mid-round before it ever reached a checkpoint.
  async function handleFinishNow() {
    await completeSession([...focusedRoundNewlyCorrect])
  }

  function handlePlayPauseClick() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play()
    else audio.pause()
  }

  if (error) return <p role="alert" style={{ color: 'var(--error)', fontWeight: 700 }}>{error}</p>

  if (summary) {
    return (
      <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 20, width: 760, maxWidth: '100%' }}>
        <span style={{ fontWeight: 800, fontSize: 32, color: 'var(--ink)' }}>{Math.round(summary.score * 100)}%</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {track.sentences.map((s) => {
            const isCorrect = summary.finalCorrectSentenceIds.includes(s.id)
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, color: isCorrect ? 'var(--leaf-dark)' : 'var(--error)' }}>
                  {isCorrect ? '✓' : '✗'}
                </span>
                <span style={{ color: 'var(--ink)' }}>{s.text}</span>
              </div>
            )
          })}
        </div>
        <div>
          <button onClick={() => onCompleted(summary.score)} style={btnPrimary}>
            Done
          </button>
        </div>
      </div>
    )
  }

  // Shared across the Focused and Blind branches below so a failed checkpoint/complete call
  // surfaces the same way regardless of which screen was showing when it failed, with a Retry
  // button that redoes exactly the request that failed (see retryActionRef).
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

  if (session?.currentPhase === 'Focused') {
    if (roundChoiceVisible) {
      return (
        <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 18, width: 760, maxWidth: '100%' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-soft)' }}>Round {session.currentRound}</span>
          {actionErrorBanner}
          <div style={{ display: 'flex', gap: 14 }}>
            <button onClick={handleContinueFocusedRound} disabled={isSubmitting} style={btnPrimary}>
              Continue to Focused Round {session.currentRound}
            </button>
            <button onClick={handleFinishNow} disabled={isSubmitting} style={btnGhost}>
              Finish Now
            </button>
          </div>
        </div>
      )
    }

    const focusedStepNumber = focusedStepIndex + 1
    const focusedTotalSteps = focusedSteps.length

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 760, maxWidth: '100%' }}>
        <audio ref={audioRef} src={audioObjectUrl ?? undefined} />

        <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-soft)' }}>
            Round {session.currentRound}
            {focusedTotalSteps > 0 && ` · Sentence ${Math.min(focusedStepNumber, focusedTotalSteps)} of ${focusedTotalSteps}`}
          </span>

          {actionErrorBanner}

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleFocusedReplay} disabled={!currentFocusedSentence} style={btnGhost}>
              Replay
            </button>
            {/* Hoisted out of the currentFocusedSentence-gated block below so there's still a way
                forward if a session resumes directly into Focused with nothing left to focus on
                (e.g. a prior /complete call failed after everything was already correct). */}
            {!currentFocusedSentence && (
              <button onClick={handleFinishNow} disabled={isSubmitting} style={btnGhost}>
                Finish Now
              </button>
            )}
          </div>

          {currentFocusedSentence && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type what you hear"
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
                    if (feedback?.isCorrect) advanceFocusedStep()
                    else handleFocusedSubmit()
                  }
                }}
              />
              <div style={{ display: 'flex', gap: 12 }}>
                {feedback?.isCorrect ? (
                  <button onClick={advanceFocusedStep} disabled={isSubmitting} title="Next (Enter)" style={btnPrimary}>
                    Next
                  </button>
                ) : (
                  <>
                    <button onClick={handleFocusedSubmit} title="Check (Enter)" style={btnPrimary}>
                      Check
                    </button>
                    <button onClick={advanceFocusedStep} disabled={isSubmitting} style={btnGhost}>
                      Skip
                    </button>
                  </>
                )}
                <button onClick={handleFinishNow} disabled={isSubmitting} style={btnGhost}>
                  Finish Now
                </button>
              </div>

              {feedback && (
                <div
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: feedback.isCorrect ? 'var(--leaf-soft)' : 'var(--primary-soft)',
                    borderRadius: 16,
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  {feedback.isCorrect ? (
                    <span style={{ fontWeight: 800, color: 'var(--leaf-dark)' }}>Nice — that&apos;s right!</span>
                  ) : (
                    <>
                      <span style={{ fontWeight: 800, color: 'var(--error)' }}>Incorrect — try again.</span>
                      <div style={{ fontSize: 17, lineHeight: 1.8, fontWeight: 400 }}>
                        <DiffText words={feedback.words} variant="dictation" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const stepNumber = stepIndex + 1
  const totalSteps = roundSteps.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 760, maxWidth: '100%' }}>
      <audio ref={audioRef} src={audioObjectUrl ?? undefined} />

      <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {session && (
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-soft)' }}>
            Round {session.currentRound}
            {!roundChoiceVisible && totalSteps > 0 && ` · Sentence ${Math.min(stepNumber, totalSteps)} of ${totalSteps}`}
          </span>
        )}

        {actionErrorBanner}

        {roundChoiceVisible ? (
          <div style={{ display: 'flex', gap: 14 }}>
            <button onClick={handleContinueBlindRound} disabled={isSubmitting} style={btnPrimary}>
              Continue to Round {session!.currentRound}
            </button>
            <button onClick={handleSwitchToFocused} disabled={isSubmitting} style={btnGhost}>
              Switch to Focused Practice
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handlePlayPauseClick}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={!session}
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
                cursor: session ? 'pointer' : 'default',
                opacity: session ? 1 : 0.5
              }}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            {awaitingInput && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type what you hear"
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
                <div>
                  <button onClick={handleAdvanceStep} title="Next (Enter)" style={btnPrimary}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
