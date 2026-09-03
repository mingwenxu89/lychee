import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/authCookie'
import { authenticatedFetch } from '@/lib/backendClient'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  const backendResponse = await authenticatedFetch('/api/auth/me', token)
  const body = await backendResponse.text()
  return new NextResponse(body, {
    status: backendResponse.status,
    headers: { 'Content-Type': 'application/json' }
  })
}
