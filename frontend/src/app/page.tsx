'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Exercise = {
  id: string
  title: string
  category: string
  difficultyRangeLabel: string | null
  trackCount: number
  completedTrackCount: number
  lastPracticedAt: string | null
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  boxShadow: '0 10px 0 var(--line), 0 14px 28px oklch(22% 0.03 270 / 0.07)'
}

const CATEGORY_COLORS: { bg: string; fg: string }[] = [
  { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  { bg: 'var(--violet-soft)', fg: 'var(--violet)' },
  { bg: 'var(--gold-soft)', fg: 'oklch(60% 0.13 75)' }
]

function colorForCategory(category: string, allCategories: string[]): { bg: string; fg: string } {
  const index = allCategories.indexOf(category)
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
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
  const [activeCategory, setActiveCategory] = useState('All')

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

  const categories = useMemo(() => {
    if (!exercises) return []
    return Array.from(new Set(exercises.map((e) => e.category)))
  }, [exercises])

  const filtered = useMemo(() => {
    if (!exercises) return []
    return exercises.filter((e) => {
      const matchesCategory = activeCategory === 'All' || e.category === activeCategory
      const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [exercises, activeCategory, search])

  if (error) return <main style={{ padding: 40 }}>{error}</main>
  if (!exercises) return <main style={{ padding: 40, color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</main>

  return (
    <main style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>All Exercises</h1>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveCategory('All')}
          style={{
            borderRadius: 999, padding: '10px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer', border: 'none',
            background: activeCategory === 'All' ? 'var(--primary)' : 'var(--surface)',
            color: activeCategory === 'All' ? 'white' : 'var(--ink-soft)',
            ...(activeCategory !== 'All' ? { border: '2px solid var(--line)' } : {})
          }}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            style={{
              borderRadius: 999, padding: '10px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer', border: 'none',
              background: activeCategory === category ? 'var(--primary)' : 'var(--surface)',
              color: activeCategory === category ? 'white' : 'var(--ink-soft)',
              ...(activeCategory !== category ? { border: '2px solid var(--line)' } : {})
            }}
          >
            {category}
          </button>
        ))}
      </div>

      <div data-testid="exercise-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
        {filtered.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} accent={colorForCategory(exercise.category, categories)} />
        ))}
      </div>
    </main>
  )
}
