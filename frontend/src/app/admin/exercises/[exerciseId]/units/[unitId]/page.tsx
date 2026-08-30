'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Track = {
  id: string
  unitId: string
  audioUrl: string
  srtUrl: string
  duration: string
  level: string
  isPublished: boolean
  sentenceCount: number
}

export default function UnitDetailPage() {
  const { exerciseId, unitId } = useParams<{ exerciseId: string; unitId: string }>()
  const [tracks, setTracks] = useState<Track[]>([])
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('A1')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [srtFile, setSrtFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadTracks() {
    const response = await fetch(`/api/admin/units/${unitId}/tracks`)
    if (response.ok) {
      setTracks(await response.json())
    }
  }

  useEffect(() => {
    loadTracks()
  }, [unitId])

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!audioFile || !srtFile) {
      setError('Both an audio file and an SRT file are required')
      return
    }

    const formData = new FormData()
    formData.append('AudioFile', audioFile)
    formData.append('SrtFile', srtFile)
    formData.append('Title', title)
    formData.append('Level', level)

    const response = await fetch(`/api/admin/units/${unitId}/tracks`, { method: 'POST', body: formData })
    if (!response.ok) {
      setError('Failed to create track')
      return
    }
    setAudioFile(null)
    setSrtFile(null)
    setTitle('')
    await loadTracks()
  }

  async function togglePublish(track: Track) {
    await fetch(`/api/admin/tracks/${track.id}/publish-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !track.isPublished })
    })
    await loadTracks()
  }

  return (
    <main>
      <h1>Tracks</h1>

      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, maxWidth: 360 }}>
        <label>
          Audio file
          <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          SRT file
          <input type="file" accept=".srt" onChange={(e) => setSrtFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          Track title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title" required />
        </label>
        <label>
          Level (CEFR)
          <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="A1" />
        </label>
        {error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
        <button type="submit">Upload Track</button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tracks.map((track) => (
          <li key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href={`/admin/exercises/${exerciseId}/units/${unitId}/tracks/${track.id}`}>
              {track.level} — {track.sentenceCount} sentences
            </a>
            <button onClick={() => togglePublish(track)}>
              {track.isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
