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
  const audioRef = useRef<HTMLAudioElement>(null)

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

    function onTimeUpdate() {
      if (audio.currentTime < end) return
      audio.pause()
      if (!currentStep!.requiresInput) {
        setStepIndex((i) => i + 1)
      }
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    return () => audio.removeEventListener('timeupdate', onTimeUpdate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, currentSentence?.id, roundChoiceVisible, session?.currentPhase])

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

  // Shared by both phases' round-end logic: posts to /complete and, once a score comes back,
  // hands off to the final summary screen rather than calling onCompleted directly — the
  // summary's own Done button is what fires onCompleted. A response with no parseable body
  // (nothing but a mocked bare 204 should ever produce that in practice) just leaves the
  // summary unset rather than throwing an unhandled rejection.
  async function completeSession(newlyCorrectSentenceIds: string[]) {
    if (!session) return
    const response = await fetch(`/api/learner/full-dictation-sessions/${session.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newlyCorrectSentenceIds })
    })
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
    await fetch(`/api/learner/full-dictation-sessions/${session.id}/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentRound: nextRound, currentPhase: 'Blind', newlyCorrectSentenceIds: newlyCorrect })
    })
    setCorrectSentenceIds(updatedCorrectIds)
    setSession({ ...session, currentRound: nextRound })
    setRoundChoiceVisible(true)
  }

  function handleAdvanceStep() {
    if (!currentStep) return
    const nextAnswers = new Map(roundAnswers)
    if (currentStep.requiresInput) nextAnswers.set(currentStep.sentenceId, answer)
    setAnswer('')
    setAwaitingInput(false)

    if (stepIndex + 1 >= roundSteps.length) {
      finishBlindRound(nextAnswers)
    } else {
      setRoundAnswers(nextAnswers)
      setStepIndex(stepIndex + 1)
    }
  }

  function handleContinueBlindRound() {
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
    await fetch(`/api/learner/full-dictation-sessions/${session.id}/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentRound: session.currentRound, currentPhase: 'Focused', newlyCorrectSentenceIds: [] })
    })
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
    await fetch(`/api/learner/full-dictation-sessions/${session.id}/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentRound: nextRound, currentPhase: 'Focused', newlyCorrectSentenceIds: [...focusedRoundNewlyCorrect] })
    })
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

  if (session?.currentPhase === 'Focused') {
    if (roundChoiceVisible) {
      return (
        <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 18, width: 760, maxWidth: '100%' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-soft)' }}>Round {session.currentRound}</span>
          <div style={{ display: 'flex', gap: 14 }}>
            <button onClick={handleContinueFocusedRound} style={btnPrimary}>
              Continue to Focused Round {session.currentRound}
            </button>
            <button onClick={handleFinishNow} style={btnGhost}>
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

          <div>
            <button onClick={handleFocusedReplay} style={btnGhost}>
              Replay
            </button>
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
                  <button onClick={advanceFocusedStep} title="Next (Enter)" style={btnPrimary}>
                    Next
                  </button>
                ) : (
                  <>
                    <button onClick={handleFocusedSubmit} title="Check (Enter)" style={btnPrimary}>
                      Check
                    </button>
                    <button onClick={advanceFocusedStep} style={btnGhost}>
                      Skip
                    </button>
                  </>
                )}
                <button onClick={handleFinishNow} style={btnGhost}>
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

        {roundChoiceVisible ? (
          <div style={{ display: 'flex', gap: 14 }}>
            <button onClick={handleContinueBlindRound} style={btnPrimary}>
              Continue to Round {session!.currentRound}
            </button>
            <button onClick={handleSwitchToFocused} style={btnGhost}>
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
