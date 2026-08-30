import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NavBar } from './NavBar'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn()
}))

import { usePathname } from 'next/navigation'

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
})
