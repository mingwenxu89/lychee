import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NavBar } from './NavBar'

describe('NavBar', () => {
  it('renders all three nav sections and highlights the active one', () => {
    render(<NavBar activePath="/favorites" rankLabel="Bloom" activityDays={4} userInitial="M" />)

    expect(screen.getByText('Exercises')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Exercises')).not.toHaveAttribute('aria-current')
  })

  it('shows the rank label, not a raw rank number', () => {
    render(<NavBar activePath="/" rankLabel="Bloom" activityDays={4} userInitial="M" />)
    expect(screen.getByText('Bloom')).toBeInTheDocument()
    expect(screen.queryByText(/Rank 3/i)).not.toBeInTheDocument()
  })

  it("renders the user's avatar initial", () => {
    render(<NavBar activePath="/" rankLabel="Seedling" activityDays={0} userInitial="M" />)
    expect(screen.getByText('M')).toBeInTheDocument()
  })
})
