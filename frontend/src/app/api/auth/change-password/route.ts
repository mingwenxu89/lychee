import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/authCookie'
import { changeUserPassword, BackendAuthError } from '@/lib/backendClient'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  const { currentPassword, newPassword } = await request.json()
  try {
    await changeUserPassword(token, currentPassword, newPassword)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 })
  }
}
