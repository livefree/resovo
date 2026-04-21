'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

interface MenuItem {
  href: string
  label: string
  icon: string
}

const CONTENT_MENU: MenuItem[] = [
  { href: '/admin/moderation', label: '内容审核台', icon: '🔍' },
  { href: '/admin/staging', label: '暂存发布队列', icon: '📤' },
  { href: '/admin/videos', label: '视频管理', icon: '🎬' },
  { href: '/admin/sources', label: '播放源管理', icon: '🔗' },
  { href: '/admin/content', label: '内容审核', icon: '📝' },
  { href: '/admin/banners', label: 'Banner 管理', icon: '🖼️' },
]

const SYSTEM_MENU: MenuItem[] = [
  { href: '/admin/crawler', label: '采集控制台', icon: '🕷️' },
  { href: '/admin/system/settings', label: '站点配置', icon: '⚙️' },
  { href: '/admin/users', label: '用户管理', icon: '👤' },
  { href: '/admin/analytics', label: '数据看板', icon: '📊' },
  { href: '/admin/image-health', label: '图片健康', icon: '🖼️' },
  { href: '/admin/fallback-preview', label: '样板图预览', icon: '🎨' },
]

function SidebarLink({ item, collapsed }: { item: MenuItem; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className="block rounded-md px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg3)] hover:text-[var(--accent)] transition-colors"
      data-testid={`admin-sidebar-link-${item.href.replace(/\//g, '-')}`}
    >
      <span className="inline-flex items-center gap-2">
        <span aria-hidden>{item.icon}</span>
        {!collapsed && <span>{item.label}</span>}
      </span>
    </Link>
  )
}

function SidebarSection({
  title,
  items,
  collapsed,
}: {
  title: string
  items: MenuItem[]
  collapsed: boolean
}) {
  return (
    <section className="mb-6">
      {!collapsed && (
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {title}
        </p>
      )}
      <nav className="space-y-0.5">
        {items.map((item) => (
          <SidebarLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </section>
  )
}

export function AdminSidebar({ isAdmin }: { isAdmin: boolean }) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    logout()
    router.push('/admin/login')
  }

  useEffect(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('admin-sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-56'} relative flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg2)] px-3 py-6 transition-[width] duration-200`}
      data-testid="admin-sidebar"
    >
      <div className="mb-6 px-1">
        <Link href="/admin" className="text-lg font-bold text-[var(--accent)]">
          {collapsed ? '流' : '流光后台'}
        </Link>
      </div>

      <button
        type="button"
        onClick={toggleCollapsed}
        className="absolute right-0 top-16 z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--border)] bg-[var(--bg2)] text-xs text-[var(--muted)] shadow-sm transition-colors hover:text-[var(--text)]"
        data-testid="admin-sidebar-collapse-toggle"
        aria-label={collapsed ? '展开侧栏' : '收窄侧栏'}
        title={collapsed ? '展开侧栏' : '收窄侧栏'}
      >
        {collapsed ? '»' : '«'}
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex min-h-full flex-col">
          <SidebarSection title="内容管理" items={CONTENT_MENU} collapsed={collapsed} />
          {isAdmin && <SidebarSection title="系统管理" items={SYSTEM_MENU} collapsed={collapsed} />}

          <div className="mt-auto pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={handleLogout}
              data-testid="admin-logout"
              title={collapsed ? '登出' : undefined}
              className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--bg3)] hover:text-[var(--text)]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <span aria-hidden>⏻</span>
              {!collapsed && <span>登出</span>}
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
