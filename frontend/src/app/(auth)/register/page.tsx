'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerAccount } from '@/lib/apiClient'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await registerAccount(email, password)
      router.push('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', padding: 24 }}>
      <h1>Create your account</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required minLength={8} placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
        <button type="submit">Create account</button>
      </form>
      <p>Already have an account? <a href="/login">Log in</a></p>
    </main>
  )
}
