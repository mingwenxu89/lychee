'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AdminBreadcrumb } from '../../AdminBreadcrumb'

type Exercise = { id: string; title: string }
type Unit = { id: string; exerciseId: string; title: string; order: number; isPublished: boolean }

type UnitFormValues = { title: string; order: string }
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

const labelStyle: React.CSSProperties = { fontWeight: 800, fontSize: 13, color: 'var(--ink-faint)' }

const headerRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '64px 1fr 130px 160px',
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
    gridTemplateColumns: '64px 1fr 130px 160px',
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

function UnitFormModal({
  mode,
  form,
  onChange,
  onSubmit,
  onClose,
  error,
  isSaving
}: {
  mode: 'create' | 'edit'
  form: UnitFormValues
  onChange: (form: UnitFormValues) => void
  onSubmit: (event: React.FormEvent) => void
  onClose: () => void
  error: string | null
  isSaving: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(22% 0.03 270 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <form
        onSubmit={onSubmit}
        style={{ width: 440, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 28, boxShadow: 'none', padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{mode === 'create' ? 'New Unit' : 'Edit Unit'}</h2>
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
          <label htmlFor="unit-title" style={labelStyle}>Title</label>
          <input
            id="unit-title"
            required
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            placeholder="e.g. Listening Practice"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="unit-order" style={labelStyle}>Order</label>
          <input
            id="unit-order"
            required
            type="number"
            min={1}
            value={form.order}
            onChange={(e) => onChange({ ...form, order: e.target.value })}
            style={{ ...inputStyle, width: 90 }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--ink-faint)', fontWeight: 600 }}>Controls where this unit appears in the exercise.</span>
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0, fontSize: 14 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="submit" disabled={isSaving} style={btnPrimary}>
            {isSaving ? 'Saving...' : mode === 'create' ? 'Create Unit' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState<UnitFormValues>({ title: '', order: '1' })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function loadExercise() {
    const response = await fetch(`/api/admin/exercises/${exerciseId}`)
    if (response.ok) {
      setExercise(await response.json())
    }
  }

  async function loadUnits() {
    const response = await fetch(`/api/admin/exercises/${exerciseId}/units`)
    if (response.ok) {
      setUnits(await response.json())
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadExercise()
    loadUnits()
  }, [exerciseId])

  function openCreateModal() {
    setForm({ title: '', order: String(units.length + 1) })
    setFormError(null)
    setModal({ mode: 'create' })
  }

  function openEditModal(unit: Unit) {
    setForm({ title: unit.title, order: String(unit.order) })
    setFormError(null)
    setModal({ mode: 'edit', id: unit.id })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!modal) return
    setIsSaving(true)
    setFormError(null)

    const body = JSON.stringify({ title: form.title, order: Number(form.order) })

    const response =
      modal.mode === 'create'
        ? await fetch(`/api/admin/exercises/${exerciseId}/units`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        : await fetch(`/api/admin/units/${modal.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })

    setIsSaving(false)
    if (!response.ok) {
      setFormError(modal.mode === 'create' ? 'Failed to create unit' : 'Failed to save changes')
      return
    }
    setModal(null)
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
    <>
      <AdminBreadcrumb
        items={[{ label: 'Exercises', href: '/admin/exercises' }, { label: exercise?.title ?? '...' }]}
      />
      <main style={{ padding: '24px 40px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Units</h1>
            <span style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 }}>Units within this exercise</span>
          </div>
          <button onClick={openCreateModal} style={btnPrimary}>
            <PlusIcon />
            New Unit
          </button>
        </div>

        {isLoading ? (
          <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Loading...</span>
        ) : units.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: '48px 24px', textAlign: 'center', color: 'var(--ink-soft)', fontWeight: 700 }}>
            No units yet. Create the first one to get started.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22 }}>
            <div style={headerRowStyle}>
              <span style={headerCellStyle}>Order</span>
              <span style={headerCellStyle}>Title</span>
              <span style={headerCellStyle}>Status</span>
              <span style={{ ...headerCellStyle, textAlign: 'right' }}>Actions</span>
            </div>
            {units.map((unit, index) => (
              <div key={unit.id} style={rowStyle(index === units.length - 1)}>
                <span style={orderChipStyle}>{unit.order}</span>
                <Link href={`/admin/exercises/${exerciseId}/units/${unit.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content', color: 'var(--ink)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                  {unit.title}
                  <ChevronIcon />
                </Link>
                <span style={unit.isPublished ? publishedPillStyle : draftPillStyle}>
                  {unit.isPublished ? 'Published' : 'Draft'}
                </span>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => togglePublish(unit)} style={btnGhostSmall}>
                    {unit.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button aria-label={`Edit ${unit.title}`} onClick={() => openEditModal(unit)} style={iconButtonStyle}>
                    <PencilIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {modal && (
          <UnitFormModal
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
    </>
  )
}
