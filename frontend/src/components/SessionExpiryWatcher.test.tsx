import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SessionExpiryWatcher, __resetForTests } from './SessionExpiryWatcher'

describe('SessionExpiryWatcher', () => {
  let originalFetch: typeof fetch
  let originalLocation: Location

  beforeEach(() => {
    __resetForTests()
    originalFetch = window.fetch
    originalLocation = window.location
    // window.location.href is not assignable in jsdom without this
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '', pathname: '/' },
      writable: true
    })
  })

  afterEach(() => {
    window.fetch = originalFetch
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('redirects to login when a /api/learner/ call returns 401', async () => {
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    render(<SessionExpiryWatcher />)

    await window.fetch('/api/learner/exercises')

    expect(window.location.href).toBe('/login?sessionExpired=1')
  })

  it('redirects to login when a /api/admin/ call returns 401', async () => {
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    render(<SessionExpiryWatcher />)

    await window.fetch('/api/admin/exercises')

    expect(window.location.href).toBe('/login?sessionExpired=1')
  })

  it('does not redirect for a 401 from /api/auth/ (wrong credentials, not session expiry)', async () => {
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    render(<SessionExpiryWatcher />)

    await window.fetch('/api/auth/login')

    expect(window.location.href).toBe('')
  })

  it('does not redirect for a non-401 response', async () => {
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    render(<SessionExpiryWatcher />)

    await window.fetch('/api/learner/exercises')

    expect(window.location.href).toBe('')
  })

  it('does not redirect again if already on the login page', async () => {
    window.location.pathname = '/login'
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    render(<SessionExpiryWatcher />)

    await window.fetch('/api/learner/exercises')

    expect(window.location.href).toBe('')
  })

  it('still returns the original response to the caller', async () => {
    const body = JSON.stringify({ message: 'Not authenticated' })
    window.fetch = vi.fn().mockResolvedValue(new Response(body, { status: 401 }))
    render(<SessionExpiryWatcher />)

    const response = await window.fetch('/api/learner/exercises')

    expect(response.status).toBe(401)
    expect(await response.text()).toBe(body)
  })
})
