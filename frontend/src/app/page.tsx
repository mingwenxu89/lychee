'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Exercise = {
  id: string
  title: string
  difficultyRangeLabel: string | null
  trackCount: number
  completedTrackCount: number
  lastPracticedAt: string | null
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  boxShadow: 'none'
}

const ACCENT_COLORS: { bg: string; fg: string }[] = [
  { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  { bg: 'var(--violet-soft)', fg: 'var(--violet)' },
  { bg: 'var(--gold-soft)', fg: 'oklch(60% 0.13 75)' }
]

function accentForIndex(index: number): { bg: string; fg: string } {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

function ExerciseCard({ exercise, accent }: { exercise: Exercise; accent: { bg: string; fg: string } }) {
  const progress = exercise.trackCount > 0 ? (exercise.completedTrackCount / exercise.trackCount) * 100 : 0
  return (
    <Link href={`/exercises/${exercise.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ ...cardStyle, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: '100%', height: 120, borderRadius: 16, background: accent.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={accent.fg} strokeWidth="1.6">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{exercise.title}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {exercise.difficultyRangeLabel && (
              <span style={{ borderRadius: 999, padding: '4px 12px', fontWeight: 800, fontSize: 12, background: accent.bg, color: accent.fg }}>
                {exercise.difficultyRangeLabel}
              </span>
            )}
            <span style={{ color: 'var(--ink-faint)', fontSize: 13, fontWeight: 700 }}>{exercise.trackCount} lessons</span>
          </div>
        </div>
        <div style={{ height: 8, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)' }} />
        </div>
      </div>
    </Link>
  )
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/learner/exercises')
      if (!response.ok) {
        setError('Failed to load exercises.')
        return
      }
      setExercises(await response.json())
    }
    load()
  }, [])

  useEffect(() => {
    async function loadMe() {
      const response = await fetch('/api/auth/me')
      if (!response.ok) return
      const me: { roles?: string[] } = await response.json()
      setIsAdmin(Array.isArray(me.roles) && me.roles.includes('Admin'))
    }
    loadMe()
  }, [])

  const filtered = useMemo(() => {
    if (!exercises) return []
    return exercises.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
  }, [exercises, search])

  const recentExercises = useMemo(() => {
    if (!exercises) return []
    return exercises
      .filter((e): e is Exercise & { lastPracticedAt: string } => e.lastPracticedAt !== null)
      .sort((a, b) => new Date(b.lastPracticedAt).getTime() - new Date(a.lastPracticedAt).getTime())
      .slice(0, 5)
  }, [exercises])

  if (error) return <main style={{ padding: 40 }}>{error}</main>
  if (!exercises) return <main style={{ padding: 40, color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</main>

  return (
    <main style={{ padding: '20px 40px', display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>All Exercises</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <Link
              href="/admin/exercises"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                background: 'transparent', border: '2px solid var(--line)', color: 'var(--ink-soft)',
                fontWeight: 800, fontSize: 14, borderRadius: 999, padding: '10px 18px', whiteSpace: 'nowrap'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Admin
            </Link>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '2px solid var(--line)', borderRadius: 999, padding: '10px 18px', width: 260 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 600, fontSize: 14, width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            borderRadius: 999, padding: '10px 20px', fontWeight: 800, fontSize: 14,
            background: 'var(--primary)', color: 'white'
          }}
        >
          All
        </span>
        {recentExercises.length > 0 && (
          <>
            <span style={{ color: 'var(--line)', fontSize: 14 }}>|</span>
            <span data-testid="recent-exercises" style={{ display: 'contents' }}>
            {recentExercises.map((exercise) => (
              <Link
                key={exercise.id}
                href={`/exercises/${exercise.id}`}
                title={exercise.title}
                style={{
                  borderRadius: 999, padding: '10px 20px', fontWeight: 800, fontSize: 14,
                  background: 'var(--surface)', color: 'var(--ink-soft)', border: '2px solid var(--line)',
                  textDecoration: 'none', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}
              >
                {exercise.title}
              </Link>
            ))}
            </span>
          </>
        )}
      </div>

      <div data-testid="exercise-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
        {filtered.map((exercise, index) => (
          <ExerciseCard key={exercise.id} exercise={exercise} accent={accentForIndex(index)} />
        ))}
      </div>
    </main>
  )
}
