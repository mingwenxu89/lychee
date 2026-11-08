import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LoginPage from './page'

const mockSearchParams = { get: vi.fn().mockReturnValue(null) }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mockSearchParams
}))

describe('LoginPage', () => {
  it('does not show the session-expired banner by default', () => {
    mockSearchParams.get.mockReturnValue(null)
    render(<LoginPage />)

    expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
  })

  it('shows the session-expired banner when redirected with ?sessionExpired=1', () => {
    mockSearchParams.get.mockReturnValue('1')
    render(<LoginPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired. Please log in again.')
  })
})
