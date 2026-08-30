import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn()
}))
vi.mock('@/lib/backendClient', () => ({
  authenticatedFetch: vi.fn()
}))

import { cookies } from 'next/headers'
import { authenticatedFetch } from '@/lib/backendClient'
import { GET, DELETE } from './route'

function makeRequest(url: string, method = 'GET') {
  return { method, nextUrl: new URL(url), headers: new Headers(), text: async () => '', formData: async () => new FormData() } as never
}

describe('learner proxy route', () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: 'test-token' }) } as never)
  })

  it('returns a null body for a 204 response without throwing', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(null, { status: 204 }))

    const response = await DELETE(makeRequest('http://localhost/api/learner/tracks/1/practice-session', 'DELETE'), {
      params: Promise.resolve({ path: ['tracks', '1', 'practice-session'] })
    })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })

  it('forwards the query string to the backend path', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await GET(makeRequest('http://localhost/api/learner/tracks/1?mode=full'), {
      params: Promise.resolve({ path: ['tracks', '1'] })
    })

    expect(authenticatedFetch).toHaveBeenCalledWith('/api/learner/tracks/1?mode=full', 'test-token', expect.anything())
  })

  it('returns 401 when there is no auth cookie', async () => {
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as never)

    const response = await GET(makeRequest('http://localhost/api/learner/tracks/1'), {
      params: Promise.resolve({ path: ['tracks', '1'] })
    })

    expect(response.status).toBe(401)
  })
})
