'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChangePasswordModal } from './ChangePasswordModal'

type NavBarProps = {
  rankLabel: string
  activityDays: number // 0-7
  userInitial: string | null
}

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: 'Exercises', href: '/' },
  { label: 'Favorites', href: '/favorites' },
  { label: 'History', href: '/history' }
]

export function NavBar({ rankLabel, activityDays, userInitial }: NavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const activityLightness = 30 + (activityDays / 7) * 55 // 30% (darkest) to 85% (brightest)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)

  async function handleLogout() {
    setIsMenuOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        height: 60,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary-dark)' }}>
          Lychee
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 36, fontWeight: 800, fontSize: 15 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === pathname
          const linkStyle: React.CSSProperties = { color: isActive ? 'var(--primary-dark)' : 'var(--ink-soft)', textDecoration: 'none' }

          return (
            <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined} style={linkStyle}>
              {item.label}
            </Link>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink-soft)' }}>{rankLabel}</span>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-label={`${activityDays} of 7 active days`}>
          <circle cx={12} cy={14} r={8} fill={`oklch(${activityLightness}% 0.13 145)`} />
        </svg>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label="Account menu"
            aria-expanded={isMenuOpen}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              background: 'var(--primary-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: 'var(--primary-dark)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {userInitial ?? '?'}
          </button>

          {isMenuOpen && (
            <>
              <div
                onClick={() => setIsMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 10 }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 46,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  boxShadow: 'none',
                  minWidth: 160,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  zIndex: 11
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsChangePasswordOpen(true)
                  }}
                  style={{ textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}
                >
                  Change Password
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{ textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {isChangePasswordOpen && <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />}
    </div>
  )
}
