// frontend/src/lib/backendClient.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { authenticatedFetch } from './backendClient'

describe('authenticatedFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))
  })

  it('attaches the Bearer token and forwards to the backend base URL', async () => {
    await authenticatedFetch('/api/admin/exercises', 'my-token', { method: 'GET' })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/admin/exercises',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' })
      })
    )
  })
})
