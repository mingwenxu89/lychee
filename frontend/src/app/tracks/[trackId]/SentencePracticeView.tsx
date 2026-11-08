'use client'

import { useEffect, useRef, useState } from 'react'
import { parseTimeSpanToSeconds } from '@/lib/timeSpan'
import { isSpeechRecognitionSupported, createContinuousRecognizer } from '@/lib/speechRecognition'
import { compare } from '@/lib/textComparer'
import { DiffText, type WordDiff } from '@/components/DiffText'
import { SentenceProgressGrid } from './SentenceProgressGrid'
import type { LearnerTrack } from './page'

type PracticeSession = { id: string; trackId: string; currentSentenceIndex: number; status: 'InProgress' | 'Completed'; completedAt: string | null }
type SubmitResult = { accuracyScore: number; isCorrect: boolean; words: WordDiff[] }
type AdvanceResult = { currentSentenceIndex: number; isCompleted: boolean }

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

const btnPrimarySmall: React.CSSProperties = {
  ...btnPrimary,
  fontSize: 14,
  padding: '11px 24px',
  boxShadow: 'none'
}

const btnGhostSmall: React.CSSProperties = {
  ...btnGhost,
  fontSize: 14,
  padding: '9px 20px'
}

const chipStyle: React.CSSProperties = {
  background: 'oklch(96% 0.01 80)',
  borderRadius: 999,
  padding: '8px 16px',
  fontWeight: 700,
  fontSize: 13,
  color: 'var(--ink-soft)'
}

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

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'Enter', description: 'Check / Next' },
  { keys: 'Ctrl', description: 'Replay this sentence' },
  { keys: 'Ctrl + <', description: 'Previous sentence' },
  { keys: 'Ctrl + >', description: 'Next sentence' },
  { keys: 'Ctrl + /', description: 'Reset' },
  { keys: 'Ctrl + Enter', description: 'Skip' },
  { keys: 'Ctrl + M', description: 'Toggle microphone' },
  { keys: 'Ctrl + F', description: 'Toggle favorite' }
]

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SentencePracticeView({
  track,
  audioObjectUrl,
  audioError,
  onCompleted,
  onBack
}: {
  track: LearnerTrack
  audioObjectUrl: string | null
  audioError: string | null
  onCompleted: () => void
  onBack: () => void
}) {
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [elapsedInSentence, setElapsedInSentence] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set())
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [favoritedSentenceIds, setFavoritedSentenceIds] = useState(
    () => new Set(track.sentences.filter((s) => s.isFavorited).map((s) => s.id))
  )
  const audioRef = useRef<HTMLAudioElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognizerRef = useRef<{ start: () => void; stop: () => void; resetSegment: () => void } | null>(null)
  const baseAnswerRef = useRef('')
  const ctrlComboFiredRef = useRef(false)
  const autoplayOnChangeRef = useRef(false)

  useEffect(() => {
    if (audioError) {
      setError(audioError)
      return
    }
    if (audioObjectUrl === null) return // still downloading, at the page level

    async function init() {
      const startResponse = await fetch(`/api/learner/tracks/${track.id}/practice-session/start`, { method: 'POST' })
      if (!startResponse.ok) {
        setError('Failed to start practice session.')
        return
      }
      const startedSession: PracticeSession = await startResponse.json()
      // Seed completed sentences from wherever the session resumes at (a prior visit's real
      // progress) — from here on, only an actual correct check or a Skip adds to this set;
      // navigating with Previous/Next or jumping via the Progress list never does.
      setCompletedIndices(new Set(Array.from({ length: startedSession.currentSentenceIndex }, (_, i) => i)))
      setSession(startedSession)
    }
    init()
  }, [track.id, audioObjectUrl, audioError])

  const currentSentence = session ? track.sentences[session.currentSentenceIndex] : null
  const sentenceStart = currentSentence ? parseTimeSpanToSeconds(currentSentence.startTime) : 0
  const sentenceEnd = currentSentence ? parseTimeSpanToSeconds(currentSentence.endTime) : 0
  const sentenceDuration = Math.max(0.001, sentenceEnd - sentenceStart)

  useEffect(() => {
    if (!audioRef.current || !currentSentence) return
    const audio = audioRef.current
    audio.currentTime = sentenceStart
    setElapsedInSentence(0)

    // Stopping at sentenceEnd used to be driven off the 'timeupdate' event, but that event
    // only fires every ~250ms (browser-dependent), so playback would audibly run 100-200ms
    // past the boundary before the check even ran. A precisely-scheduled setTimeout, armed
    // whenever playback actually starts/resumes/seeks, stops right on time instead.
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
      // Covers replay-while-already-playing (Ctrl): currentTime jumps back to sentenceStart
      // without a 'play' event firing (playback never actually paused), so re-arm here too.
      if (!audio.paused) scheduleStopTimer()
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('seeked', onSeeked)

    if (autoplayOnChangeRef.current) {
      autoplayOnChangeRef.current = false
      audio.play()
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('seeked', onSeeked)
      clearStopTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSentence])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    function onPlay() {
      setIsPlaying(true)
    }
    function onPause() {
      setIsPlaying(false)
    }
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [answer])

  // The mic must only ever stop via an explicit user action (click or Ctrl+M — see
  // handleMicClick), never just because the sentence changed. But the underlying recognizer's
  // event.results never shrinks or resets on its own, so if left alone across a sentence
  // boundary it would keep prepending the PREVIOUS sentence's words onto every new transcript —
  // this marks a fresh transcript "segment" boundary right as the new sentence loads, without
  // touching isRecording or calling stop(), matching FullDictationView's same fix.
  useEffect(() => {
    if (!isRecording) return
    recognizerRef.current?.resetSegment()
    baseAnswerRef.current = ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currentSentenceIndex])

  function handlePlayPauseClick() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play()
    } else {
      audio.pause()
    }
  }

  function handleReplayClick() {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = sentenceStart
    audio.play()
  }

  function handleTryAgain() {
    setAnswer('')
    setResult(null)
    handleReplayClick()
  }

  function handleSubmit() {
    if (!session || !currentSentence) return
    setActionError(null)
    const comparison = compare(currentSentence.text, answer)
    setResult({ accuracyScore: comparison.accuracyScore, isCorrect: comparison.isExactMatch, words: comparison.words })
    if (!comparison.isExactMatch) return

    setCompletedIndices((prev) => new Set(prev).add(session.currentSentenceIndex))

    // Only a correct answer is ever sent to the backend at all — a wrong attempt never leaves
    // the browser, and skipping (handleAdvance) has never recorded one either. The call just
    // marks the sentence practiced today (for the activity-streak feature); nothing about this
    // specific submission is kept, so there's nothing else to send.
    setAnswer(currentSentence.text)
    fetch(`/api/learner/practice-sessions/${session.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentenceId: currentSentence.id })
    }).then((response) => {
      if (!response.ok) setActionError('Failed to save your progress. Please try again.')
    })
  }

  async function handleAdvance(toIndex: number) {
    if (!session) return
    setActionError(null)
    const response = await fetch(`/api/learner/practice-sessions/${session.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toIndex })
    })
    if (!response.ok) {
      setActionError('Failed to save your progress. Please try again.')
      return
    }
    const advanced: AdvanceResult = await response.json()
    setAnswer('')
    setResult(null)
    if (advanced.isCompleted) {
      autoplayOnChangeRef.current = false
      onCompleted()
    } else {
      setSession({ ...session, currentSentenceIndex: advanced.currentSentenceIndex })
    }
  }

  function handleAdvanceAndPlay(toIndex: number) {
    autoplayOnChangeRef.current = true
    handleAdvance(toIndex)
  }

  function handleSkip() {
    if (!session) return
    // Skip means the learner is confident they know this sentence, so it counts toward
    // Progress — unlike Previous/Next (pure navigation) or jumping via the Progress list.
    setCompletedIndices((prev) => new Set(prev).add(session.currentSentenceIndex))
    handleAdvanceAndPlay(session.currentSentenceIndex + 1)
  }

  async function handleToggleSentenceFavorite() {
    if (!currentSentence) return
    const sentenceId = currentSentence.id
    const isFavorited = favoritedSentenceIds.has(sentenceId)
    setFavoritedSentenceIds((prev) => {
      const next = new Set(prev)
      if (isFavorited) next.delete(sentenceId)
      else next.add(sentenceId)
      return next
    })
    const response = await fetch(`/api/learner/sentences/${sentenceId}/favorite`, { method: isFavorited ? 'DELETE' : 'PUT' })
    if (!response.ok) {
      setFavoritedSentenceIds((prev) => {
        const next = new Set(prev)
        if (isFavorited) next.add(sentenceId)
        else next.delete(sentenceId)
        return next
      })
    }
  }

  function handleMicClick() {
    if (isRecording) {
      recognizerRef.current?.stop()
      return
    }
    // Same staleness fix as the textarea's onChange: starting a fresh voice answer invalidates
    // whatever Check result (correct or not) is currently showing.
    if (result) setResult(null)
    baseAnswerRef.current = answer
    const recognizer = createContinuousRecognizer(
      (text) => setAnswer(baseAnswerRef.current ? `${baseAnswerRef.current} ${text}` : text),
      () => setIsRecording(false)
    )
    recognizerRef.current = recognizer
    setIsRecording(true)
    recognizer.start()
  }

  // Pre-download (and session start) gate the playback/answer controls rather than
  // hiding them entirely: the controls must exist in the DOM up front (disabled)
  // so the learner sees the view take shape, per spec §5.1 "pre-download gates
  // playback controls".
  const isReady = session !== null && currentSentence !== null && audioObjectUrl !== null

  // Keyboard shortcuts: plain Enter mirrors Check/Next; a tap of Ctrl alone (pressed and
  // released with nothing else in between) rewinds to the sentence's start and replays it
  // (Play/Pause itself stays mouse-only, unlike Full Listen's Space shortcut); Ctrl held as a
  // modifier for < / > / Enter / M mirrors Previous/Next/Reset/Skip/Mic. The tap-vs-modifier
  // distinction is tracked via ctrlComboFiredRef, since holding Ctrl to reach any of those
  // combos also fires a bare Control keydown first.
  useEffect(() => {
    if (!isReady || showShortcuts) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Control') {
        ctrlComboFiredRef.current = false
        return
      }

      if (e.ctrlKey) {
        // Bind to the physical comma/period keys regardless of whether Shift is actually held —
        // browsers are inconsistent about resolving e.key to '<'/'>' under the three-key
        // Ctrl+Shift+, combo, and a learner reaching for "Ctrl + <" is just as likely to press
        // Ctrl+, without shift as the shifted symbol itself.
        const isPrevCombo = e.code === 'Comma' || e.key === ',' || e.key === '<'
        const isNextCombo = e.code === 'Period' || e.key === '.' || e.key === '>'
        if (isPrevCombo) {
          e.preventDefault()
          ctrlComboFiredRef.current = true
          if (session) handleAdvanceAndPlay(session.currentSentenceIndex - 1)
        } else if (isNextCombo) {
          e.preventDefault()
          ctrlComboFiredRef.current = true
          if (session) handleAdvanceAndPlay(session.currentSentenceIndex + 1)
        } else if (e.key === '/') {
          e.preventDefault()
          ctrlComboFiredRef.current = true
          handleTryAgain()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          ctrlComboFiredRef.current = true
          handleSkip()
        } else if (e.key.toLowerCase() === 'm' && isSpeechRecognitionSupported()) {
          e.preventDefault()
          ctrlComboFiredRef.current = true
          handleMicClick()
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault()
          ctrlComboFiredRef.current = true
          handleToggleSentenceFavorite()
        }
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (result?.isCorrect && session) {
          handleAdvanceAndPlay(session.currentSentenceIndex + 1)
        } else {
          handleSubmit()
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Control') return
      if (!ctrlComboFiredRef.current) handleReplayClick()
      ctrlComboFiredRef.current = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isReady, showShortcuts, session, result, answer, isRecording, currentSentence, favoritedSentenceIds])

  if (error) return <p role="alert" style={{ color: 'var(--error)', fontWeight: 700 }}>{error}</p>

  const sentenceNumber = session ? session.currentSentenceIndex + 1 : 1
  const totalSentences = track.sentences.length

  return (
    <div style={{ display: 'flex', gap: 24, width: '100%', maxWidth: 1040 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 760, maxWidth: '100%' }}>
        {!isReady && <p style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Loading practice session...</p>}

        <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <audio ref={audioRef} src={audioObjectUrl ?? undefined} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <button
              onClick={onBack}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-soft)', fontWeight: 800, fontSize: 15, flexShrink: 0 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.5"><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back
            </button>
            <span style={{ ...chipStyle, background: 'var(--primary-soft)', color: 'var(--ink-soft)' }}>
              Sentence {sentenceNumber} / {totalSentences}
            </span>
            <div style={{ flex: 1, height: 10, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(sentenceNumber / totalSentences) * 100}%`,
                  height: '100%',
                  background: 'var(--primary)',
                  borderRadius: 999
                }}
              />
            </div>
          </div>

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
              onClick={() => session && handleAdvanceAndPlay(session.currentSentenceIndex - 1)}
              disabled={!isReady || !session || session.currentSentenceIndex === 0}
              aria-label="Previous sentence"
              title="Previous sentence (Ctrl+<)"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: 'transparent',
                border: '2px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: isReady && session && session.currentSentenceIndex > 0 ? 'pointer' : 'default',
                opacity: isReady && session && session.currentSentenceIndex > 0 ? 1 : 0.4
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.5"><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button
              onClick={handlePlayPauseClick}
              disabled={!isReady}
              aria-label={isPlaying ? 'Pause' : 'Play'}
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
                cursor: isReady ? 'pointer' : 'default',
                opacity: isReady ? 1 : 0.5
              }}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button
              onClick={() => session && handleAdvanceAndPlay(session.currentSentenceIndex + 1)}
              disabled={!isReady}
              aria-label="Next sentence"
              title="Next sentence (Ctrl+>)"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: 'transparent',
                border: '2px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: isReady ? 'pointer' : 'default',
                opacity: isReady ? 1 : 0.4
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.5"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3, height: 32 }}>
              {[14, 24, 10, 30, 18, 8, 20, 12, 22, 10].map((height, i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    height,
                    borderRadius: 2,
                    background: i < 5 ? 'var(--primary)' : 'oklch(88% 0.01 80)'
                  }}
                />
              ))}
            </div>
            <span style={{ fontWeight: 700, color: 'var(--ink-soft)', fontSize: 13 }}>
              {formatTime(elapsedInSentence)} / {formatTime(sentenceDuration)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '-8px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>
              Press &quot;Ctrl&quot; to replay.
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              ref={textareaRef}
              rows={3}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value)
                // Editing after a Check result (correct or not) invalidates it — the checkmark/
                // diff box (and, for a correct result, the Next button in its place) must not
                // keep showing stale feedback for text the learner has since changed.
                if (result) setResult(null)
                // This only fires on a real keystroke, never on the recognizer's own updates (a
                // controlled value= change doesn't dispatch a DOM change event) — so it's a clean
                // signal that the learner just typed or deleted something by hand. The mic's
                // "already recognized" text is still the un-edited baseAnswerRef snapshot plus
                // everything recognized since recording started, which would otherwise silently
                // restore anything just deleted the next time it fires. Treat this edit as the
                // new baseline and tell the recognizer to forget everything before it.
                if (isRecording) {
                  baseAnswerRef.current = e.target.value
                  recognizerRef.current?.resetSegment()
                }
              }}
              placeholder="Type what you hear, or tap the mic to speak it instead"
              disabled={!isReady}
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
                overflow: 'hidden',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {result && result.isCorrect ? (
                  <button
                    onClick={() => session && handleAdvanceAndPlay(session.currentSentenceIndex + 1)}
                    disabled={!isReady}
                    title="Next (Enter)"
                    style={btnPrimarySmall}
                  >
                    Next
                  </button>
                ) : (
                  <>
                    <button onClick={handleSubmit} disabled={!isReady} title="Check (Enter)" style={{ ...btnPrimarySmall, opacity: isReady ? 1 : 0.5 }}>Check</button>
                    <button
                      onClick={handleSkip}
                      disabled={!isReady}
                      title="Skip (Ctrl+Enter)"
                      style={{ ...btnGhostSmall, opacity: isReady ? 1 : 0.5 }}
                    >
                      Skip
                    </button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={handleToggleSentenceFavorite}
                  disabled={!currentSentence}
                  aria-label={currentSentence && favoritedSentenceIds.has(currentSentence.id) ? 'Remove sentence from favorites' : 'Add sentence to favorites'}
                  aria-pressed={currentSentence ? favoritedSentenceIds.has(currentSentence.id) : false}
                  title="Toggle favorite (Ctrl+F)"
                  style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={currentSentence && favoritedSentenceIds.has(currentSentence.id) ? 'var(--primary)' : 'none'}
                    stroke={currentSentence && favoritedSentenceIds.has(currentSentence.id) ? 'var(--primary)' : 'var(--ink-faint)'}
                    strokeWidth="2"
                  >
                    <path d="M12 21s-6.7-4.35-9.3-8.28C1.02 10.4 1.5 6.9 4.3 5.3a5 5 0 0 1 7 1.2 5 5 0 0 1 7-1.2c2.8 1.6 3.28 5.1 1.6 7.42C18.7 16.65 12 21 12 21z" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={handleTryAgain}
                  aria-label="Reset"
                  title="Reset (Ctrl+/)"
                  disabled={!isReady}
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
                    cursor: isReady ? 'pointer' : 'default',
                    opacity: isReady ? 1 : 0.5
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.5">
                    <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
                    <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              {isSpeechRecognitionSupported() && (
                <button
                  onClick={handleMicClick}
                  aria-label={isRecording ? 'Stop microphone' : 'Use microphone'}
                  title={isRecording ? 'Stop microphone (Ctrl+M)' : 'Use microphone (Ctrl+M)'}
                  disabled={!isReady}
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
                    cursor: isReady ? 'pointer' : 'default'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0" strokeLinecap="round" /></svg>
                  {isRecording && (
                    <span
                      aria-label="Recording"
                      className="recording-dot"
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: 'var(--error)'
                      }}
                    />
                  )}
                </button>
              )}
              </div>
            </div>
          </div>

          {actionError && <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0 }}>{actionError}</p>}

          {result && (
            <div
              style={{
                width: '100%',
                boxSizing: 'border-box',
                // Neutral gray, deliberately matching Full Dictation's result-panel
                // background (see resultPanelBg in FullDictationView.tsx) so both
                // dictation modes' result screens look the same.
                background: 'oklch(96% 0 0)',
                borderRadius: 16,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              {result.isCorrect && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: 'var(--leaf)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--leaf-dark)' }}>Nice — that&apos;s right!</span>
                </div>
              )}
              <div style={{ fontSize: 17, lineHeight: 1.8, fontWeight: 400 }}>
                <DiffText words={result.words} variant="dictation" firstMismatchOnly />
              </div>
              {currentSentence?.translation && (
                <span style={{ fontSize: 15, color: 'var(--ink-faint)', fontWeight: 500 }}>
                  {currentSentence.translation}
                </span>
              )}
            </div>
          )}

        </div>
      </div>

      <SentenceProgressGrid
        count={track.sentences.length}
        disabled={!isReady}
        onJump={handleAdvanceAndPlay}
        getStatus={(i) => {
          if (session !== null && i === session.currentSentenceIndex) return 'current'
          if (completedIndices.has(i)) return 'correct'
          return 'untouched'
        }}
      />

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
