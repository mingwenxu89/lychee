'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { breadcrumbLinkStyle } from '@/lib/breadcrumbLinkStyle'
import { SentencePracticeView } from './SentencePracticeView'
import { FullTextView } from './FullTextView'
import { CompletionPage } from './CompletionPage'

export type LearnerSentence = { id: string; index: number; text: string; startTime: string; endTime: string; isFavorited: boolean }
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
  const initialMode = searchParams.get('mode') === 'full' ? 'full' : 'sentence'
  const initialSentenceParam = searchParams.get('sentence')
  const initialSentenceIndex = initialSentenceParam !== null ? Number(initialSentenceParam) : null

  const [track, setTrack] = useState<LearnerTrack | null>(null)
  const [mode, setMode] = useState<'sentence' | 'full'>(initialMode)
  const [error, setError] = useState<string | null>(null)
  const [completion, setCompletion] = useState<{ accuracyScore: number; mode: 'sentence' | 'full' } | null>(null)
  const [practiceKey, setPracticeKey] = useState(0)
  const [isFavorited, setIsFavorited] = useState(false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)

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
      router.push(`/tracks/${track!.nextTrackId}?mode=${completion?.mode ?? 'sentence'}`)
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
        <span>/</span>
        <span style={{ color: 'var(--ink-soft)' }}>{track.title}</span>
        <button
          onClick={handleToggleFavorite}
          disabled={isTogglingFavorite}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFavorited}
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isFavorited ? 'var(--primary)' : 'none'} stroke={isFavorited ? 'var(--primary)' : 'var(--ink-faint)'} strokeWidth="2">
            <path d="M12 21s-6.7-4.35-9.3-8.28C1.02 10.4 1.5 6.9 4.3 5.3a5 5 0 0 1 7 1.2 5 5 0 0 1 7-1.2c2.8 1.6 3.28 5.1 1.6 7.42C18.7 16.65 12 21 12 21z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, background: 'oklch(90% 0.012 80)', padding: 6, borderRadius: 999, width: 'fit-content' }}>
          <button
            aria-current={mode === 'sentence' ? 'page' : undefined}
            onClick={() => setMode('sentence')}
            style={{
              border: 'none',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 14,
              padding: '9px 22px',
              cursor: 'pointer',
              background: mode === 'sentence' ? 'var(--primary)' : 'transparent',
              color: mode === 'sentence' ? 'white' : 'var(--ink-soft)'
            }}
          >
            By Sentence
          </button>
          <button
            aria-current={mode === 'full' ? 'page' : undefined}
            onClick={() => setMode('full')}
            style={{
              border: 'none',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 14,
              padding: '9px 22px',
              cursor: 'pointer',
              background: mode === 'full' ? 'var(--primary)' : 'transparent',
              color: mode === 'full' ? 'white' : 'var(--ink-soft)'
            }}
          >
            Full Listen
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
          onCompleted={(accuracyScore) => setCompletion({ accuracyScore, mode: 'sentence' })}
        />
      ) : (
        <FullTextView
          key={practiceKey}
          track={track}
          initialSentenceIndex={initialSentenceIndex}
          onRecitationCompleted={(accuracyScore) => setCompletion({ accuracyScore, mode: 'full' })}
        />
      )}
    </main>
  )
}
