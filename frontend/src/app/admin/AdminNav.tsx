'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: { label: string; href: string }[] = [
  { label: 'Exercises', href: '/admin/exercises' },
  { label: 'Quotes', href: '/admin/quotes' }
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <div style={{ padding: '14px 40px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'inline-flex', gap: 6, background: 'oklch(90% 0.012 80)', padding: 6, borderRadius: 999 }}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                background: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? 'var(--primary-dark)' : 'var(--ink-soft)',
                fontWeight: 800,
                fontSize: 14,
                textDecoration: 'none'
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
