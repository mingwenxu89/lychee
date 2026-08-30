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
  const audioRef = useRef<HTMLAudioElement>(null)

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

  useEffect(() => {
    if (!audioRef.current || !currentSentence) return
    const audio = audioRef.current
    const start = parseTimeSpanToSeconds(currentSentence.startTime)
    const end = parseTimeSpanToSeconds(currentSentence.endTime)
    audio.currentTime = start

    function onTimeUpdate() {
      if (audio.currentTime >= end) {
        audio.pause()
        audio.currentTime = start
      }
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    return () => audio.removeEventListener('timeupdate', onTimeUpdate)
  }, [currentSentence])

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

  if (error) return <p role="alert">{error}</p>

  // Pre-download (and session start) gate the playback/answer controls rather than
  // hiding them entirely: the controls must exist in the DOM up front (disabled)
  // so the learner sees the view take shape, per spec §5.1 "pre-download gates
  // playback controls".
  const isReady = session !== null && currentSentence !== null && audioObjectUrl !== null

  return (
    <div>
      {!isReady && <p>Loading practice session...</p>}
      <audio ref={audioRef} src={audioObjectUrl ?? undefined} />
      <button onClick={() => audioRef.current?.play()} disabled={!isReady}>Play</button>

      <div>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type what you hear"
          disabled={!isReady}
        />
        {isSpeechRecognitionSupported() && (
          <button onClick={handleMicClick} aria-label="Use microphone" disabled={!isReady}>🎤</button>
        )}
        <button onClick={handleSubmit} disabled={!isReady}>Submit</button>
      </div>

      {actionError && <p role="alert">{actionError}</p>}

      {result && (
        <div>
          <DiffText words={result.words} />
          <button onClick={() => setResult(null)}>Retry</button>
        </div>
      )}

      <button onClick={() => session && handleAdvance(session.currentSentenceIndex + 1)} disabled={!isReady}>Next</button>

      <ol>
        {track.sentences.map((s, i) => (
          <li key={s.id}>
            <button onClick={() => handleAdvance(i)} disabled={!isReady}>{i + 1}</button>
          </li>
        ))}
      </ol>
    </div>
  )
}
