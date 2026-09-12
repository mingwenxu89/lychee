'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AdminBreadcrumb } from '../../../../../../AdminBreadcrumb'
import { SUPPORTED_TRANSLATION_LANGUAGES } from '@/lib/supportedTranslationLanguages'

type Exercise = { id: string; title: string }
type Unit = { id: string; title: string }
type Track = { id: string; title: string }
type Sentence = { id: string; trackId: string; index: number; text: string; startTime: string; endTime: string }
type Translation = { sentenceId: string; languageCode: string; translatedText: string; isManuallyEdited: boolean }

const headerRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px 1fr 160px 160px 1fr 96px',
  alignItems: 'center',
  padding: '14px 24px',
  background: 'oklch(96% 0.01 80)',
  borderBottom: '1px solid var(--line)'
}

const headerCellStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--ink-faint)',
  letterSpacing: '0.03em',
  textTransform: 'uppercase'
}

function rowStyle(isLast: boolean, isDirty: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '48px 1fr 160px 160px 1fr 96px',
    alignItems: 'center',
    padding: '10px 24px',
    borderBottom: isLast ? 'none' : '1px solid var(--line)',
    background: isDirty ? 'var(--primary-soft)' : 'transparent'
  }
}

function textInputStyle(isDirty: boolean): React.CSSProperties {
  return {
    border: `2px solid ${isDirty ? 'var(--primary)' : 'transparent'}`,
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 14.5,
    fontWeight: 600,
    color: 'var(--ink)',
    fontFamily: 'inherit',
    background: isDirty ? 'var(--surface)' : 'transparent'
  }
}

function timeInputStyle(isDirty: boolean): React.CSSProperties {
  return {
    border: '2px solid var(--line)',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink-soft)',
    fontFamily: 'inherit',
    width: 140,
    background: isDirty ? 'var(--surface)' : 'transparent'
  }
}

// Sentence timestamps are stored as full "HH:MM:SS.fffffff" TimeSpan strings, but no track
// audio runs anywhere near an hour — showing the always-"00" hour segment just wastes width
// the seconds/fraction need, so the input only ever shows/accepts "MM:SS.fffffff".
function toDisplayTime(raw: string): string {
  return raw.startsWith('00:') ? raw.slice(3) : raw
}

function toStoredTime(display: string): string {
  const colonCount = (display.match(/:/g) ?? []).length
  return colonCount === 1 ? `00:${display}` : display
}

function saveButtonStyle(isDirty: boolean): React.CSSProperties {
  return isDirty
    ? { background: 'var(--primary)', border: 'none', color: 'white', fontWeight: 800, fontSize: 12.5, borderRadius: 999, padding: '8px 16px', cursor: 'pointer', justifySelf: 'end', boxShadow: 'none' }
    : { background: 'transparent', border: '2px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 800, fontSize: 12.5, borderRadius: 999, padding: '8px 16px', cursor: 'pointer', justifySelf: 'end' }
}

export default function TrackProofreadingPage() {
  const { exerciseId, unitId, trackId } = useParams<{ exerciseId: string; unitId: string; trackId: string }>()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [track, setTrack] = useState<Track | null>(null)
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [originalById, setOriginalById] = useState<Record<string, Sentence>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [translationLanguage, setTranslationLanguage] = useState(SUPPORTED_TRANSLATION_LANGUAGES[0].code)
  const [translations, setTranslations] = useState<Record<string, Translation>>({})
  const [originalTranslationById, setOriginalTranslationById] = useState<Record<string, string>>({})
  const [overwriteManualEdits, setOverwriteManualEdits] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  async function loadExercise() {
    const response = await fetch(`/api/admin/exercises/${exerciseId}`)
    if (response.ok) setExercise(await response.json())
  }

  async function loadUnit() {
    const response = await fetch(`/api/admin/units/${unitId}`)
    if (response.ok) setUnit(await response.json())
  }

  async function loadTrack() {
    const response = await fetch(`/api/admin/tracks/${trackId}`)
    if (response.ok) setTrack(await response.json())
  }

  async function loadSentences() {
    const response = await fetch(`/api/admin/tracks/${trackId}/sentences`)
    if (response.ok) {
      const loaded: Sentence[] = await response.json()
      setSentences(loaded)
      setOriginalById(Object.fromEntries(loaded.map((s) => [s.id, s])))
    }
  }

  async function loadTranslations() {
    const response = await fetch(`/api/admin/tracks/${trackId}/translations?languageCode=${translationLanguage}`)
    if (response.ok) {
      const loaded: Translation[] = await response.json()
      setTranslations(Object.fromEntries(loaded.map((t) => [t.sentenceId, t])))
      setOriginalTranslationById(Object.fromEntries(loaded.map((t) => [t.sentenceId, t.translatedText])))
    }
  }

  useEffect(() => {
    loadExercise()
    loadUnit()
    loadTrack()
    loadSentences()
  }, [exerciseId, unitId, trackId])

  useEffect(() => {
    loadTranslations()
  }, [trackId, translationLanguage])

  async function handleGenerate() {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const response = await fetch(`/api/admin/tracks/${trackId}/translations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languageCode: translationLanguage, overwriteManualEdits })
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: 'Failed to generate translations' }))
        setGenerateError(body.message ?? 'Failed to generate translations')
        return
      }
      const loaded: Translation[] = await response.json()
      setTranslations(Object.fromEntries(loaded.map((t) => [t.sentenceId, t])))
      setOriginalTranslationById((current) => ({
        ...current,
        ...Object.fromEntries(loaded.map((t) => [t.sentenceId, t.translatedText]))
      }))
    } finally {
      setIsGenerating(false)
    }
  }

  async function saveTranslation(sentenceId: string, translatedText: string) {
    const response = await fetch(`/api/admin/sentences/${sentenceId}/translations/${translationLanguage}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translatedText })
    })
    if (response.ok) {
      const saved: Translation = await response.json()
      setTranslations((current) => ({ ...current, [sentenceId]: saved }))
      setOriginalTranslationById((current) => ({ ...current, [sentenceId]: saved.translatedText }))
    }
  }

  function updateLocalTranslation(sentenceId: string, translatedText: string) {
    setTranslations((current) => ({
      ...current,
      [sentenceId]: { sentenceId, languageCode: translationLanguage, translatedText, isManuallyEdited: current[sentenceId]?.isManuallyEdited ?? false }
    }))
  }

  function updateLocalField(id: string, field: 'text' | 'startTime' | 'endTime', value: string) {
    setSentences((current) => current.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  function isDirty(sentence: Sentence): boolean {
    const original = originalById[sentence.id]
    if (!original) return false
    return original.text !== sentence.text || original.startTime !== sentence.startTime || original.endTime !== sentence.endTime
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
      setOriginalById((current) => ({ ...current, [saved.id]: saved }))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <AdminBreadcrumb
        items={[
          { label: 'Exercises', href: '/admin/exercises' },
          { label: exercise?.title ?? '...', href: `/admin/exercises/${exerciseId}` },
          { label: unit?.title ?? '...', href: `/admin/exercises/${exerciseId}/units/${unitId}` },
          { label: track?.title ?? '...' }
        ]}
      />
      <main style={{ padding: '24px 40px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Proofread Sentences</h1>
          <span style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 }}>
            Fix transcription or timing errors before publishing. Sentences come from the uploaded SRT file.
          </span>
        </div>

        {saveError && (
          <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0 }}>
            {saveError}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <select
            aria-label="Translation language"
            value={translationLanguage}
            onChange={(e) => setTranslationLanguage(e.target.value)}
            style={{ border: '2px solid var(--line)', borderRadius: 10, padding: '8px 12px', fontSize: 13.5, fontWeight: 700 }}
          >
            {SUPPORTED_TRANSLATION_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.displayName}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            <input
              type="checkbox"
              checked={overwriteManualEdits}
              onChange={(e) => setOverwriteManualEdits(e.target.checked)}
            />
            Overwrite manually edited sentences
          </label>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 999, padding: '9px 20px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            {isGenerating ? 'Generating...' : 'Generate Translations'}
          </button>
        </div>

        {generateError && (
          <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0 }}>
            {generateError}
          </p>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, overflow: 'hidden' }}>
          <div style={headerRowStyle}>
            <span style={headerCellStyle}>#</span>
            <span style={headerCellStyle}>Text</span>
            <span style={headerCellStyle}>Start</span>
            <span style={headerCellStyle}>End</span>
            <span style={headerCellStyle}>Translation</span>
            <span />
          </div>
          {sentences.map((sentence, index) => {
            const dirty = isDirty(sentence)
            return (
              <div key={sentence.id} style={rowStyle(index === sentences.length - 1, dirty)}>
                <span style={{ color: 'var(--ink-faint)', fontWeight: 800, fontSize: 13 }}>{sentence.index}</span>
                <input
                  aria-label={`Sentence ${sentence.index} text`}
                  value={sentence.text}
                  onChange={(e) => updateLocalField(sentence.id, 'text', e.target.value)}
                  style={textInputStyle(dirty)}
                />
                <input
                  aria-label={`Sentence ${sentence.index} start time`}
                  value={toDisplayTime(sentence.startTime)}
                  onChange={(e) => updateLocalField(sentence.id, 'startTime', toStoredTime(e.target.value))}
                  style={timeInputStyle(dirty)}
                />
                <input
                  aria-label={`Sentence ${sentence.index} end time`}
                  value={toDisplayTime(sentence.endTime)}
                  onChange={(e) => updateLocalField(sentence.id, 'endTime', toStoredTime(e.target.value))}
                  style={timeInputStyle(dirty)}
                />
                <input
                  aria-label={`Sentence ${sentence.index} translation`}
                  value={translations[sentence.id]?.translatedText ?? ''}
                  onChange={(e) => updateLocalTranslation(sentence.id, e.target.value)}
                  onBlur={(e) => {
                    const loaded = originalTranslationById[sentence.id] ?? ''
                    if (e.target.value !== loaded) saveTranslation(sentence.id, e.target.value)
                  }}
                  style={textInputStyle(false)}
                />
                <button onClick={() => saveSentence(sentence)} disabled={savingId === sentence.id} style={saveButtonStyle(dirty)}>
                  {savingId === sentence.id ? 'Saving...' : 'Save'}
                </button>
              </div>
            )
          })}
        </div>
      </main>
    </>
  )
}
