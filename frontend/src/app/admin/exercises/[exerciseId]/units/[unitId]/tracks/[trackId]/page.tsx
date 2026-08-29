'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Sentence = { id: string; trackId: string; index: number; text: string; startTime: string; endTime: string }

export default function TrackProofreadingPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function loadSentences() {
    const response = await fetch(`/api/admin/tracks/${trackId}/sentences`)
    if (response.ok) {
      setSentences(await response.json())
    }
  }

  useEffect(() => {
    loadSentences()
  }, [trackId])

  function updateLocalField(id: string, field: 'text' | 'startTime' | 'endTime', value: string) {
    setSentences((current) => current.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  async function saveSentence(sentence: Sentence) {
    setSavingId(sentence.id)
    setSaveError(null)
    try {
      const response = await fetch(`/api/admin/sentences/${sentence.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence.text, startTime: sentence.startTime, endTime: sentence.endTime })
      })
      if (!response.ok) {
        setSaveError(`Failed to save sentence ${sentence.index}`)
        return
      }
      const saved: Sentence = await response.json()
      setSentences((current) => current.map((s) => (s.id === saved.id ? saved : s)))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main>
      <h1>Proofread Sentences</h1>
      {saveError && <p role="alert" style={{ color: 'var(--error)' }}>{saveError}</p>}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>#</th>
            <th style={{ textAlign: 'left' }}>Text</th>
            <th style={{ textAlign: 'left' }}>Start</th>
            <th style={{ textAlign: 'left' }}>End</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sentences.map((sentence) => (
            <tr key={sentence.id}>
              <td>{sentence.index}</td>
              <td>
                <input
                  value={sentence.text}
                  onChange={(e) => updateLocalField(sentence.id, 'text', e.target.value)}
                  style={{ width: '100%' }}
                />
              </td>
              <td>
                <input
                  value={sentence.startTime}
                  onChange={(e) => updateLocalField(sentence.id, 'startTime', e.target.value)}
                />
              </td>
              <td>
                <input
                  value={sentence.endTime}
                  onChange={(e) => updateLocalField(sentence.id, 'endTime', e.target.value)}
                />
              </td>
              <td>
                <button onClick={() => saveSentence(sentence)} disabled={savingId === sentence.id}>
                  {savingId === sentence.id ? 'Saving...' : 'Save'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
