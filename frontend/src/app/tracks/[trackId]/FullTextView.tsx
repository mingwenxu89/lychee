'use client'

import { useEffect, useRef, useState } from 'react'
import { parseTimeSpanToSeconds } from '@/lib/timeSpan'
import type { LearnerTrack } from './page'

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  boxShadow: 'none'
}

const btnPrimary: React.CSSProperties = {
  alignSelf: 'center',
  background: 'var(--primary)',
  color: 'white',
  fontWeight: 800,
  fontSize: 14,
  border: 'none',
  borderRadius: 999,
  padding: '11px 24px',
  boxShadow: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function FullTextView({
  track,
  initialSentenceIndex,
  onStartFullDictation,
  onStartBySentence,
  onStartRecite
}: {
  track: LearnerTrack
  initialSentenceIndex?: number | null
  onStartFullDictation: () => void
  onStartBySentence: () => void
  onStartRecite: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const sentenceRefs = useRef<(HTMLLIElement | null)[]>([])
  const [showText, setShowText] = useState(false)
  const [speed, setSpeed] = useState('1')
  const [activeIndex, setActiveIndex] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [favoritedSentenceIds, setFavoritedSentenceIds] = useState(
    () => new Set(track.sentences.filter((s) => s.isFavorited).map((s) => s.id))
  )

  useEffect(() => {
    if (showText) sentenceRefs.current[activeIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex, showText])

  // Arriving from a favorited-sentence link: jump the audio to that sentence's position and
  // reveal the text so it's visible in context, without forcing playback to start.
  useEffect(() => {
    if (initialSentenceIndex === null || initialSentenceIndex === undefined) return
    const position = track.sentences.findIndex((s) => s.index === initialSentenceIndex)
    if (position === -1 || !audioRef.current) return
    audioRef.current.currentTime = parseTimeSpanToSeconds(track.sentences[position].startTime)
    setActiveIndex(position)
    setShowText(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleToggleSentenceFavorite(sentenceId: string) {
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

  function handleSpeedChange(value: string) {
    setSpeed(value)
    if (audioRef.current) audioRef.current.playbackRate = Number(value)
  }

  function handlePlayPauseClick() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play()
    } else {
      audio.pause()
    }
  }

  // Space toggles play/pause, unless focus is on a form control (the speed select, or the
  // recitation textarea when that panel is open) where a space must keep its native meaning.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== ' ') return
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      handlePlayPauseClick()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleTimeUpdate() {
    if (!audioRef.current) return
    const time = audioRef.current.currentTime
    setCurrentTime(time)
    const index = track.sentences.findIndex(
      (s) => time >= parseTimeSpanToSeconds(s.startTime) && time < parseTimeSpanToSeconds(s.endTime)
    )
    if (index >= 0) setActiveIndex(index)
  }

  function seekTo(index: number) {
    if (!audioRef.current) return
    audioRef.current.currentTime = parseTimeSpanToSeconds(track.sentences[index].startTime)
    audioRef.current.play()
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820, width: '100%' }}>
      <audio
        ref={audioRef}
        src={track.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      <div style={{ ...cardStyle, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
          <button
            onClick={handlePlayPauseClick}
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
              cursor: 'pointer'
            }}
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 22 }}>
            <div style={{ height: 8, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--ink-faint)' }}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <select
            aria-label="Speed"
            value={speed}
            onChange={(e) => handleSpeedChange(e.target.value)}
            style={{
              alignSelf: 'center',
              background: 'oklch(96% 0.01 80)',
              borderRadius: 999,
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: 13,
              color: 'var(--ink-soft)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>
          <button onClick={onStartFullDictation} style={btnPrimary}>
            Full Dictation
          </button>
          <button onClick={onStartBySentence} style={btnPrimary}>
            Sentence Dictation
          </button>
          <button onClick={onStartRecite} style={btnPrimary}>
            Recite
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 14, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 520, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px 12px' }}>
          <button
            onClick={() => setShowText(!showText)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--ink)',
              fontWeight: 800,
              fontSize: 13,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {showText ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /><line x1="3" y1="21" x2="21" y2="3" /></svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
            {showText ? 'Hide Text' : 'Show Text'}
          </button>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600 }}>
            Tap the play icon at the end of a sentence to jump there.
          </span>
        </div>

        {showText && (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto' }}>
            {track.sentences.map((s, i) => {
              const isDone = i < activeIndex
              const isActive = i === activeIndex
              return (
                <li
                  key={s.id}
                  ref={(el) => { sentenceRefs.current[i] = el }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: isActive ? 'var(--primary-soft)' : 'transparent'
                  }}
                >
                  {/* lineHeight is set in px, matching the sentence text's own line-box height
                      (17px * 1.6) exactly, rather than a ratio — the number is smaller (13px) but
                      needs the same line-box height to vertically center against the text's
                      first line instead of drifting toward the top of a multi-line sentence. */}
                  <span style={{ fontWeight: 800, fontSize: 13, lineHeight: '27.2px', width: 22, flexShrink: 0, color: isActive ? 'var(--ink)' : 'var(--ink-faint)' }}>
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: isActive ? 500 : 400,
                      lineHeight: 1.6,
                      color: isActive ? 'var(--ink)' : isDone ? 'var(--ink-soft)' : 'var(--ink-faint)'
                    }}
                  >
                    {s.text}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleSentenceFavorite(s.id) }}
                    aria-label={favoritedSentenceIds.has(s.id) ? `Remove sentence ${i + 1} from favorites` : `Add sentence ${i + 1} to favorites`}
                    aria-pressed={favoritedSentenceIds.has(s.id)}
                    style={{
                      marginLeft: 'auto',
                      flexShrink: 0,
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={favoritedSentenceIds.has(s.id) ? 'var(--primary)' : 'none'} stroke={favoritedSentenceIds.has(s.id) ? 'var(--primary)' : 'var(--ink-faint)'} strokeWidth="2">
                      <path d="M12 21s-6.7-4.35-9.3-8.28C1.02 10.4 1.5 6.9 4.3 5.3a5 5 0 0 1 7 1.2 5 5 0 0 1 7-1.2c2.8 1.6 3.28 5.1 1.6 7.42C18.7 16.65 12 21 12 21z" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); seekTo(i) }}
                    aria-label={`Play sentence ${i + 1}`}
                    style={{
                      flexShrink: 0,
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary)"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                </li>
              )
            })}
          </ol>
        )}

        {showText && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to bottom, transparent, var(--surface))', pointerEvents: 'none' }} />
        )}
      </div>
    </div>
  )
}
