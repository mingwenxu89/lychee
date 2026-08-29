// frontend/src/app/api/admin/[...path]/route.test.ts
import { NextRequest } from 'next/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn()
}))

vi.mock('@/lib/backendClient', () => ({
  authenticatedFetch: vi.fn()
}))

import { cookies } from 'next/headers'
import { authenticatedFetch } from '@/lib/backendClient'
import { DELETE, GET, isNullBodyStatus } from './route'

describe('isNullBodyStatus', () => {
  it('is true for the null-body statuses (204, 205, 304)', () => {
    expect(isNullBodyStatus(204)).toBe(true)
    expect(isNullBodyStatus(205)).toBe(true)
    expect(isNullBodyStatus(304)).toBe(true)
  })

  it('is false for statuses that carry a body', () => {
    expect(isNullBodyStatus(200)).toBe(false)
    expect(isNullBodyStatus(201)).toBe(false)
    expect(isNullBodyStatus(400)).toBe(false)
    expect(isNullBodyStatus(404)).toBe(false)
    expect(isNullBodyStatus(500)).toBe(false)
  })
})

describe('admin proxy route handler', () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: 'my-token' })
    } as unknown as Awaited<ReturnType<typeof cookies>>)
  })

  it('does not throw and returns status 204 with no body for a DELETE that backends as 204 No Content', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(null, { status: 204 }))

    const request = new NextRequest('http://localhost:3000/api/admin/exercises/abc-123', { method: 'DELETE' })

    const response = await DELETE(request, { params: Promise.resolve({ path: ['exercises', 'abc-123'] }) })

    expect(response.status).toBe(204)
    const text = await response.text()
    expect(text).toBe('')
  })

  it('forwards status and JSON body for a normal GET response', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 'abc-123', name: 'Example' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const request = new NextRequest('http://localhost:3000/api/admin/exercises/abc-123', { method: 'GET' })

    const response = await GET(request, { params: Promise.resolve({ path: ['exercises', 'abc-123'] }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'abc-123', name: 'Example' })
  })
})
