/**
 * /admin layout — 后台布局
 * ADR-010: 侧边栏按角色动态显示（moderator 不显示系统管理区）
 *
 * 从 user_role cookie 读取角色（非 HttpOnly，Next.js 服务端 cookies() 可读）
 */

import { cookies } from 'next/headers'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

// ── 布局 ──────────────────────────────────────────────────────────

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value ?? 'moderator'
  const isAdmin = userRole === 'admin'

  return (
    <div
      className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]"
      data-testid="admin-layout"
    >
      <AdminSidebar isAdmin={isAdmin} />

      {/* ── 主内容区 ─────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}
