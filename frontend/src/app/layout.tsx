import type { ReactNode } from 'react'
import '@/styles/tokens.css'
import { NavBar } from '@/components/NavBar'

export const metadata = { title: 'Lychee' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar rankLabel="Seedling" activityDays={0} userInitial={null} />
        {children}
      </body>
    </html>
  )
}
