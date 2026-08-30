'use client'

import { useEffect, useRef, useState } from 'react'
import { parseTimeSpanToSeconds } from '@/lib/timeSpan'
import type { LearnerTrack } from './page'

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

  useEffect(() => {
    sentenceRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  function handleSpeedChange(value: string) {
    setSpeed(value)
    if (audioRef.current) audioRef.current.playbackRate = Number(value)
  }

  function handleTimeUpdate() {
    if (!audioRef.current) return
    const currentTime = audioRef.current.currentTime
    const index = track.sentences.findIndex(
      (s) => currentTime >= parseTimeSpanToSeconds(s.startTime) && currentTime < parseTimeSpanToSeconds(s.endTime)
    )
    if (index >= 0) setActiveIndex(index)
  }

  function seekTo(index: number) {
    if (!audioRef.current) return
    audioRef.current.currentTime = parseTimeSpanToSeconds(track.sentences[index].startTime)
    audioRef.current.play()
  }

  return (
    <div>
      <audio ref={audioRef} src={track.audioUrl} onTimeUpdate={handleTimeUpdate} />
      <button onClick={() => audioRef.current?.play()}>Play</button>
      <button onClick={() => audioRef.current?.pause()}>Pause</button>

      <label>
        Speed
        <select aria-label="Speed" value={speed} onChange={(e) => handleSpeedChange(e.target.value)}>
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="1">1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
        </select>
      </label>

      {!showText && <button onClick={() => setShowText(true)}>Show Text</button>}

      {showText && (
        <ol>
          {track.sentences.map((s, i) => (
            <li
              key={s.id}
              ref={(el) => { sentenceRefs.current[i] = el }}
              style={{ fontWeight: i === activeIndex ? 800 : 400 }}
            >
              <button onClick={() => seekTo(i)}>▶</button>
              <span onClick={() => onEnterSentenceMode(i)} style={{ cursor: 'pointer' }}>{s.text}</span>
            </li>
          ))}
        </ol>
      )}

      <button onClick={() => setShowRecitation(true)}>Recite Full Text</button>

      {showRecitation && (
        <div>
          <button onClick={() => setShowRecitation(false)}>Close</button>
          <button aria-label="start recording">Start Recording</button>
        </div>
      )}
    </div>
  )
}
