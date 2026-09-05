'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginAccount } from '@/lib/apiClient'
import lycheeIcon from '@/app/icon.png'

const inputStyle: React.CSSProperties = {
  border: '2px solid var(--line)',
  borderRadius: 14,
  padding: '13px 16px',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--ink)',
  fontFamily: 'inherit'
}

const labelStyle: React.CSSProperties = { fontWeight: 800, fontSize: 13, color: 'var(--ink-faint)' }

const btnPrimary: React.CSSProperties = {
  background: 'var(--primary)',
  color: 'white',
  fontWeight: 800,
  fontSize: 15,
  border: 'none',
  borderRadius: 999,
  padding: '14px 28px',
  boxShadow: 'none',
  cursor: 'pointer',
  width: '100%'
}

const btnGhost: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'transparent',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 15,
  border: '2px solid var(--line)',
  borderRadius: 999,
  padding: '12px 28px',
  cursor: 'pointer',
  width: '100%',
  textDecoration: 'none'
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.54-5.17 3.54-8.73z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.12 0-5.76-2.1-6.7-4.93H1.3v3.1C3.27 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.32A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.39-2.32V6.58H1.3A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.3 5.42l4-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.27 2.7 1.3 6.58l4 3.1c.94-2.83 3.58-4.93 6.7-4.93z" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await loginAccount(email, password)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: 400, maxWidth: '100%', background: 'var(--surface)', borderRadius: 28, boxShadow: 'none', padding: '40px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center' }}>
          <img src={lycheeIcon.src} alt="Lychee" width={72} height={72} style={{ borderRadius: 16 }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Welcome back</h1>
          <span style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 }}>Log in to keep practicing</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="login-email" style={labelStyle}>Email</label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="login-password" style={labelStyle}>Password</label>
            <input
              id="login-password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0, fontSize: 14 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} style={btnPrimary}>
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-faint)' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        <a href="/api/auth/google/login-redirect" style={btnGhost}>
          <GoogleIcon />
          Continue with Google
        </a>

        <p style={{ margin: 0, textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 }}>
          No account?{' '}
          <Link href="/register" style={{ color: 'var(--ink)', textDecoration: 'underline', fontWeight: 800 }}>
            Register
          </Link>
        </p>
      </div>
    </main>
  )
}
