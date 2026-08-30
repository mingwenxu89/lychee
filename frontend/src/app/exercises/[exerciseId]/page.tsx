'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Track = { id: string; title: string; level: string; duration: string; isCompletedByUser: boolean }
type Unit = { id: string; title: string; order: number; tracks: Track[] }
type ExerciseDetail = { id: string; title: string; description: string | null; category: string; units: Unit[] }

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  boxShadow: '0 10px 0 var(--line), 0 14px 28px oklch(22% 0.03 270 / 0.07)'
}

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const [detail, setDetail] = useState<ExerciseDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/learner/exercises/${exerciseId}`)
      if (!response.ok) {
        setError('Failed to load this exercise.')
        return
      }
      setDetail(await response.json())
    }
    load()
  }, [exerciseId])

  if (error) return <main style={{ padding: 40 }}>{error}</main>
  if (!detail) return <main style={{ padding: 40, color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</main>

  return (
    <main style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>{detail.title}</h1>
        {detail.description && <p style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>{detail.description}</p>}
      </div>

      {detail.units.map((unit) => (
        <div key={unit.id} style={{ ...cardStyle, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{unit.title}</h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unit.tracks.map((track) => (
              <li key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
                {track.isCompletedByUser && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--leaf-dark)" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                )}
                <Link href={`/tracks/${track.id}`} style={{ color: 'var(--ink)', fontWeight: 700, textDecoration: 'none', flex: 1 }}>
                  {track.title}
                </Link>
                <span style={{ color: 'var(--ink-faint)', fontSize: 13, fontWeight: 700 }}>{track.level}</span>
                {track.isCompletedByUser && <span style={{ color: 'var(--leaf-dark)', fontSize: 12, fontWeight: 800 }}>Completed</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </main>
  )
}
