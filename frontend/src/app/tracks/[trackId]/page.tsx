'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { SentencePracticeView } from './SentencePracticeView'
import { FullTextView } from './FullTextView'
import { CompletionPage } from './CompletionPage'

export type LearnerSentence = { id: string; index: number; text: string; startTime: string; endTime: string }
export type LearnerTrack = {
  id: string
  unitId: string
  exerciseId: string
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
  if (!track) return <main style={{ padding: 40 }}>Loading...</main>

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
      <main style={{ padding: 40 }}>
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
    <main style={{ padding: 40 }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <button
          aria-current={mode === 'sentence' ? 'page' : undefined}
          onClick={() => setMode('sentence')}
          style={{ fontWeight: mode === 'sentence' ? 800 : 400 }}
        >
          Sentence
        </button>
        <button
          aria-current={mode === 'full' ? 'page' : undefined}
          onClick={() => setMode('full')}
          style={{ fontWeight: mode === 'full' ? 800 : 400 }}
        >
          Full Text
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
