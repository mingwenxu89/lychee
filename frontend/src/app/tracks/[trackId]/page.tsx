'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { SentencePracticeView } from './SentencePracticeView'
import { FullTextView } from './FullTextView'
import { CompletionPage } from './CompletionPage'

export type LearnerSentence = { id: string; index: number; text: string; startTime: string; endTime: string }
export type LearnerTrack = {
  id: string
  unitId: string
  exerciseId: string
  title: string
  exerciseTitle: string
  level: string
  duration: string
  audioUrl: string
  sentences: LearnerSentence[]
  nextTrackId: string | null
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

  const [track, setTrack] = useState<LearnerTrack | null>(null)
  const [mode, setMode] = useState<'sentence' | 'full'>(initialMode)
  const [error, setError] = useState<string | null>(null)
  const [completion, setCompletion] = useState<{ accuracyScore: number; mode: 'sentence' | 'full' } | null>(null)
  const [practiceKey, setPracticeKey] = useState(0)
  const [jumpToSentenceIndex, setJumpToSentenceIndex] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/learner/tracks/${trackId}`)
      if (!response.ok) {
        setError('Failed to load this track.')
        return
      }
      setTrack(await response.json())
    }
    load()
  }, [trackId])

  if (error) return <main style={{ padding: 40 }}>{error}</main>
  if (!track) return <main style={{ padding: 40, color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</main>

  function handlePracticeAgain() {
    setCompletion(null)
    setJumpToSentenceIndex(null)
    setPracticeKey((k) => k + 1)
  }

  function handleNextTrack() {
    if (track!.nextTrackId) {
      router.push(`/tracks/${track!.nextTrackId}?mode=${completion?.mode ?? 'sentence'}`)
    } else {
      router.push('/')
    }
  }

  function handleEnterSentenceMode(index: number) {
    setJumpToSentenceIndex(index)
    setMode('sentence')
  }

  if (completion) {
    return (
      <main
        style={{
          padding: 40,
          minHeight: 'calc(100vh - 76px)',
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
    <main style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-faint)', fontSize: 15, fontWeight: 700 }}>
        <Link href="/" style={{ color: 'oklch(55% 0.2 250)', textDecoration: 'none' }}>Home</Link>
        <span>/</span>
        <Link href={`/exercises/${track.exerciseId}`} style={{ color: 'oklch(55% 0.2 250)', textDecoration: 'none' }}>{track.exerciseTitle}</Link>
        <span>/</span>
        <span style={{ color: 'var(--ink-soft)' }}>{track.title}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, background: 'oklch(96% 0.01 80)', padding: 6, borderRadius: 999, width: 'fit-content' }}>
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

      {mode === 'sentence' ? (
        <SentencePracticeView
          key={practiceKey}
          track={track}
          initialSentenceIndex={jumpToSentenceIndex}
          onCompleted={(accuracyScore) => setCompletion({ accuracyScore, mode: 'sentence' })}
        />
      ) : (
        <FullTextView
          key={practiceKey}
          track={track}
          onEnterSentenceMode={handleEnterSentenceMode}
          onRecitationCompleted={(accuracyScore) => setCompletion({ accuracyScore, mode: 'full' })}
        />
      )}
    </main>
  )
}
