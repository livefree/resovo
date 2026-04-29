/**
 * admin layout — AdminShell 装配（CHG-SN-2-12）
 *
 * 服务端组件职责：
 *   1. 读取 cookie：admin-sidebar-collapsed → defaultCollapsed
 *   2. 读取 cookie：resovo-theme → initialTheme（'system' 映射为 'dark'，admin dark-first）
 *   3. 读取 cookie：user_role → initialRole（middleware 鉴权后此 cookie 已存在）
 *   4. 渲染 <AdminShellClient>（'use client' 边界，持有 usePathname/useRouter）
 *
 * 不做：
 *   - 不调用 API 获取通知/任务（M-SN-2 stub；M-SN-3+ 在 AdminShellClient 或 RSC 边界补齐）
 *   - 不实现用户详情展示（M-SN-2 使用 mock user；M-SN-3+ 从 session/API 读取）
 */
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { AdminShellClient } from './admin-shell-client'
import { parseUserRole } from '@/lib/auth'
import { parseTheme } from '@/lib/brand-detection'

const COOKIE_COLLAPSED = 'admin-sidebar-collapsed'
const COOKIE_THEME = 'resovo-theme'
const COOKIE_USER_ROLE = 'user_role'

function parseDefaultCollapsed(raw: string | undefined): boolean {
  return raw === 'true'
}

function parseAdminTheme(raw: string | undefined): 'dark' | 'light' {
  const theme = parseTheme(raw)
  // 'system' 在 admin 映射为 'dark'（plan §4.3 / ADR-102 dark-first）
  return theme === 'light' ? 'light' : 'dark'
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()

  const defaultCollapsed = parseDefaultCollapsed(cookieStore.get(COOKIE_COLLAPSED)?.value)
  const initialTheme = parseAdminTheme(cookieStore.get(COOKIE_THEME)?.value)
  const rawRole = cookieStore.get(COOKIE_USER_ROLE)?.value
  const parsedRole = parseUserRole(rawRole)
  const initialRole: 'admin' | 'moderator' = parsedRole === 'moderator' ? 'moderator' : 'admin'

  return (
    <AdminShellClient
      defaultCollapsed={defaultCollapsed}
      initialTheme={initialTheme}
      initialRole={initialRole}
    >
      {children}
    </AdminShellClient>
  )
}
