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
  audioObjectUrl,
  audioError,
  onStartFullDictation,
  onStartBySentence,
  onStartRecite
}: {
  track: LearnerTrack
  audioObjectUrl: string | null
  audioError: string | null
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

  useEffect(() => {
    if (showText) sentenceRefs.current[activeIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex, showText])

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

  // Gates playback the same way SentencePracticeView/FullDictationView gate theirs — the audio
  // element has no src at all until the track's full audio finishes downloading at the page
  // level (see page.tsx), so calling .play() before then would throw.
  const isReady = audioObjectUrl !== null

  function handlePlayPauseClick() {
    const audio = audioRef.current
    if (!audio || !isReady) return
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
    if (!audioRef.current || !isReady) return
    audioRef.current.currentTime = parseTimeSpanToSeconds(track.sentences[index].startTime)
    audioRef.current.play()
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820, width: '100%' }}>
      <audio
        ref={audioRef}
        src={audioObjectUrl ?? undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      {audioError && <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0 }}>{audioError}</p>}
      {!isReady && !audioError && <p style={{ color: 'var(--ink-soft)', fontWeight: 700, margin: 0 }}>Loading audio...</p>}

      <div style={{ ...cardStyle, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
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
          {/* Full Dictation's entry button is disabled — the mode didn't work well in practice.
              Left commented out (not deleted) rather than removed, along with everything that
              powers it (FullDictationView, the 'dictation' mode branch in page.tsx, etc.), in
              case it's revisited later. */}
          {/* <button onClick={onStartFullDictation} style={btnPrimary}>
            Full Dictation
          </button> */}
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
                  onClick={() => seekTo(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: isActive ? 'var(--primary-soft)' : 'transparent',
                    cursor: 'pointer'
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
                    onClick={(e) => { e.stopPropagation(); seekTo(i) }}
                    aria-label={`Play sentence ${i + 1}`}
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary)"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
