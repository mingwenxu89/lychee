import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AUTH_COOKIE_NAME } from '@/lib/authCookie'
import { authenticatedFetch } from '@/lib/backendClient'
import { AdminNav } from './AdminNav'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) {
    redirect('/login')
  }

  const meResponse = await authenticatedFetch('/api/auth/me', token)
  if (!meResponse.ok) {
    redirect('/login')
  }

  const me: { roles: string[] } = await meResponse.json()
  if (!me.roles.includes('Admin')) {
    redirect('/')
  }

  return (
    <div>
      <AdminNav />
      {children}
    </div>
  )
}
