'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pager } from '@/components/Pager'

type HistoryEntry = {
  trackId: string
  trackTitle: string
  exerciseTitle: string
  practiceType: 'Practice' | 'Recitation'
  status: 'InProgress' | 'Completed'
  accuracy: number | null
  currentSentenceIndex: number | null
  totalSentences: number | null
  timestamp: string
}

type PagedResponse<T> = { items: T[]; totalCount: number; page: number; pageSize: number }

const PAGE_SIZE = 20

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function HistoryPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PagedResponse<HistoryEntry> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/learner/history?page=${page}&pageSize=${PAGE_SIZE}`)
      if (!response.ok) {
        setError('Failed to load your history.')
        return
      }
      setData(await response.json())
    }
    load()
  }, [page])

  if (error) return <main style={{ padding: 40 }}>{error}</main>
  if (!data) return <main style={{ padding: 40, color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</main>

  return (
    <main style={{ padding: '20px 40px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>History</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.items.map((entry) => {
          const href = entry.practiceType === 'Recitation'
            ? `/tracks/${entry.trackId}?mode=full`
            : `/tracks/${entry.trackId}?mode=sentence`

          return (
            <div
              key={`${entry.trackId}-${entry.practiceType}-${entry.timestamp}`}
              style={{ background: 'var(--surface)', borderRadius: 18, padding: '18px 20px', border: '2px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16 }}
            >
              <div
                style={{
                  width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                  background: entry.status === 'Completed' ? 'var(--leaf-soft)' : 'var(--primary-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {entry.status === 'Completed' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--leaf-dark)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0" strokeLinecap="round" /></svg>
                )}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{entry.trackTitle}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600 }}>
                  {entry.exerciseTitle} · {entry.practiceType} · {formatRelativeTime(entry.timestamp)}
                </span>
              </div>

              <span
                style={{
                  borderRadius: 999, padding: '4px 12px', fontWeight: 800, fontSize: 12,
                  background: entry.status === 'Completed' ? 'var(--leaf-soft)' : 'var(--gold)',
                  color: entry.status === 'Completed' ? 'var(--leaf-dark)' : 'white'
                }}
              >
                {entry.status === 'Completed'
                  ? entry.accuracy !== null ? `Completed · ${Math.round(entry.accuracy * 100)}%` : 'Completed'
                  : `In Progress · Sentence ${(entry.currentSentenceIndex ?? 0) + 1}/${entry.totalSentences ?? 0}`}
              </span>

              <Link
                href={href}
                style={{
                  background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 13,
                  borderRadius: 999, padding: '9px 18px', boxShadow: 'none',
                  textDecoration: 'none', whiteSpace: 'nowrap'
                }}
              >
                {entry.status === 'Completed' ? 'Practice Again' : 'Continue'}
              </Link>
            </div>
          )
        })}
      </div>

      <Pager page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} onPageChange={setPage} />
    </main>
  )
}
