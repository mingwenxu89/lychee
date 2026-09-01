'use client'

import { useEffect, useRef, useState } from 'react'
import { preloadAudio } from '@/lib/audioPreload'
import { parseTimeSpanToSeconds } from '@/lib/timeSpan'
import { isSpeechRecognitionSupported, createSingleUtteranceRecognizer } from '@/lib/speechRecognition'
import { DiffText, type WordDiff } from '@/components/DiffText'
import type { LearnerTrack } from './page'

type PracticeSession = { id: string; trackId: string; currentSentenceIndex: number; status: 'InProgress' | 'Completed'; completedAt: string | null }
type SubmitResult = { accuracyScore: number; isCorrect: boolean; words: WordDiff[] }
type AdvanceResult = { currentSentenceIndex: number; isCompleted: boolean; overallAccuracy: number | null }

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  boxShadow: '0 10px 0 var(--line), 0 14px 28px oklch(22% 0.03 270 / 0.07)'
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--primary)',
  color: 'white',
  fontWeight: 800,
  fontSize: 16,
  border: 'none',
  borderRadius: 999,
  padding: '14px 30px',
  boxShadow: '0 5px 0 var(--primary-dark)',
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

const chipStyle: React.CSSProperties = {
  background: 'oklch(96% 0.01 80)',
  borderRadius: 999,
  padding: '8px 16px',
  fontWeight: 700,
  fontSize: 13,
  color: 'var(--ink-soft)'
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SentencePracticeView({
  track,
  initialSentenceIndex,
  onCompleted
}: {
  track: LearnerTrack
  initialSentenceIndex: number | null
  onCompleted: (accuracyScore: number) => void
}) {
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null)
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [elapsedInSentence, setElapsedInSentence] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function init() {
      try {
        const objectUrl = await preloadAudio(track.audioUrl)
        setAudioObjectUrl(objectUrl)
      } catch {
        setError('Failed to download audio for this track.')
        return
      }

      const startResponse = await fetch(`/api/learner/tracks/${track.id}/practice-session/start`, { method: 'POST' })
      if (!startResponse.ok) {
        setError('Failed to start practice session.')
        return
      }
      const startedSession: PracticeSession = await startResponse.json()

      if (initialSentenceIndex !== null) {
        const advanceResponse = await fetch(`/api/learner/practice-sessions/${startedSession.id}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toIndex: initialSentenceIndex })
        })
        const advanced: AdvanceResult = await advanceResponse.json()
        setSession({ ...startedSession, currentSentenceIndex: advanced.currentSentenceIndex })
      } else {
        setSession(startedSession)
      }
    }
    init()
  }, [track.id, track.audioUrl, initialSentenceIndex])

  const currentSentence = session ? track.sentences[session.currentSentenceIndex] : null
  const sentenceStart = currentSentence ? parseTimeSpanToSeconds(currentSentence.startTime) : 0
  const sentenceEnd = currentSentence ? parseTimeSpanToSeconds(currentSentence.endTime) : 0
  const sentenceDuration = Math.max(0.001, sentenceEnd - sentenceStart)

  useEffect(() => {
    if (!audioRef.current || !currentSentence) return
    const audio = audioRef.current
    audio.currentTime = sentenceStart
    setElapsedInSentence(0)

    function onTimeUpdate() {
      if (audio.currentTime >= sentenceEnd) {
        audio.pause()
        audio.currentTime = sentenceStart
        setElapsedInSentence(0)
        return
      }
      setElapsedInSentence(audio.currentTime - sentenceStart)
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    return () => audio.removeEventListener('timeupdate', onTimeUpdate)
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

  function handlePlayPauseClick() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play()
    } else {
      audio.pause()
    }
  }

  async function handleSubmit() {
    if (!session || !currentSentence) return
    setActionError(null)
    const response = await fetch(`/api/learner/practice-sessions/${session.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentenceId: currentSentence.id, submittedText: answer })
    })
    if (response.ok) {
      setResult(await response.json())
    } else {
      setActionError('Failed to submit your answer. Please try again.')
    }
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
      onCompleted(advanced.overallAccuracy ?? 0)
    } else {
      setSession({ ...session, currentSentenceIndex: advanced.currentSentenceIndex })
    }
  }

  function handleMicClick() {
    const recognizer = createSingleUtteranceRecognizer((text) => setAnswer(text))
    recognizer.start()
  }

  if (error) return <p role="alert" style={{ color: 'var(--error)', fontWeight: 700 }}>{error}</p>

  // Pre-download (and session start) gate the playback/answer controls rather than
  // hiding them entirely: the controls must exist in the DOM up front (disabled)
  // so the learner sees the view take shape, per spec §5.1 "pre-download gates
  // playback controls".
  const isReady = session !== null && currentSentence !== null && audioObjectUrl !== null
  const sentenceNumber = session ? session.currentSentenceIndex + 1 : 1
  const totalSentences = track.sentences.length

  return (
    <div style={{ display: 'flex', gap: 32, width: '100%', maxWidth: 1040 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 760, maxWidth: '100%' }}>
        {!isReady && <p style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Loading practice session...</p>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ ...chipStyle, background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}>
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

        <div style={{ ...cardStyle, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <audio ref={audioRef} src={audioObjectUrl ?? undefined} />

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
              onClick={() => session && handleAdvance(session.currentSentenceIndex - 1)}
              disabled={!isReady || !session || session.currentSentenceIndex === 0}
              aria-label="Previous sentence"
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
              onClick={() => session && handleAdvance(session.currentSentenceIndex + 1)}
              disabled={!isReady}
              aria-label="Next sentence"
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <textarea
                ref={textareaRef}
                rows={3}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type what you hear"
                disabled={!isReady}
                style={{
                  flex: 1,
                  border: '2px solid var(--line)',
                  borderRadius: 16,
                  padding: '16px 18px',
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  fontFamily: 'inherit',
                  resize: 'none',
                  overflow: 'hidden'
                }}
              />
              {isSpeechRecognitionSupported() && (
                <button
                  onClick={handleMicClick}
                  aria-label="Use microphone"
                  disabled={!isReady}
                  style={{
                    width: 56,
                    height: 56,
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
                  🎤
                </button>
              )}
              {result && !result.isCorrect && (
                <button onClick={() => setResult(null)} style={{ ...btnPrimary, boxShadow: 'none' }}>Try Again</button>
              )}
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600, paddingLeft: 2 }}>
              Type your answer, or tap the mic to speak it instead
            </span>
          </div>

          {actionError && <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0 }}>{actionError}</p>}

          {result && (
            <div
              style={{
                background: result.isCorrect ? 'var(--leaf-soft)' : 'var(--primary-soft)',
                borderRadius: 16,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {result.isCorrect ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--leaf-dark)" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16h.01" /></svg>
                )}
                <span style={{ fontWeight: 800, color: result.isCorrect ? 'var(--leaf-dark)' : 'var(--primary-dark)' }}>
                  {result.isCorrect ? 'Nice — that\'s right!' : 'So close — try again!'}
                </span>
              </div>
              <div style={{ fontSize: 17, lineHeight: 1.8, fontWeight: 600 }}>
                <DiffText words={result.words} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {result && result.isCorrect ? (
              <button
                onClick={() => session && handleAdvance(session.currentSentenceIndex + 1)}
                disabled={!isReady}
                style={btnPrimary}
              >
                Next
              </button>
            ) : (
              <>
                <button onClick={handleSubmit} disabled={!isReady} style={{ ...btnPrimary, boxShadow: 'none', opacity: isReady ? 1 : 0.5 }}>Check</button>
                <button
                  onClick={() => session && handleAdvance(session.currentSentenceIndex + 1)}
                  disabled={!isReady}
                  style={{ ...btnGhost, opacity: isReady ? 1 : 0.5 }}
                >
                  Skip
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...cardStyle, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-soft)' }}>Sentence Progress</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {track.sentences.map((s, i) => {
              const isDone = session !== null && i < session.currentSentenceIndex
              const isCurrent = session !== null && i === session.currentSentenceIndex
              return (
                <button
                  key={s.id}
                  onClick={() => handleAdvance(i)}
                  disabled={!isReady}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    cursor: isReady ? 'pointer' : 'default',
                    fontWeight: 800,
                    fontSize: 12,
                    background: isDone ? 'var(--leaf)' : isCurrent ? 'var(--surface)' : 'transparent',
                    border: isCurrent ? '3px solid var(--primary)' : isDone ? 'none' : '2px solid var(--line)',
                    color: isCurrent ? 'var(--primary)' : 'white'
                  }}
                >
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                  ) : (
                    i + 1
                  )}
                </button>
              )
            })}
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>Tap any sentence to jump straight to it</span>
        </div>
      </div>
    </div>
  )
}
