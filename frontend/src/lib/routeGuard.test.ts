// frontend/src/lib/routeGuard.test.ts
import { describe, expect, it } from 'vitest'
import { shouldRedirectToLogin } from './routeGuard'

describe('shouldRedirectToLogin', () => {
  it('does not redirect from /login even when unauthenticated', () => {
    expect(shouldRedirectToLogin('/login', false)).toBe(false)
  })

  it('does not redirect from /register even when unauthenticated', () => {
    expect(shouldRedirectToLogin('/register', false)).toBe(false)
  })

  it('does not redirect from /auth/callback even when unauthenticated', () => {
    expect(shouldRedirectToLogin('/auth/callback', false)).toBe(false)
  })

  it('redirects from a protected route when unauthenticated', () => {
    expect(shouldRedirectToLogin('/favorites', false)).toBe(true)
  })

  it('does not redirect from a protected route when authenticated', () => {
    expect(shouldRedirectToLogin('/favorites', true)).toBe(false)
  })
})
