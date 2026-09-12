'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { breadcrumbLinkStyle } from '@/lib/breadcrumbLinkStyle'
import { SentencePracticeView } from './SentencePracticeView'
import { FullTextView } from './FullTextView'
import { FullDictationView } from './FullDictationView'
import { RecitationPanel } from './RecitationPanel'
import { CompletionPage } from './CompletionPage'
import { preloadAudio } from '@/lib/audioPreload'

export type LearnerSentence = { id: string; index: number; text: string; startTime: string; endTime: string; isFavorited: boolean; translation: string | null }
export type LearnerTrack = {
  id: string
  unitId: string
  exerciseId: string
  title: string
  description: string | null
  exerciseTitle: string
  level: string
  wordsPerMinute: number
  duration: string
  audioUrl: string
  sentences: LearnerSentence[]
  nextTrackId: string | null
  isFavorited: boolean
}

export default function TrackPage() {
  return (
    <Suspense fallback={<main style={{ padding: 40 }}>Loading...</main>}>
      <TrackPageContent />
    </Suspense>
  )
}

function TrackPageContent() {
  const { trackId } = useParams<{ trackId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const modeParam = searchParams.get('mode')
  const initialMode =
    modeParam === 'sentence' ? 'sentence'
    : modeParam === 'dictation' ? 'dictation'
    : modeParam === 'recite' ? 'recite'
    : 'full'
  const [track, setTrack] = useState<LearnerTrack | null>(null)
  const [mode, setMode] = useState<'sentence' | 'full' | 'dictation' | 'recite'>(initialMode)
  const [error, setError] = useState<string | null>(null)
  const [completion, setCompletion] = useState<{ accuracyScore: number | null; mode: 'sentence' | 'full' | 'dictation' | 'recite' } | null>(null)
  const [practiceKey, setPracticeKey] = useState(0)
  const [isFavorited, setIsFavorited] = useState(false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/learner/tracks/${trackId}`)
      if (!response.ok) {
        setError('Failed to load this track.')
        return
      }
      const loadedTrack: LearnerTrack = await response.json()
      setTrack(loadedTrack)
      setIsFavorited(loadedTrack.isFavorited)
    }
    load()
  }, [trackId])

  // Downloaded once per track here, at the page level, and handed down to every mode — Sentence
  // Dictation and Full Dictation need the full audio bytes up front for fast, repeated in-place
  // replay; Full Listen used to stream track.audioUrl directly instead (it only ever played
  // forward, so it didn't need to wait), but that meant a Full Listen visit downloaded the same
  // file a second time in the background anyway once this preload kicked in. Track files are
  // small enough now (Opus) that the wait is negligible, so all four modes share this one
  // download instead of paying for it twice.
  useEffect(() => {
    if (!track) return
    setAudioObjectUrl(null)
    setAudioError(null)
    let cancelled = false
    preloadAudio(track.audioUrl)
      .then((objectUrl) => {
        if (!cancelled) setAudioObjectUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setAudioError('Failed to download audio for this track.')
      })
    return () => {
      cancelled = true
    }
  }, [track?.audioUrl])

  if (error) return <main style={{ padding: 40 }}>{error}</main>
  if (!track) return <main style={{ padding: 40, color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</main>

  async function handleToggleFavorite() {
    setIsTogglingFavorite(true)
    const nextValue = !isFavorited
    setIsFavorited(nextValue)
    const response = await fetch(`/api/learner/tracks/${trackId}/favorite`, { method: nextValue ? 'PUT' : 'DELETE' })
    setIsTogglingFavorite(false)
    if (!response.ok) setIsFavorited(!nextValue)
  }

  function handlePracticeAgain() {
    setCompletion(null)
    setPracticeKey((k) => k + 1)
  }

  function handleNextTrack() {
    if (track!.nextTrackId) {
      router.push(`/tracks/${track!.nextTrackId}?mode=${completion?.mode ?? 'full'}`)
    } else {
      router.push('/')
    }
  }

  if (completion) {
    return (
      <main
        style={{
          padding: 40,
          minHeight: 'calc(100vh - 60px)',
          background: 'oklch(22% 0.03 270 / 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <CompletionPage
          accuracyScore={completion.accuracyScore}
          hasNextTrack={track.nextTrackId !== null}
          onPracticeAgain={handlePracticeAgain}
          onNextTrack={handleNextTrack}
        />
      </main>
    )
  }

  return (
    <main style={{ padding: '20px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-faint)', fontSize: 15, fontWeight: 700 }}>
        <Link href="/" style={breadcrumbLinkStyle}>Exercises</Link>
        <span>/</span>
        <Link href={`/exercises/${track.exerciseId}`} style={breadcrumbLinkStyle}>{track.exerciseTitle}</Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{track.title}</span>
          <button
            onClick={handleToggleFavorite}
            disabled={isTogglingFavorite}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorited}
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorited ? 'var(--primary)' : 'none'} stroke={isFavorited ? 'var(--primary)' : 'var(--ink-faint)'} strokeWidth="2">
              <path d="M12 21s-6.7-4.35-9.3-8.28C1.02 10.4 1.5 6.9 4.3 5.3a5 5 0 0 1 7 1.2 5 5 0 0 1 7-1.2c2.8 1.6 3.28 5.1 1.6 7.42C18.7 16.65 12 21 12 21z" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {track.description && (
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-soft)' }}>{track.description}</span>
          )}
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-soft)' }}>Vocab Level: {track.level}</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-soft)' }}>Speed: {track.wordsPerMinute} wpm</span>
        </div>
      </div>

      {mode === 'sentence' ? (
        <SentencePracticeView
          key={practiceKey}
          track={track}
          audioObjectUrl={audioObjectUrl}
          audioError={audioError}
          onCompleted={() => setCompletion({ accuracyScore: null, mode: 'sentence' })}
          onBack={() => setMode('full')}
        />
      ) : mode === 'full' ? (
        <FullTextView
          key={practiceKey}
          track={track}
          audioObjectUrl={audioObjectUrl}
          audioError={audioError}
          onStartFullDictation={() => setMode('dictation')}
          onStartBySentence={() => setMode('sentence')}
          onStartRecite={() => setMode('recite')}
        />
      ) : mode === 'dictation' ? (
        <FullDictationView
          key={practiceKey}
          track={track}
          audioObjectUrl={audioObjectUrl}
          audioError={audioError}
          onCompleted={(accuracyScore) => setCompletion({ accuracyScore, mode: 'dictation' })}
          onBack={() => setMode('full')}
        />
      ) : (
        <RecitationPanel
          key={practiceKey}
          trackId={track.id}
          sentences={track.sentences}
          onCompleted={(accuracyScore) => setCompletion({ accuracyScore, mode: 'recite' })}
          onBack={() => setMode('full')}
        />
      )}
    </main>
  )
}
