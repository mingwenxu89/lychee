// frontend/src/lib/authCookie.ts
import { cookies } from 'next/headers'

export const AUTH_COOKIE_NAME = 'lychee_token'

export async function setAuthCookie(token: string, expiresAtUtc: string) {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAtUtc)
  })
}

export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE_NAME)
}
