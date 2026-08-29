import { NextResponse } from 'next/server'

export async function GET() {
  const backendUrl = process.env.BACKEND_API_URL ?? 'http://localhost:5000'
  return NextResponse.redirect(`${backendUrl}/api/auth/google/login`)
}
