type NavBarProps = {
  activePath: string
  rankLabel: string
  activityDays: number // 0-7
  userInitial: string | null
}

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: 'Exercises', href: '/' },
  { label: 'Favorites', href: '/favorites' },
  { label: 'History', href: '/history' }
]

export function NavBar({ activePath, rankLabel, activityDays, userInitial }: NavBarProps) {
  const activityLightness = 30 + (activityDays / 7) * 55 // 30% (darkest) to 85% (brightest)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        height: 76,
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
          const isActive = item.href === activePath
          return (
            <span
              key={item.href}
              aria-current={isActive ? 'page' : undefined}
              style={{ color: isActive ? 'var(--primary-dark)' : 'var(--ink-soft)' }}
            >
              {item.label}
            </span>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink-soft)' }}>{rankLabel}</span>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-label={`${activityDays} of 7 active days`}>
          <circle cx={12} cy={14} r={8} fill={`oklch(${activityLightness}% 0.13 145)`} />
        </svg>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            background: 'var(--primary-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            color: 'var(--primary-dark)'
          }}
        >
          {userInitial ?? '?'}
        </div>
      </div>
    </div>
  )
}
