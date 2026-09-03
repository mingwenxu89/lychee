import { Fragment } from 'react'
import Link from 'next/link'
import { breadcrumbLinkStyle } from '@/lib/breadcrumbLinkStyle'

export type BreadcrumbItem = { label: string; href?: string }

export function AdminBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div
      style={{
        padding: '14px 40px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        fontWeight: 700,
        flexWrap: 'wrap'
      }}
    >
      {items.map((item, index) => (
        <Fragment key={item.href ?? item.label}>
          {index > 0 && <span style={{ color: 'var(--ink-faint)' }}>/</span>}
          {item.href ? (
            <Link href={item.href} style={breadcrumbLinkStyle}>
              {item.label}
            </Link>
          ) : (
            <span style={{ color: 'var(--ink)' }}>{item.label}</span>
          )}
        </Fragment>
      ))}
    </div>
  )
}
