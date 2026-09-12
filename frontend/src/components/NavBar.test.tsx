import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NavBar } from './NavBar'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ push: mockPush, refresh: mockRefresh })
}))

import { usePathname } from 'next/navigation'

beforeEach(() => {
  mockPush.mockClear()
  mockRefresh.mockClear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })))
})

describe('NavBar', () => {
  it('renders all three nav sections and highlights the active one', () => {
    vi.mocked(usePathname).mockReturnValue('/favorites')
    render(<NavBar rankLabel="Bloom" activityDays={4} userInitial="M" />)

    expect(screen.getByText('Exercises')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Exercises')).not.toHaveAttribute('aria-current')
  })

  it('shows the rank label, not a raw rank number', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<NavBar rankLabel="Bloom" activityDays={4} userInitial="M" />)
    expect(screen.getByText('Bloom')).toBeInTheDocument()
    expect(screen.queryByText(/Rank 3/i)).not.toBeInTheDocument()
  })

  it("renders the user's avatar initial", () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<NavBar rankLabel="Seedling" activityDays={0} userInitial="M" />)
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('links each nav item to its real route', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<NavBar rankLabel="Seedling" activityDays={0} userInitial="M" />)
    expect(screen.getByText('Exercises').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('Favorites').closest('a')).toHaveAttribute('href', '/favorites')
    expect(screen.getByText('History').closest('a')).toHaveAttribute('href', '/history')
  })

  it('opens an account dropdown with Change Password and Log out when the avatar is clicked', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<NavBar rankLabel="Seedling" activityDays={0} userInitial="M" />)

    expect(screen.queryByText('Log out')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getByText('Log out')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument()
  })

  it('opens the Change Password modal from the dropdown', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<NavBar rankLabel="Seedling" activityDays={0} userInitial="M" />)

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))

    expect(screen.getByPlaceholderText('Current password')).toBeInTheDocument()
  })

  it('opens the Translation Language modal from the dropdown', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<NavBar rankLabel="Seedling" activityDays={0} userInitial="M" />)

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Translation Language' }))

    expect(screen.getByRole('heading', { name: 'Translation Language' })).toBeInTheDocument()
  })

  it('logs out and redirects to /login when Log out is clicked', async () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<NavBar rankLabel="Seedling" activityDays={0} userInitial="M" />)

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    fireEvent.click(screen.getByText('Log out'))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' }))
    expect(mockPush).toHaveBeenCalledWith('/login')
  })
})
