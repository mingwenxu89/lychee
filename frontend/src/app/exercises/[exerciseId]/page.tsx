'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Track = {
  id: string
  title: string
  description: string | null
  level: string
  duration: string
  sentenceCount: number
  wordsPerMinute: number
  isCompletedByUser: boolean
}
type Unit = { id: string; title: string; order: number; tracks: Track[] }
type ExerciseDetail = { id: string; title: string; description: string | null; category: string; units: Unit[] }

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1px solid var(--line)',
  overflow: 'hidden'
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-faint)"
      strokeWidth="2.5"
      style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const [detail, setDetail] = useState<ExerciseDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/learner/exercises/${exerciseId}`)
      if (!response.ok) {
        setError('Failed to load this exercise.')
        return
      }
      const data: ExerciseDetail = await response.json()
      setDetail(data)
      setExpandedUnitIds(new Set(data.units.length > 0 ? [data.units[0].id] : []))
    }
    load()
  }, [exerciseId])

  function toggleUnit(unitId: string) {
    setExpandedUnitIds((current) => {
      const next = new Set(current)
      if (next.has(unitId)) {
        next.delete(unitId)
      } else {
        next.add(unitId)
      }
      return next
    })
  }

  if (error) return <main style={{ padding: 40 }}>{error}</main>
  if (!detail) return <main style={{ padding: 40, color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</main>

  return (
    <main style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700 }}>
        <Link href="/" style={{ color: 'oklch(55% 0.2 250)', textDecoration: 'none' }}>Home</Link>
        <span style={{ color: 'var(--ink-faint)' }}>/</span>
        <span style={{ color: 'var(--ink-soft)' }}>{detail.title}</span>
      </div>

      {detail.units.map((unit) => {
        const isExpanded = expandedUnitIds.has(unit.id)
        const completedCount = unit.tracks.filter((t) => t.isCompletedByUser).length

        return (
          <div key={unit.id} style={cardStyle}>
            <button
              type="button"
              onClick={() => toggleUnit(unit.id)}
              aria-expanded={isExpanded}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ChevronIcon expanded={isExpanded} />
                <span style={{ fontWeight: 700, fontSize: 16 }}>{unit.title}</span>
              </div>
              <span style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999 }}>
                {completedCount} / {unit.tracks.length} completed
              </span>
            </button>

            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--line)', padding: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {unit.tracks.map((track) => (
                  <Link
                    key={track.id}
                    href={`/tracks/${track.id}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: track.isCompletedByUser ? '1px solid oklch(80% 0.08 20)' : '1px solid var(--line)',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: track.isCompletedByUser ? 'oklch(95% 0.04 20)' : 'var(--surface)',
                      minWidth: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{track.title}</div>
                      <span style={{ flexShrink: 0, color: 'var(--ink-faint)', fontSize: 12, fontWeight: 700 }}>{track.level}</span>
                    </div>
                    {track.description && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{track.description}</div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                      {track.sentenceCount} sentences &middot; {track.wordsPerMinute} wpm
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </main>
  )
}
