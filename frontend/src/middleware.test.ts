// frontend/src/middleware.test.ts
import { describe, expect, it } from 'vitest'
import { config } from './middleware'

// Next.js compiles config.matcher patterns with path-to-regexp, but this pattern uses only
// plain regex syntax (a negative lookahead), so it can be tested directly as a JS RegExp.
const matcherRegex = new RegExp(`^${config.matcher[0]}$`)

describe('middleware matcher', () => {
  it('does not match /api/learner/* (must reach the route handler for its own JSON 401)', () => {
    expect(matcherRegex.test('/api/learner/exercises')).toBe(false)
  })

  it('does not match /api/admin/* (must reach the route handler for its own JSON 401)', () => {
    expect(matcherRegex.test('/api/admin/tracks')).toBe(false)
  })

  it('does not match /api/auth/*', () => {
    expect(matcherRegex.test('/api/auth/logout')).toBe(false)
  })

  it('matches a regular page route', () => {
    expect(matcherRegex.test('/favorites')).toBe(true)
  })

  it('does not match _next/static or favicon.ico', () => {
    expect(matcherRegex.test('/_next/static/chunk.js')).toBe(false)
    expect(matcherRegex.test('/favicon.ico')).toBe(false)
  })
})
