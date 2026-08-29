// Used only by the Google OAuth callback bridge page (see auth/callback/page.tsx):
// the backend redirects the browser to that page with ?token=..., and this route is
// how that page hands the token to a route handler so it can be set as an httpOnly cookie.
import { NextResponse } from 'next/server'
import { setAuthCookie } from '@/lib/authCookie'

export async function POST(request: Request) {
  const { token } = await request.json()
  if (!token) {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 })
  }
  // The backend issues 7-day tokens (Jwt:ExpiryDays); mirror that here since the
  // Google callback redirect doesn't separately carry an expiry timestamp.
  const expiresAtUtc = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await setAuthCookie(token, expiresAtUtc)
  return NextResponse.json({ ok: true })
}
