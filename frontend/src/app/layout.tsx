import type { ReactNode } from 'react'
import '@/styles/tokens.css'
import { NavBar } from '@/components/NavBar'

export const metadata = { title: 'Lychee English' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar rankLabel="Seedling" activityDays={0} userInitial={null} />
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>
      </body>
    </html>
  )
}
