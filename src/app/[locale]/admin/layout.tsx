/**
 * /admin layout — 后台布局
 * ADR-010: 侧边栏按角色动态显示（moderator 不显示系统管理区）
 *
 * 从 user_role cookie 读取角色（非 HttpOnly，Next.js 服务端 cookies() 可读）
 */

import { cookies } from 'next/headers'
import Link from 'next/link'

// ── 菜单配置 ──────────────────────────────────────────────────────

const CONTENT_MENU = [
  { href: '/admin/videos', label: '视频管理' },
  { href: '/admin/sources', label: '播放源管理' },
  { href: '/admin/submissions', label: '投稿审核' },
  { href: '/admin/subtitles', label: '字幕审核' },
]

const SYSTEM_MENU = [
  { href: '/admin/users', label: '用户管理' },
  { href: '/admin/crawler', label: '爬虫管理' },
  { href: '/admin/analytics', label: '数据看板' },
]

// ── 侧边栏 ────────────────────────────────────────────────────────

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg3)] hover:text-[var(--accent)] transition-colors"
    >
      {label}
    </Link>
  )
}

function SidebarSection({
  title,
  items,
}: {
  title: string
  items: { href: string; label: string }[]
}) {
  return (
    <section className="mb-6">
      <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </p>
      <nav className="space-y-0.5">
        {items.map((item) => (
          <SidebarLink key={item.href} href={item.href} label={item.label} />
        ))}
      </nav>
    </section>
  )
}

// ── 布局 ──────────────────────────────────────────────────────────

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value ?? 'moderator'
  const isAdmin = userRole === 'admin'

  return (
    <div
      className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]"
      data-testid="admin-layout"
    >
      {/* ── 侧边栏 ─────────────────────────────────────────────── */}
      <aside
        className="w-56 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg2)] px-3 py-6"
        data-testid="admin-sidebar"
      >
        <Link
          href="/admin"
          className="mb-6 flex items-center gap-2 px-3 text-lg font-bold text-[var(--accent)]"
        >
          流光后台
        </Link>

        <SidebarSection title="内容管理" items={CONTENT_MENU} />

        {/* 系统管理区：仅 admin 可见 */}
        {isAdmin && (
          <SidebarSection
            title="系统管理"
            items={SYSTEM_MENU}
          />
        )}

        {/* 返回前台 */}
        <div className="mt-auto pt-4 border-t border-[var(--border)]">
          <Link
            href="/"
            data-testid="admin-back-to-site"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--bg3)] hover:text-[var(--text)]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            ← 返回前台
          </Link>
        </div>
      </aside>

      {/* ── 主内容区 ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
