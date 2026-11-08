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
  // Every /api/ route already authenticates itself and returns a proper JSON 401 when the
  // session cookie is missing/expired — redirecting an API call here instead would make fetch()
  // silently follow the redirect and hand the caller a 200 OK with the login page's HTML body
  // (fetch() follows redirects transparently), instead of the 401 callers actually check for.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)']
}
