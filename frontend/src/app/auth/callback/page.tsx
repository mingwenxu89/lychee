'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function GoogleCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('Missing token from Google sign-in.')
      return
    }
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then((response) => {
        if (!response.ok) throw new Error('Could not complete sign-in.')
        router.push('/')
      })
      .catch((err) => setError(err.message))
  }, [router, searchParams])

  return <>{error ? <p role="alert">{error}</p> : <p>Signing you in…</p>}</>
}

export default function GoogleCallbackPage() {
  return (
    <main style={{ padding: 40 }}>
      <Suspense fallback={<p>Signing you in…</p>}>
        <GoogleCallbackContent />
      </Suspense>
    </main>
  )
}
