// frontend/src/lib/routeGuard.ts
const PUBLIC_PATHS = ['/login', '/register', '/auth/callback']

export function shouldRedirectToLogin(pathname: string, hasAuthCookie: boolean): boolean {
  if (hasAuthCookie) return false
  return !PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath))
}
