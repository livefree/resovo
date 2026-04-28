import type { ReactNode } from 'react'
import Link from 'next/link'
import { ADMIN_NAV } from '@/lib/admin-nav'

/**
 * admin shell layout — 极简骨架（M-SN-1 占位）
 *
 * M-SN-2 起步：完整 shell（用户菜单、主题切换、面包屑、命令面板等）下沉到
 * packages/admin-ui Shell 组件。本卡仅满足 27 路由可跳转 + admin-layout
 * token (--sidebar-w / --topbar-h) 视觉验证。
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'var(--sidebar-w) 1fr',
        gridTemplateRows: 'var(--topbar-h) 1fr',
        gridTemplateAreas: '"sidebar topbar" "sidebar main"',
        minHeight: '100vh',
      }}
    >
      <header
        style={{
          gridArea: 'topbar',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-4)',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
        }}
      >
        <strong>Resovo Admin</strong>
        <span style={{ marginLeft: 'var(--space-3)', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm)' }}>
          M-SN-1 工程骨架
        </span>
      </header>

      <nav
        style={{
          gridArea: 'sidebar',
          padding: 'var(--space-3) var(--space-2)',
          borderRight: '1px solid var(--border-default)',
          background: 'var(--bg-surface-sunken)',
          overflowY: 'auto',
        }}
      >
        {ADMIN_NAV.map((section) => (
          <div key={section.title} style={{ marginBottom: 'var(--space-4)' }}>
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--fg-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: 'var(--space-1) var(--space-2)',
              }}
            >
              {section.title}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    style={{
                      display: 'block',
                      padding: 'var(--space-2)',
                      color: 'var(--fg-default)',
                      textDecoration: 'none',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <ul style={{ listStyle: 'none', margin: 0, paddingLeft: 'var(--space-4)' }}>
                      {item.children.map((c) => (
                        <li key={c.href}>
                          <Link
                            href={c.href}
                            style={{
                              display: 'block',
                              padding: 'var(--space-1) var(--space-2)',
                              color: 'var(--fg-muted)',
                              textDecoration: 'none',
                              fontSize: 'var(--font-size-sm)',
                            }}
                          >
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <main style={{ gridArea: 'main', padding: 'var(--space-5)', overflow: 'auto' }}>{children}</main>
    </div>
  )
}
