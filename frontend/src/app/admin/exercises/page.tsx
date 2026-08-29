'use client'

import { useEffect, useState } from 'react'

type Exercise = {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  category: string
  isPublished: boolean
}

export default function ExercisesAdminPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function loadExercises() {
    const response = await fetch('/api/admin/exercises')
    if (response.ok) {
      setExercises(await response.json())
    }
  }

  useEffect(() => {
    loadExercises()
  }, [])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const response = await fetch('/api/admin/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: null, coverImageUrl: null, category })
    })
    if (!response.ok) {
      setError('Failed to create exercise')
      return
    }
    setTitle('')
    setCategory('')
    await loadExercises()
  }

  async function togglePublish(exercise: Exercise) {
    await fetch(`/api/admin/exercises/${exercise.id}/publish-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !exercise.isPublished })
    })
    await loadExercises()
  }

  return (
    <main>
      <h1>Exercises</h1>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input required placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <button type="submit">Create Exercise</button>
      </form>
      {error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}

      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exercises.map((exercise) => (
          <li key={exercise.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href={`/admin/exercises/${exercise.id}`}>{exercise.title}</a>
            <span>{exercise.category}</span>
            <button onClick={() => togglePublish(exercise)}>
              {exercise.isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
