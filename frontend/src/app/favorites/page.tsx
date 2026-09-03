'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { parseTimeSpanToSeconds } from '@/lib/timeSpan'

type FavoriteTrack = {
  id: string
  title: string
  description: string | null
  exerciseId: string
  exerciseTitle: string
  level: string
  duration: string
  sentenceCount: number
  favoritedAt: string
}

type FavoriteSentence = {
  id: string
  index: number
  text: string
  startTime: string
  endTime: string
  trackId: string
  trackTitle: string
  exerciseTitle: string
  audioUrl: string
  favoritedAt: string
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 18,
  padding: '18px 20px',
  border: '2px solid var(--line)',
  display: 'flex',
  alignItems: 'center',
  gap: 16
}

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'var(--primary)' : 'none'} stroke={filled ? 'var(--primary)' : 'var(--ink-faint)'} strokeWidth="2">
      <path d="M12 21s-6.7-4.35-9.3-8.28C1.02 10.4 1.5 6.9 4.3 5.3a5 5 0 0 1 7 1.2 5 5 0 0 1 7-1.2c2.8 1.6 3.28 5.1 1.6 7.42C18.7 16.65 12 21 12 21z" strokeLinejoin="round" />
    </svg>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function FavoritesPage() {
  const [tab, setTab] = useState<'tracks' | 'sentences'>('tracks')
  const [tracks, setTracks] = useState<FavoriteTrack[] | null>(null)
  const [sentences, setSentences] = useState<FavoriteSentence[] | null>(null)
  const [playingSentenceId, setPlayingSentenceId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const playingSentenceRef = useRef<FavoriteSentence | null>(null)

  useEffect(() => {
    async function load() {
      const [tracksResponse, sentencesResponse] = await Promise.all([
        fetch('/api/learner/favorites/tracks'),
        fetch('/api/learner/favorites/sentences')
      ])
      if (tracksResponse.ok) setTracks(await tracksResponse.json())
      if (sentencesResponse.ok) setSentences(await sentencesResponse.json())
    }
    load()
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    function onTimeUpdate() {
      const sentence = playingSentenceRef.current
      if (!sentence || !audio) return
      if (audio.currentTime >= parseTimeSpanToSeconds(sentence.endTime)) {
        audio.pause()
      }
    }
    function onPause() {
      setPlayingSentenceId(null)
      playingSentenceRef.current = null
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  async function handlePlaySentence(sentence: FavoriteSentence) {
    const audio = audioRef.current
    if (!audio) return
    if (playingSentenceId === sentence.id) {
      audio.pause()
      return
    }
    if (audio.src !== sentence.audioUrl) {
      audio.src = sentence.audioUrl
    }
    audio.currentTime = parseTimeSpanToSeconds(sentence.startTime)
    playingSentenceRef.current = sentence
    setPlayingSentenceId(sentence.id)
    await audio.play()
  }

  async function handleUnfavoriteTrack(trackId: string) {
    setTracks((current) => (current ? current.filter((t) => t.id !== trackId) : current))
    await fetch(`/api/learner/tracks/${trackId}/favorite`, { method: 'DELETE' })
  }

  async function handleUnfavoriteSentence(sentenceId: string) {
    setSentences((current) => (current ? current.filter((s) => s.id !== sentenceId) : current))
    await fetch(`/api/learner/sentences/${sentenceId}/favorite`, { method: 'DELETE' })
  }

  return (
    <main style={{ padding: '20px 40px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820, margin: '0 auto' }}>
      <audio ref={audioRef} />
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Favorites</h1>

      <div style={{ display: 'flex', gap: 6, background: 'oklch(90% 0.012 80)', padding: 6, borderRadius: 999, width: 'fit-content' }}>
        <button
          aria-current={tab === 'tracks' ? 'page' : undefined}
          onClick={() => setTab('tracks')}
          style={{
            border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 14, padding: '9px 22px', cursor: 'pointer',
            background: tab === 'tracks' ? 'var(--primary)' : 'transparent',
            color: tab === 'tracks' ? 'white' : 'var(--ink-soft)'
          }}
        >
          Tracks
        </button>
        <button
          aria-current={tab === 'sentences' ? 'page' : undefined}
          onClick={() => setTab('sentences')}
          style={{
            border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 14, padding: '9px 22px', cursor: 'pointer',
            background: tab === 'sentences' ? 'var(--primary)' : 'transparent',
            color: tab === 'sentences' ? 'white' : 'var(--ink-soft)'
          }}
        >
          Sentences
        </button>
      </div>

      {tab === 'tracks' ? (
        !tracks ? (
          <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</span>
        ) : tracks.length === 0 ? (
          <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>No favorited tracks yet.</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tracks.map((track) => (
              <div key={track.id} style={cardStyle}>
                <Link href={`/tracks/${track.id}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{track.title}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600 }}>
                    {track.exerciseTitle} · {track.level} · {track.sentenceCount} sentences
                  </span>
                </Link>
                <button
                  onClick={() => handleUnfavoriteTrack(track.id)}
                  aria-label={`Remove ${track.title} from favorites`}
                  style={iconButtonStyle}
                >
                  <HeartIcon filled />
                </button>
              </div>
            ))}
          </div>
        )
      ) : !sentences ? (
        <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</span>
      ) : sentences.length === 0 ? (
        <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>No favorited sentences yet.</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sentences.map((sentence) => (
            <div key={sentence.id} style={cardStyle}>
              <button
                onClick={() => handlePlaySentence(sentence)}
                aria-label={playingSentenceId === sentence.id ? `Pause sentence` : `Play sentence: ${sentence.text}`}
                style={{
                  ...iconButtonStyle,
                  width: 40, height: 40, borderRadius: 999, background: 'var(--primary)'
                }}
              >
                {playingSentenceId === sentence.id ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              <Link
                href={`/tracks/${sentence.trackId}?mode=full&sentence=${sentence.index}`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none', color: 'inherit', minWidth: 0 }}
              >
                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.5 }}>{sentence.text}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600 }}>
                  {sentence.exerciseTitle} · {sentence.trackTitle} · {formatTime(parseTimeSpanToSeconds(sentence.startTime))}
                </span>
              </Link>
              <button
                onClick={() => handleUnfavoriteSentence(sentence.id)}
                aria-label="Remove sentence from favorites"
                style={iconButtonStyle}
              >
                <HeartIcon filled />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
