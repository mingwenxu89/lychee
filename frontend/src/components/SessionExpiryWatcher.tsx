'use client'

import { useEffect } from 'react'

let isPatched = false

function isProtectedApiUrl(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  return url.startsWith('/api/learner/') || url.startsWith('/api/admin/')
}

// Test-only: undoes the module-level patch guard so each test file gets a fresh wrap.
export function __resetForTests() {
  isPatched = false
}

// Every learner/admin page fetches its own data ad hoc, with its own "Failed to load X"
// handling — none of them distinguish an expired session from a generic network error, so a
// learner whose token expires mid-session just sees a vague error with no way forward. This
// patches window.fetch once, app-wide, to catch that one specific case (a 401 from OUR OWN
// learner/admin proxy routes, not /api/auth/ itself, which legitimately 401s on a wrong
// password) and send the learner to a clear "log in again" screen instead.
export function SessionExpiryWatcher() {
  useEffect(() => {
    if (isPatched) return
    isPatched = true

    const originalFetch = window.fetch
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args)
      if (response.status === 401 && isProtectedApiUrl(args[0]) && window.location.pathname !== '/login') {
        window.location.href = '/login?sessionExpired=1'
      }
      return response
    }
  }, [])

  return null
}
