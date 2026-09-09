// frontend/src/app/admin/exercises/page.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import ExercisesAdminPage from './page'

const exercise = {
  id: 'exercise-1',
  title: 'The Lighthouse Keeper\'s Daughter',
  description: 'A gentle A2 tale about solitude and the sea.',
  coverImageUrl: null,
  order: 2,
  isPublished: false
}

function mockFetchOnce(body: unknown, status = 200) {
  const content = status === 204 ? null : JSON.stringify(body)
  vi.mocked(fetch).mockResolvedValueOnce(new Response(content, { status }))
}

describe('ExercisesAdminPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    mockFetchOnce([exercise])
  })

  it('renders the exercise list with a link into the exercise\'s units', async () => {
    render(<ExercisesAdminPage />)

    const link = await screen.findByRole('link', { name: /the lighthouse keeper's daughter/i })
    expect(link).toHaveAttribute('href', '/admin/exercises/exercise-1')
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('A gentle A2 tale about solitude and the sea.')).toBeInTheDocument()
  })

  it('creates a new exercise via the modal and reloads the list', async () => {
    render(<ExercisesAdminPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')

    fireEvent.click(screen.getByRole('button', { name: /new exercise/i }))

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A New Story' } })
    expect(screen.getByLabelText('Order')).toHaveValue(2)

    mockFetchOnce({ id: 'exercise-2', title: 'A New Story', description: null, coverImageUrl: null, order: 2, isPublished: false }, 201)
    mockFetchOnce([exercise, { id: 'exercise-2', title: 'A New Story', description: null, coverImageUrl: null, order: 2, isPublished: false }])

    fireEvent.click(screen.getByRole('button', { name: /create exercise/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'A New Story', description: null, coverImageUrl: null, order: 2 })
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /new exercise/i })).not.toBeInTheDocument()
    })
    expect(await screen.findByText('A New Story')).toBeInTheDocument()
  })

  it('edits an exercise via the pre-filled modal', async () => {
    render(<ExercisesAdminPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')

    fireEvent.click(screen.getByRole('button', { name: /edit the lighthouse keeper's daughter/i }))

    expect(screen.getByLabelText('Title')).toHaveValue('The Lighthouse Keeper\'s Daughter')
    expect(screen.getByLabelText(/^description/i)).toHaveValue('A gentle A2 tale about solitude and the sea.')
    expect(screen.getByLabelText('Order')).toHaveValue(2)

    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Updated description.' } })

    const updated = { ...exercise, description: 'Updated description.' }
    mockFetchOnce(updated)
    mockFetchOnce([updated])

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/exercises/exercise-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'The Lighthouse Keeper\'s Daughter',
          description: 'Updated description.',
          coverImageUrl: null,
          order: 2
        })
      })
    })
  })

  it('toggles publish status', async () => {
    render(<ExercisesAdminPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')

    mockFetchOnce({ ...exercise, isPublished: true })
    mockFetchOnce([{ ...exercise, isPublished: true }])

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/exercises/exercise-1/publish-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: true })
      })
    })
    expect(await screen.findByText('Published')).toBeInTheDocument()
  })

  it('requires typing the exact exercise title before Delete is enabled, then deletes it', async () => {
    render(<ExercisesAdminPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')

    fireEvent.click(screen.getByRole('button', { name: /delete the lighthouse keeper's daughter/i }))
    expect(screen.getByText('Delete this exercise?')).toBeInTheDocument()

    const deleteButton = screen.getByRole('button', { name: /^delete$/i })
    expect(deleteButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/type ".*" to confirm/i), { target: { value: 'wrong name' } })
    expect(deleteButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/type ".*" to confirm/i), { target: { value: 'The Lighthouse Keeper\'s Daughter' } })
    expect(deleteButton).not.toBeDisabled()

    mockFetchOnce(undefined, 204)
    mockFetchOnce([])

    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/exercises/exercise-1', { method: 'DELETE' })
    })
    await waitFor(() => {
      expect(screen.queryByText('The Lighthouse Keeper\'s Daughter')).not.toBeInTheDocument()
    })
  })

  it('shows an error and keeps the exercise if deletion fails', async () => {
    render(<ExercisesAdminPage />)
    await screen.findByText('The Lighthouse Keeper\'s Daughter')

    fireEvent.click(screen.getByRole('button', { name: /delete the lighthouse keeper's daughter/i }))
    fireEvent.change(screen.getByLabelText(/type ".*" to confirm/i), { target: { value: 'The Lighthouse Keeper\'s Daughter' } })

    mockFetchOnce(undefined, 500)

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to delete exercise')
    expect(screen.getByText('The Lighthouse Keeper\'s Daughter')).toBeInTheDocument()
  })
})
