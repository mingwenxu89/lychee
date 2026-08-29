import { NextResponse } from 'next/server'
import { registerUser, BackendAuthError } from '@/lib/backendClient'

export async function POST(request: Request) {
  const { email, password } = await request.json()
  try {
    await registerUser(email, password)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 })
  }
}
