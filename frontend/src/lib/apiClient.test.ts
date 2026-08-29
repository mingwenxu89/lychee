import { describe, expect, it, vi, beforeEach } from 'vitest'
import { registerAccount, loginAccount } from './apiClient'

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('registerAccount posts to /api/auth/register and resolves on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }))

    await expect(registerAccount('a@example.test', 'password123')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({ method: 'POST' }))
  })

  it('registerAccount throws with the server message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Email already taken' }), { status: 400 }))

    await expect(registerAccount('a@example.test', 'password123')).rejects.toThrow('Email already taken')
  })

  it('loginAccount posts to /api/auth/login and resolves on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }))

    await expect(loginAccount('a@example.test', 'password123')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }))
  })
})
