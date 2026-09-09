'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pager } from '@/components/Pager'

type FavoriteTrack = {
  id: string
  title: string
  description: string | null
  exerciseId: string
  exerciseTitle: string
  level: string
  duration: string
  sentenceCount: number
  favoritedAt: string
}

type PagedResponse<T> = { items: T[]; totalCount: number; page: number; pageSize: number }

const PAGE_SIZE = 20

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 18,
  padding: '18px 20px',
  border: '2px solid var(--line)',
  display: 'flex',
  alignItems: 'center',
  gap: 16
}

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'var(--primary)' : 'none'} stroke={filled ? 'var(--primary)' : 'var(--ink-faint)'} strokeWidth="2">
      <path d="M12 21s-6.7-4.35-9.3-8.28C1.02 10.4 1.5 6.9 4.3 5.3a5 5 0 0 1 7 1.2 5 5 0 0 1 7-1.2c2.8 1.6 3.28 5.1 1.6 7.42C18.7 16.65 12 21 12 21z" strokeLinejoin="round" />
    </svg>
  )
}

export default function FavoritesPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PagedResponse<FavoriteTrack> | null>(null)

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/learner/favorites/tracks?page=${page}&pageSize=${PAGE_SIZE}`)
      if (response.ok) setData(await response.json())
    }
    load()
  }, [page])

  async function handleUnfavoriteTrack(trackId: string) {
    setData((current) => (current
      ? { ...current, items: current.items.filter((t) => t.id !== trackId), totalCount: current.totalCount - 1 }
      : current))
    await fetch(`/api/learner/tracks/${trackId}/favorite`, { method: 'DELETE' })
  }

  return (
    <main style={{ padding: '20px 40px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Favorites</h1>

      {!data ? (
        <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</span>
      ) : data.items.length === 0 ? (
        <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>No favorited tracks yet.</span>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.items.map((track) => (
              <div key={track.id} style={cardStyle}>
                <Link href={`/tracks/${track.id}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{track.title}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600 }}>
                    {track.exerciseTitle} · {track.level} · {track.sentenceCount} sentences
                  </span>
                </Link>
                <button
                  onClick={() => handleUnfavoriteTrack(track.id)}
                  aria-label={`Remove ${track.title} from favorites`}
                  style={iconButtonStyle}
                >
                  <HeartIcon filled />
                </button>
              </div>
            ))}
          </div>
          <Pager page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} onPageChange={setPage} />
        </>
      )}
    </main>
  )
}
