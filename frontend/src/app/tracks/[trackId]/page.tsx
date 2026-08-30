'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { SentencePracticeView } from './SentencePracticeView'

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
  const initialMode = searchParams.get('mode') === 'full' ? 'full' : 'sentence'

  const [track, setTrack] = useState<LearnerTrack | null>(null)
  const [mode, setMode] = useState<'sentence' | 'full'>(initialMode)
  const [error, setError] = useState<string | null>(null)

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
          track={track}
          initialSentenceIndex={null}
          onCompleted={() => {}}
        />
      ) : (
        <p>Full text mode coming soon.</p>
      )}
    </main>
  )
}
