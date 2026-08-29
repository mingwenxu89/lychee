'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Unit = { id: string; exerciseId: string; title: string; order: number; isPublished: boolean }

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const [units, setUnits] = useState<Unit[]>([])
  const [title, setTitle] = useState('')
  const [order, setOrder] = useState(1)

  async function loadUnits() {
    const response = await fetch(`/api/admin/exercises/${exerciseId}/units`)
    if (response.ok) {
      setUnits(await response.json())
    }
  }

  useEffect(() => {
    loadUnits()
  }, [exerciseId])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    await fetch(`/api/admin/exercises/${exerciseId}/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, order })
    })
    setTitle('')
    await loadUnits()
  }

  async function togglePublish(unit: Unit) {
    await fetch(`/api/admin/units/${unit.id}/publish-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !unit.isPublished })
    })
    await loadUnits()
  }

  return (
    <main>
      <h1>Units</h1>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input required type="number" placeholder="Order" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        <button type="submit">Create Unit</button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {units.map((unit) => (
          <li key={unit.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href={`/admin/exercises/${exerciseId}/units/${unit.id}`}>{unit.title}</a>
            <span>Order: {unit.order}</span>
            <button onClick={() => togglePublish(unit)}>
              {unit.isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
