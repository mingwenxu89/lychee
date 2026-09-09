// frontend/src/app/admin/exercises/[exerciseId]/page.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ exerciseId: 'exercise-1' })
}))

import ExerciseDetailPage from './page'

const exercise = { id: 'exercise-1', title: 'The Lighthouse Keeper\'s Daughter' }
const unit = { id: 'unit-1', exerciseId: 'exercise-1', title: 'Listening Practice', order: 2, isPublished: false }

function mockFetchOnce(body: unknown, status = 200) {
  const content = status === 204 ? null : JSON.stringify(body)
  vi.mocked(fetch).mockResolvedValueOnce(new Response(content, { status }))
}

describe('ExerciseDetailPage (Units)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    mockFetchOnce(exercise)
    mockFetchOnce([unit])
  })

  it('shows a breadcrumb with Exercises linking back and the Exercise title as the current page', async () => {
    render(<ExerciseDetailPage />)

    expect(await screen.findByText('Exercises')).toHaveAttribute('href', '/admin/exercises')
    expect(await screen.findByText('The Lighthouse Keeper\'s Daughter')).toBeInTheDocument()
  })

  it('renders the unit list with a link into the unit', async () => {
    render(<ExerciseDetailPage />)

    const link = await screen.findByRole('link', { name: /listening practice/i })
    expect(link).toHaveAttribute('href', '/admin/exercises/exercise-1/units/unit-1')
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('creates a new unit via the modal', async () => {
    render(<ExerciseDetailPage />)
    await screen.findByText('Listening Practice')

    fireEvent.click(screen.getByRole('button', { name: /new unit/i }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Shadowing Drills' } })
    fireEvent.change(screen.getByLabelText('Order'), { target: { value: '3' } })

    mockFetchOnce({ id: 'unit-2', exerciseId: 'exercise-1', title: 'Shadowing Drills', order: 3, isPublished: false }, 201)
    mockFetchOnce([unit, { id: 'unit-2', exerciseId: 'exercise-1', title: 'Shadowing Drills', order: 3, isPublished: false }])

    fireEvent.click(screen.getByRole('button', { name: /create unit/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/exercises/exercise-1/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Shadowing Drills', order: 3 })
      })
    })
    expect(await screen.findByText('Shadowing Drills')).toBeInTheDocument()
  })

  it('edits a unit via the pre-filled modal', async () => {
    render(<ExerciseDetailPage />)
    await screen.findByText('Listening Practice')

    fireEvent.click(screen.getByRole('button', { name: /edit listening practice/i }))

    expect(screen.getByLabelText('Title')).toHaveValue('Listening Practice')
    expect(screen.getByLabelText('Order')).toHaveValue(2)

    fireEvent.change(screen.getByLabelText('Order'), { target: { value: '1' } })

    mockFetchOnce({ ...unit, order: 1 })
    mockFetchOnce([{ ...unit, order: 1 }])

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/units/unit-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Listening Practice', order: 1 })
      })
    })
  })

  it('toggles publish status', async () => {
    render(<ExerciseDetailPage />)
    await screen.findByText('Listening Practice')

    mockFetchOnce({ ...unit, isPublished: true })
    mockFetchOnce([{ ...unit, isPublished: true }])

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/units/unit-1/publish-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: true })
      })
    })
  })

  it('requires typing the exact unit title before Delete is enabled, then deletes it', async () => {
    render(<ExerciseDetailPage />)
    await screen.findByText('Listening Practice')

    fireEvent.click(screen.getByRole('button', { name: /delete listening practice/i }))
    expect(screen.getByText('Delete this unit?')).toBeInTheDocument()

    const deleteButton = screen.getByRole('button', { name: /^delete$/i })
    expect(deleteButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/type ".*" to confirm/i), { target: { value: 'wrong name' } })
    expect(deleteButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/type ".*" to confirm/i), { target: { value: 'Listening Practice' } })
    expect(deleteButton).not.toBeDisabled()

    mockFetchOnce(undefined, 204)
    mockFetchOnce([])

    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/units/unit-1', { method: 'DELETE' })
    })
    await waitFor(() => {
      expect(screen.queryByText('Listening Practice')).not.toBeInTheDocument()
    })
  })

  it('shows an error and keeps the unit if deletion fails', async () => {
    render(<ExerciseDetailPage />)
    await screen.findByText('Listening Practice')

    fireEvent.click(screen.getByRole('button', { name: /delete listening practice/i }))
    fireEvent.change(screen.getByLabelText(/type ".*" to confirm/i), { target: { value: 'Listening Practice' } })

    mockFetchOnce(undefined, 500)

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to delete unit')
    expect(screen.getByText('Listening Practice')).toBeInTheDocument()
  })
})
