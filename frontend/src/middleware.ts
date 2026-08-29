// frontend/src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/authCookie'
import { shouldRedirectToLogin } from '@/lib/routeGuard'

export function middleware(request: NextRequest) {
  const hasAuthCookie = request.cookies.has(AUTH_COOKIE_NAME)

  if (shouldRedirectToLogin(request.nextUrl.pathname, hasAuthCookie)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)']
}
