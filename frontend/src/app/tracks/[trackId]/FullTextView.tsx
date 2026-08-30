'use client'

import { useEffect, useRef, useState } from 'react'
import { parseTimeSpanToSeconds } from '@/lib/timeSpan'
import type { LearnerTrack } from './page'
import { RecitationPanel } from './RecitationPanel'

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  boxShadow: '0 10px 0 var(--line), 0 14px 28px oklch(22% 0.03 270 / 0.07)'
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
  onEnterSentenceMode,
  onRecitationCompleted
}: {
  track: LearnerTrack
  onEnterSentenceMode: (index: number) => void
  onRecitationCompleted: (accuracyScore: number) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const sentenceRefs = useRef<(HTMLLIElement | null)[]>([])
  const [showText, setShowText] = useState(false)
  const [speed, setSpeed] = useState('1')
  const [activeIndex, setActiveIndex] = useState(0)
  const [showRecitation, setShowRecitation] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (showText) sentenceRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex, showText])

  function handleSpeedChange(value: string) {
    setSpeed(value)
    if (audioRef.current) audioRef.current.playbackRate = Number(value)
  }

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

      <div style={{ ...cardStyle, padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button
            onClick={() => audioRef.current?.play()}
            aria-label="Play"
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: 'var(--primary)',
              boxShadow: '0 4px 0 var(--primary-dark)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <button
            onClick={() => audioRef.current?.pause()}
            style={{
              background: 'transparent',
              border: '2px solid var(--line)',
              borderRadius: 999,
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--ink-soft)"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <button
            onClick={() => setShowRecitation(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--primary)',
              color: 'white',
              fontWeight: 800,
              fontSize: 14,
              border: 'none',
              borderRadius: 999,
              padding: '11px 20px',
              boxShadow: '0 4px 0 var(--primary-dark)',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /></svg>
            Recite Full Text
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 520, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px 12px' }}>
          <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink-faint)' }}>Synced Text</span>
          {!showText && (
            <button
              onClick={() => setShowText(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--primary-dark)',
                fontWeight: 800,
                fontSize: 13,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--primary-dark)" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
              Show Text
            </button>
          )}
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
                  <span style={{ fontWeight: 800, fontSize: 13, width: 22, flexShrink: 0, paddingTop: 2, color: isActive ? 'var(--primary)' : 'var(--ink-faint)' }}>
                    {i + 1}
                  </span>
                  <span
                    onClick={() => onEnterSentenceMode(i)}
                    style={{
                      fontSize: 17,
                      fontWeight: isActive ? 800 : 600,
                      lineHeight: 1.6,
                      cursor: 'pointer',
                      color: isActive ? 'var(--primary-dark)' : isDone ? 'var(--ink-soft)' : 'var(--ink-faint)'
                    }}
                  >
                    {s.text}
                  </span>
                  {isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); seekTo(i) }}
                      aria-label={`Play sentence ${i + 1}`}
                      style={{ marginLeft: 'auto', flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="var(--primary)"><path d="M8 5v14l11-7z" /></svg>
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        {showText && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to bottom, transparent, var(--surface))', pointerEvents: 'none' }} />
        )}
      </div>

      <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600, textAlign: 'center' }}>
        Text is hidden by default — tap &quot;Show Text&quot; to auto-scroll and highlight the current sentence as it plays. Tap any sentence to jump there or start per-sentence practice.
      </span>

      {showRecitation && (
        <RecitationPanel
          trackId={track.id}
          onCompleted={onRecitationCompleted}
          onClose={() => setShowRecitation(false)}
        />
      )}
    </div>
  )
}
