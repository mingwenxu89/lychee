import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import ExercisesPage from './page'

const exercises = [
  { id: 'ex-1', title: 'Short Stories', difficultyRangeLabel: 'A1-C1', trackCount: 10, completedTrackCount: 2, lastPracticedAt: '2026-08-30T00:00:00Z' },
  { id: 'ex-2', title: 'TED Talks', difficultyRangeLabel: 'C1-C2', trackCount: 5, completedTrackCount: 0, lastPracticedAt: null }
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(exercises), { status: 200 })))
})

function findCardTitle(title: string) {
  return screen.getAllByText(title).find((el) => el.tagName === 'H3')
}

describe('ExercisesPage', () => {
  it('lists every exercise with its difficulty range and lesson count', async () => {
    render(<ExercisesPage />)

    await waitFor(() => expect(findCardTitle('Short Stories')).toBeTruthy())
    expect(findCardTitle('TED Talks')).toBeTruthy()
    expect(screen.getByText('A1-C1')).toBeInTheDocument()
    expect(screen.getByText(/10 lessons/i)).toBeInTheDocument()
  })

  it('shows recently-practiced exercises as links next to All, most recent first', async () => {
    const recentFirst = { id: 'ex-3', title: 'Idioms', difficultyRangeLabel: 'B1-B2', trackCount: 3, completedTrackCount: 1, lastPracticedAt: '2026-09-01T00:00:00Z' }
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify([...exercises, recentFirst]), { status: 200 }))

    render(<ExercisesPage />)
    await waitFor(() => expect(findCardTitle('TED Talks')).toBeTruthy())

    const recentLinks = within(screen.getByTestId('recent-exercises')).getAllByRole('link')
    expect(recentLinks.map((link) => link.textContent)).toEqual(['Idioms', 'Short Stories'])
    expect(recentLinks[0]).toHaveAttribute('href', '/exercises/ex-3')
  })

  it('does not show an exercise with no practice history in the recent list', async () => {
    render(<ExercisesPage />)
    await waitFor(() => expect(findCardTitle('TED Talks')).toBeTruthy())

    const recentLinks = within(screen.getByTestId('recent-exercises')).getAllByRole('link')
    expect(recentLinks.map((link) => link.textContent)).toEqual(['Short Stories'])
  })

  it('filters by search text', async () => {
    render(<ExercisesPage />)
    await waitFor(() => expect(findCardTitle('TED Talks')).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText(/search exercises/i), { target: { value: 'ted' } })

    await waitFor(() => expect(screen.queryByText(/10 lessons/i)).not.toBeInTheDocument())
    expect(screen.getByText(/5 lessons/i)).toBeInTheDocument()
  })

  it('links each card to its Exercise detail page', async () => {
    render(<ExercisesPage />)
    await waitFor(() => expect(findCardTitle('TED Talks')).toBeTruthy())

    expect(findCardTitle('TED Talks')?.closest('a')).toHaveAttribute('href', '/exercises/ex-2')
  })

  it('does not show an Admin entry for a non-admin user', async () => {
    render(<ExercisesPage />)
    await waitFor(() => expect(findCardTitle('TED Talks')).toBeTruthy())

    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
  })

  it('shows an Admin entry linking to /admin/exercises when the user is an admin', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ id: 'u1', email: 'admin@lychee.local', roles: ['Admin'] }), { status: 200 })
      }
      return new Response(JSON.stringify(exercises), { status: 200 })
    })

    render(<ExercisesPage />)
    await waitFor(() => expect(findCardTitle('TED Talks')).toBeTruthy())

    const adminLink = await screen.findByRole('link', { name: /admin/i })
    expect(adminLink).toHaveAttribute('href', '/admin/exercises')
  })
})
