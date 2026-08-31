async function postJson(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(data.message ?? 'Request failed')
  }
}

export function registerAccount(email: string, password: string): Promise<void> {
  return postJson('/api/auth/register', { email, password })
}

export function loginAccount(email: string, password: string): Promise<void> {
  return postJson('/api/auth/login', { email, password })
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return postJson('/api/auth/change-password', { currentPassword, newPassword })
}
