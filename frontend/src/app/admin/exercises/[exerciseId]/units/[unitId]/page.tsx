'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AdminBreadcrumb } from '../../../../AdminBreadcrumb'

type Exercise = { id: string; title: string }
type Unit = { id: string; title: string }

type Track = {
  id: string
  unitId: string
  title: string
  description: string | null
  audioUrl: string
  srtUrl: string
  duration: string
  level: string
  isPublished: boolean
  sentenceCount: number
}

type CreateFormValues = { title: string; level: string; description: string; audioFile: File | null; srtFile: File | null }
type EditFormValues = { title: string; level: string; description: string }
type ModalState = { mode: 'create' } | { mode: 'edit'; id: string }

const btnPrimary: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--primary)',
  color: 'white',
  fontWeight: 800,
  fontSize: 15,
  border: 'none',
  borderRadius: 999,
  padding: '14px 28px',
  boxShadow: 'none',
  cursor: 'pointer'
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 15,
  border: '2px solid var(--line)',
  borderRadius: 999,
  padding: '12px 26px',
  cursor: 'pointer'
}

const btnGhostSmall: React.CSSProperties = {
  background: 'transparent',
  border: '2px solid var(--line)',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 12.5,
  borderRadius: 999,
  padding: '8px 14px',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}

const iconButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: 'transparent',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer'
}

const inputStyle: React.CSSProperties = {
  border: '2px solid var(--line)',
  borderRadius: 14,
  padding: '12px 16px',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--ink)',
  fontFamily: 'inherit'
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  borderRadius: 16,
  padding: '14px 16px',
  minHeight: 70,
  resize: 'vertical'
}

const labelStyle: React.CSSProperties = { fontWeight: 800, fontSize: 13, color: 'var(--ink-faint)' }

const headerRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 80px 90px 150px 120px 210px',
  alignItems: 'center',
  padding: '14px 24px',
  background: 'oklch(96% 0.01 80)',
  borderBottom: '1px solid var(--line)',
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22
}

const headerCellStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--ink-faint)',
  letterSpacing: '0.03em',
  textTransform: 'uppercase'
}

function rowStyle(isLast: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 90px 150px 120px 210px',
    alignItems: 'center',
    padding: '14px 24px',
    borderBottom: isLast ? 'none' : '1px solid var(--line)',
    borderBottomLeftRadius: isLast ? 22 : 0,
    borderBottomRightRadius: isLast ? 22 : 0
  }
}

const levelChipStyle: React.CSSProperties = {
  background: 'oklch(96% 0.01 80)',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 12.5,
  padding: '5px 12px',
  borderRadius: 999,
  width: 'fit-content'
}

const sentencesChipStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  width: 'fit-content',
  background: 'oklch(96% 0.01 80)',
  color: 'var(--ink-soft)',
  fontWeight: 700,
  fontSize: 12.5,
  padding: '6px 12px 6px 14px',
  borderRadius: 999,
  textDecoration: 'none'
}

const publishedPillStyle: React.CSSProperties = {
  background: 'var(--leaf-soft)',
  color: 'var(--leaf-dark)',
  fontWeight: 800,
  fontSize: 12,
  padding: '6px 14px',
  borderRadius: 999,
  width: 'fit-content'
}

const draftPillStyle: React.CSSProperties = {
  background: 'oklch(93% 0.008 80)',
  color: 'var(--ink-faint)',
  fontWeight: 800,
  fontSize: 12,
  padding: '6px 14px',
  borderRadius: 999,
  width: 'fit-content'
}

const descriptionStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--ink-faint)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}

function formatDuration(duration: string): string {
  const [h, m, s] = duration.split(':')
  if (h === undefined || m === undefined || s === undefined) return duration
  const seconds = String(Math.round(Number(s))).padStart(2, '0')
  return h === '00' ? `${Number(m)}:${seconds}` : `${Number(h)}:${m.padStart(2, '0')}:${seconds}`
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function DeleteConfirmPopover({
  itemLabel,
  error,
  onCancel,
  onConfirm
}: {
  itemLabel: string
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        right: 24,
        width: 260,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        boxShadow: 'none',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 5
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>Delete this track?</span>
        <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 600, lineHeight: 1.4 }}>
          This removes &quot;{itemLabel}&quot; and can&apos;t be undone.
        </span>
      </div>
      {error && (
        <span role="alert" style={{ fontSize: 12.5, color: 'var(--error)', fontWeight: 700 }}>
          {error}
        </span>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ ...btnGhostSmall, fontSize: 13, padding: '8px 16px' }}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{ background: 'var(--error)', color: 'white', fontWeight: 800, fontSize: 13, border: 'none', borderRadius: 999, padding: '8px 16px', boxShadow: 'none', cursor: 'pointer' }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function FileDropzone({
  label,
  accept,
  hint,
  file,
  onChange
}: {
  label: string
  accept: string
  hint: string
  file: File | null
  onChange: (file: File | null) => void
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      <label
        style={{
          position: 'relative',
          border: '2px dashed var(--line)',
          borderRadius: 16,
          padding: '20px 14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          textAlign: 'center'
        }}
      >
        <UploadIcon />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>{file ? file.name : 'Click to upload'}</span>
        <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>{hint}</span>
        <input
          type="file"
          accept={accept}
          aria-label={label}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
        />
      </label>
    </div>
  )
}

function TrackCreateModal({
  form,
  onChange,
  onSubmit,
  onClose,
  error,
  isSaving
}: {
  form: CreateFormValues
  onChange: (form: CreateFormValues) => void
  onSubmit: (event: React.FormEvent) => void
  onClose: () => void
  error: string | null
  isSaving: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(22% 0.03 270 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '24px 0' }}>
      <form
        onSubmit={onSubmit}
        style={{ width: 520, maxWidth: '92vw', maxHeight: '100%', overflowY: 'auto', background: 'var(--surface)', borderRadius: 28, boxShadow: 'none', padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>New Track</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-faint)', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          <FileDropzone label="Audio File" accept="audio/*" hint=".mp3, .wav, .m4a" file={form.audioFile} onChange={(audioFile) => onChange({ ...form, audioFile })} />
          <FileDropzone label="SRT File" accept=".srt" hint=".srt" file={form.srtFile} onChange={(srtFile) => onChange({ ...form, srtFile })} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="track-title" style={labelStyle}>Title</label>
          <input
            id="track-title"
            required
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            placeholder="e.g. Chapter 4: The Rescue"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="track-level" style={labelStyle}>Level (CEFR)</label>
          <input
            id="track-level"
            required
            value={form.level}
            onChange={(e) => onChange({ ...form, level: e.target.value })}
            placeholder="A1"
            style={{ ...inputStyle, width: 120 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="track-description" style={labelStyle}>
            Description <span style={{ color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'none' }}>(optional)</span>
          </label>
          <textarea
            id="track-description"
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="Short description shown to learners"
            style={textareaStyle}
          />
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0, fontSize: 14 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="submit" disabled={isSaving} style={btnPrimary}>
            {isSaving ? 'Uploading...' : 'Upload Track'}
          </button>
        </div>
      </form>
    </div>
  )
}

function TrackEditModal({
  form,
  onChange,
  onSubmit,
  onClose,
  error,
  isSaving
}: {
  form: EditFormValues
  onChange: (form: EditFormValues) => void
  onSubmit: (event: React.FormEvent) => void
  onClose: () => void
  error: string | null
  isSaving: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(22% 0.03 270 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <form
        onSubmit={onSubmit}
        style={{ width: 480, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 28, boxShadow: 'none', padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Edit Track</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-faint)', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="edit-track-title" style={labelStyle}>Title</label>
          <input
            id="edit-track-title"
            required
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="edit-track-level" style={labelStyle}>Level (CEFR)</label>
          <input
            id="edit-track-level"
            required
            value={form.level}
            onChange={(e) => onChange({ ...form, level: e.target.value })}
            style={{ ...inputStyle, width: 120 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="edit-track-description" style={labelStyle}>
            Description <span style={{ color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'none' }}>(optional)</span>
          </label>
          <textarea
            id="edit-track-description"
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            style={textareaStyle}
          />
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0, fontSize: 14 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="submit" disabled={isSaving} style={btnPrimary}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function UnitDetailPage() {
  const { exerciseId, unitId } = useParams<{ exerciseId: string; unitId: string }>()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState | null>(null)
  const [createForm, setCreateForm] = useState<CreateFormValues>({ title: '', level: '', description: '', audioFile: null, srtFile: null })
  const [editForm, setEditForm] = useState<EditFormValues>({ title: '', level: '', description: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function loadExercise() {
    const response = await fetch(`/api/admin/exercises/${exerciseId}`)
    if (response.ok) setExercise(await response.json())
  }

  async function loadUnit() {
    const response = await fetch(`/api/admin/units/${unitId}`)
    if (response.ok) setUnit(await response.json())
  }

  async function loadTracks() {
    const response = await fetch(`/api/admin/units/${unitId}/tracks`)
    if (response.ok) setTracks(await response.json())
    setIsLoading(false)
  }

  useEffect(() => {
    loadExercise()
    loadUnit()
    loadTracks()
  }, [exerciseId, unitId])

  function openCreateModal() {
    setCreateForm({ title: '', level: '', description: '', audioFile: null, srtFile: null })
    setFormError(null)
    setModal({ mode: 'create' })
  }

  function openEditModal(track: Track) {
    setEditForm({ title: track.title, level: track.level, description: track.description ?? '' })
    setFormError(null)
    setModal({ mode: 'edit', id: track.id })
  }

  async function handleCreateSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!createForm.audioFile || !createForm.srtFile) {
      setFormError('Both an audio file and an SRT file are required')
      return
    }

    setIsSaving(true)
    const formData = new FormData()
    formData.append('AudioFile', createForm.audioFile)
    formData.append('SrtFile', createForm.srtFile)
    formData.append('Title', createForm.title)
    formData.append('Level', createForm.level)
    formData.append('Description', createForm.description)

    const response = await fetch(`/api/admin/units/${unitId}/tracks`, { method: 'POST', body: formData })
    setIsSaving(false)
    if (!response.ok) {
      setFormError('Failed to create track')
      return
    }
    setModal(null)
    await loadTracks()
  }

  async function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (modal?.mode !== 'edit') return
    setIsSaving(true)
    setFormError(null)

    const response = await fetch(`/api/admin/tracks/${modal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editForm.title, level: editForm.level, description: editForm.description || null })
    })

    setIsSaving(false)
    if (!response.ok) {
      setFormError('Failed to save changes')
      return
    }
    setModal(null)
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

  async function handleDelete(id: string) {
    setDeleteError(null)
    const response = await fetch(`/api/admin/tracks/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setDeleteError('Failed to delete track')
      return
    }
    setConfirmingDeleteId(null)
    await loadTracks()
  }

  const filteredTracks = useMemo(
    () => tracks.filter((track) => track.title.toLowerCase().includes(search.toLowerCase())),
    [tracks, search]
  )

  return (
    <>
      <AdminBreadcrumb
        items={[
          { label: 'Exercises', href: '/admin/exercises' },
          { label: exercise?.title ?? '...', href: `/admin/exercises/${exerciseId}` },
          { label: unit?.title ?? '...' }
        ]}
      />
      <main style={{ padding: '24px 40px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Tracks</h1>
            <span style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 }}>Upload and manage tracks in this unit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '2px solid var(--line)', borderRadius: 999, padding: '10px 18px', width: 240 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tracks..."
                style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 600, fontSize: 14, width: '100%' }}
              />
            </div>
            <button onClick={openCreateModal} style={btnPrimary}>
              <PlusIcon />
              New Track
            </button>
          </div>
        </div>

        {isLoading ? (
          <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</span>
        ) : tracks.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: '48px 24px', textAlign: 'center', color: 'var(--ink-soft)', fontWeight: 700 }}>
            No tracks yet. Upload the first one to get started.
          </div>
        ) : filteredTracks.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: '48px 24px', textAlign: 'center', color: 'var(--ink-soft)', fontWeight: 700 }}>
            No tracks match &quot;{search}&quot;.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22 }}>
            <div style={headerRowStyle}>
              <span style={headerCellStyle}>Title</span>
              <span style={headerCellStyle}>Level</span>
              <span style={headerCellStyle}>Duration</span>
              <span style={headerCellStyle}>Sentences</span>
              <span style={headerCellStyle}>Status</span>
              <span style={{ ...headerCellStyle, textAlign: 'right' }}>Actions</span>
            </div>
            {filteredTracks.map((track, index) => (
              <div key={track.id} style={{ position: 'relative', ...rowStyle(index === filteredTracks.length - 1) }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 16, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{track.title}</span>
                  {track.description && <span style={descriptionStyle}>{track.description}</span>}
                </div>
                <span style={levelChipStyle}>{track.level}</span>
                <span style={{ color: 'var(--ink-soft)', fontWeight: 700, fontSize: 13.5 }}>{formatDuration(track.duration)}</span>
                <Link href={`/admin/exercises/${exerciseId}/units/${unitId}/tracks/${track.id}`} style={sentencesChipStyle}>
                  {track.sentenceCount} sentences
                  <ChevronIcon />
                </Link>
                <span style={track.isPublished ? publishedPillStyle : draftPillStyle}>
                  {track.isPublished ? 'Published' : 'Draft'}
                </span>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => togglePublish(track)} style={btnGhostSmall}>
                    {track.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button aria-label={`Edit ${track.title}`} onClick={() => openEditModal(track)} style={iconButtonStyle}>
                    <PencilIcon />
                  </button>
                  <button
                    aria-label={`Delete ${track.title}`}
                    onClick={() => {
                      setDeleteError(null)
                      setConfirmingDeleteId(track.id)
                    }}
                    style={iconButtonStyle}
                  >
                    <TrashIcon />
                  </button>
                </div>

                {confirmingDeleteId === track.id && (
                  <DeleteConfirmPopover
                    itemLabel={track.title}
                    error={deleteError}
                    onCancel={() => {
                      setConfirmingDeleteId(null)
                      setDeleteError(null)
                    }}
                    onConfirm={() => handleDelete(track.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {modal?.mode === 'create' && (
          <TrackCreateModal
            form={createForm}
            onChange={setCreateForm}
            onSubmit={handleCreateSubmit}
            onClose={() => setModal(null)}
            error={formError}
            isSaving={isSaving}
          />
        )}
        {modal?.mode === 'edit' && (
          <TrackEditModal
            form={editForm}
            onChange={setEditForm}
            onSubmit={handleEditSubmit}
            onClose={() => setModal(null)}
            error={formError}
            isSaving={isSaving}
          />
        )}
      </main>
    </>
  )
}
