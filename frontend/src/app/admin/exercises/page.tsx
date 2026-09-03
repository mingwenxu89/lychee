'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Exercise = {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  order: number
  isPublished: boolean
}

type ExerciseFormValues = {
  title: string
  description: string
  coverImageUrl: string
  order: string
}

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
  minHeight: 80,
  resize: 'vertical'
}

const labelStyle: React.CSSProperties = { fontWeight: 800, fontSize: 13, color: 'var(--ink-faint)' }

const headerRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px 64px 1fr 120px 160px',
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
    gridTemplateColumns: '56px 64px 1fr 120px 160px',
    alignItems: 'center',
    padding: '14px 24px',
    borderBottom: isLast ? 'none' : '1px solid var(--line)',
    borderBottomLeftRadius: isLast ? 22 : 0,
    borderBottomRightRadius: isLast ? 22 : 0
  }
}

const orderChipStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  background: 'oklch(96% 0.01 80)',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const thumbnailStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: 'var(--gold-soft)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const descriptionStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--ink-faint)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
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

function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  )
}

function ExerciseFormModal({
  mode,
  form,
  onChange,
  onSubmit,
  onClose,
  error,
  isSaving
}: {
  mode: 'create' | 'edit'
  form: ExerciseFormValues
  onChange: (form: ExerciseFormValues) => void
  onSubmit: (event: React.FormEvent) => void
  onClose: () => void
  error: string | null
  isSaving: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(22% 0.03 270 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <form
        onSubmit={onSubmit}
        style={{ width: 520, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 28, boxShadow: 'none', padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{mode === 'create' ? 'New Exercise' : 'Edit Exercise'}</h2>
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
          <label htmlFor="exercise-title" style={labelStyle}>Title</label>
          <input
            id="exercise-title"
            required
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            placeholder="e.g. The Lighthouse Keeper's Daughter"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="exercise-description" style={labelStyle}>
            Description <span style={{ color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'none' }}>(optional)</span>
          </label>
          <textarea
            id="exercise-description"
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="A short blurb shown to learners"
            style={textareaStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="exercise-cover" style={labelStyle}>
            Cover Image URL <span style={{ color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'none' }}>(optional)</span>
          </label>
          <input
            id="exercise-cover"
            value={form.coverImageUrl}
            onChange={(e) => onChange({ ...form, coverImageUrl: e.target.value })}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="exercise-order" style={labelStyle}>Order</label>
          <input
            id="exercise-order"
            required
            type="number"
            min={1}
            value={form.order}
            onChange={(e) => onChange({ ...form, order: e.target.value })}
            style={{ ...inputStyle, width: 90 }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--ink-faint)', fontWeight: 600 }}>Controls where this exercise appears in the list.</span>
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0, fontSize: 14 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="submit" disabled={isSaving} style={btnPrimary}>
            {isSaving ? 'Saving...' : mode === 'create' ? 'Create Exercise' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function ExercisesAdminPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState<ExerciseFormValues>({ title: '', description: '', coverImageUrl: '', order: '1' })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function loadExercises() {
    const response = await fetch('/api/admin/exercises')
    if (response.ok) {
      setExercises(await response.json())
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadExercises()
  }, [])

  function openCreateModal() {
    setForm({ title: '', description: '', coverImageUrl: '', order: String(exercises.length + 1) })
    setFormError(null)
    setModal({ mode: 'create' })
  }

  function openEditModal(exercise: Exercise) {
    setForm({
      title: exercise.title,
      description: exercise.description ?? '',
      coverImageUrl: exercise.coverImageUrl ?? '',
      order: String(exercise.order)
    })
    setFormError(null)
    setModal({ mode: 'edit', id: exercise.id })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!modal) return
    setIsSaving(true)
    setFormError(null)

    const body = JSON.stringify({
      title: form.title,
      description: form.description || null,
      coverImageUrl: form.coverImageUrl || null,
      order: Number(form.order)
    })

    const response =
      modal.mode === 'create'
        ? await fetch('/api/admin/exercises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        : await fetch(`/api/admin/exercises/${modal.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })

    setIsSaving(false)
    if (!response.ok) {
      setFormError(modal.mode === 'create' ? 'Failed to create exercise' : 'Failed to save changes')
      return
    }
    setModal(null)
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
    <main style={{ padding: '24px 40px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Exercises</h1>
          <span style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 }}>Manage exercise content across the app</span>
        </div>
        <button onClick={openCreateModal} style={btnPrimary}>
          <PlusIcon />
          New Exercise
        </button>
      </div>

      {isLoading ? (
        <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</span>
      ) : exercises.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: '48px 24px', textAlign: 'center', color: 'var(--ink-soft)', fontWeight: 700 }}>
          No exercises yet. Create your first one to get started.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22 }}>
          <div style={headerRowStyle}>
            <span style={headerCellStyle}>Order</span>
            <span />
            <span style={headerCellStyle}>Title</span>
            <span style={headerCellStyle}>Status</span>
            <span style={{ ...headerCellStyle, textAlign: 'right' }}>Actions</span>
          </div>
          {exercises.map((exercise, index) => (
            <div key={exercise.id} style={rowStyle(index === exercises.length - 1)}>
              <span style={orderChipStyle}>{exercise.order}</span>
              <div style={thumbnailStyle}>
                <BookIcon />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 16, minWidth: 0 }}>
                <Link
                  href={`/admin/exercises/${exercise.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content', color: 'var(--ink)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
                >
                  {exercise.title}
                  <ChevronIcon />
                </Link>
                {exercise.description && <span style={descriptionStyle}>{exercise.description}</span>}
              </div>
              <span style={exercise.isPublished ? publishedPillStyle : draftPillStyle}>
                {exercise.isPublished ? 'Published' : 'Draft'}
              </span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => togglePublish(exercise)} style={btnGhostSmall}>
                  {exercise.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button aria-label={`Edit ${exercise.title}`} onClick={() => openEditModal(exercise)} style={iconButtonStyle}>
                  <PencilIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ExerciseFormModal
          mode={modal.mode}
          form={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          onClose={() => setModal(null)}
          error={formError}
          isSaving={isSaving}
        />
      )}
    </main>
  )
}
