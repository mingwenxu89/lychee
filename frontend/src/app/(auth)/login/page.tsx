'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginAccount } from '@/lib/apiClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await loginAccount(email, password)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', padding: 24 }}>
      <h1>Log in</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
        <button type="submit">Log in</button>
      </form>
      <a href="/api/auth/google/login-redirect">Continue with Google</a>
      <p>No account? <a href="/register">Register</a></p>
    </main>
  )
}
