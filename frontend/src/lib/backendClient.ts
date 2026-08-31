// frontend/src/lib/backendClient.ts
// Server-only: calls the .NET API directly. Never import this from a client component —
// it is what keeps the JWT out of browser JS (see authCookie.ts for the client-facing half).

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://localhost:5000'

export class BackendAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function registerUser(email: string, password: string): Promise<void> {
  const response = await fetch(`${BACKEND_API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!response.ok) {
    const errors = await response.json().catch(() => [])
    throw new BackendAuthError(response.status, Array.isArray(errors) ? errors.join(', ') : 'Registration failed')
  }
}

export async function loginUser(email: string, password: string): Promise<{ token: string; expiresAtUtc: string }> {
  const response = await fetch(`${BACKEND_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!response.ok) {
    throw new BackendAuthError(response.status, 'Invalid email or password')
  }
  return response.json()
}

export async function changeUserPassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  const response = await authenticatedFetch('/api/auth/change-password', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword })
  })
  if (!response.ok) {
    const errors = await response.json().catch(() => [])
    throw new BackendAuthError(response.status, Array.isArray(errors) ? errors.join(', ') : 'Failed to change password')
  }
}

export async function authenticatedFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BACKEND_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
  })
}
