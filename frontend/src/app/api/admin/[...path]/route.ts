import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/authCookie'
import { authenticatedFetch } from '@/lib/backendClient'

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  const backendPath = `/api/admin/${path.join('/')}`
  const isBodyMethod = request.method !== 'GET' && request.method !== 'DELETE'
  const contentType = request.headers.get('content-type') ?? ''

  const init: RequestInit = { method: request.method }
  if (isBodyMethod) {
    if (contentType.includes('multipart/form-data')) {
      init.body = await request.formData()
    } else {
      init.body = await request.text()
      init.headers = { 'Content-Type': 'application/json' }
    }
  }

  const backendResponse = await authenticatedFetch(backendPath, token, init)
  const responseBody = await backendResponse.text()
  return new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: { 'Content-Type': backendResponse.headers.get('content-type') ?? 'application/json' }
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path)
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path)
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path)
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path)
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path)
}
