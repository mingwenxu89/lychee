import { NextResponse } from 'next/server'
import { loginUser, BackendAuthError } from '@/lib/backendClient'
import { setAuthCookie } from '@/lib/authCookie'

export async function POST(request: Request) {
  const { email, password } = await request.json()
  try {
    const { token, expiresAtUtc } = await loginUser(email, password)
    await setAuthCookie(token, expiresAtUtc)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 })
  }
}
