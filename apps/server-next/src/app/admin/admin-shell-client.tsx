'use client'
/**
 * admin-shell-client.tsx — AdminShell 客户端边界层（apps/server-next admin）
 *
 * 职责（CHG-SN-2-12）：
 *   - 持有 Next.js 客户端依赖（usePathname / useRouter）
 *   - 接收服务端序列化 props（defaultCollapsed / initialTheme / initialRole）
 *   - 派生 activeHref / crumbs / topbarIcons / onNavigate 等 AdminShell 所需 props
 *   - 主题切换状态管理（useState + cookie 写入）
 *   - 渲染 <AdminShell>（packages/admin-ui）
 *
 * 约束：
 *   - 函数回调不可从 server component 直接传入；必须在此 'use client' 边界层构建
 *   - 数据 stub（notifications / tasks / user）在 M-SN-2 阶段使用 mock；M-SN-3+ 接入真实端点
 */
import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { AdminShell, inferBreadcrumbs } from '@resovo/admin-ui'
import type { AdminShellUser, UserMenuAction } from '@resovo/admin-ui'
import { ADMIN_NAV } from '@/lib/admin-nav'
import { buildTopbarIconsStub, healthSnapshotStub, adminNavCountProviderStub } from '@/lib/shell-data'

export interface AdminShellClientProps {
  readonly defaultCollapsed: boolean
  readonly initialTheme: 'dark' | 'light'
  readonly initialRole: 'admin' | 'moderator'
  readonly children: ReactNode
}

const MOCK_USER_BASE = {
  id: 'u-stub',
  displayName: '管理员',
  email: 'admin@resovo.io',
} satisfies Omit<AdminShellUser, 'role'>

const COOKIE_COLLAPSED = 'admin-sidebar-collapsed'
const COOKIE_THEME = 'resovo-theme'

export function AdminShellClient({ defaultCollapsed, initialTheme, initialRole, children }: AdminShellClientProps) {
  const rawPathname = usePathname()
  const pathname = rawPathname ?? '/admin'
  const router = useRouter()

  const [theme, setTheme] = useState<'dark' | 'light'>(initialTheme)

  const user: AdminShellUser = useMemo(() => ({
    ...MOCK_USER_BASE,
    role: initialRole,
  }), [initialRole])

  const crumbs = useMemo(() => inferBreadcrumbs(pathname, ADMIN_NAV), [pathname])

  const topbarIcons = useMemo(() => buildTopbarIconsStub(theme), [theme])

  const handleNavigate = useCallback((href: string) => {
    router.push(href)
  }, [router])

  const handleThemeToggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.cookie = `${COOKIE_THEME}=${next}; path=/; max-age=31536000; SameSite=Lax`
      return next
    })
  }, [])

  const handleUserMenuAction = useCallback((action: UserMenuAction) => {
    switch (action) {
      case 'theme':
        handleThemeToggle()
        break
      case 'logout':
        router.push('/login')
        break
      case 'profile':
      case 'preferences':
      case 'help':
      case 'switchAccount':
        // M-SN-2 stub：noop（M-SN-3+ 接入真实端点）
        break
    }
  }, [handleThemeToggle, router])

  const handleCollapsedChange = useCallback((next: boolean) => {
    document.cookie = `${COOKIE_COLLAPSED}=${next}; path=/; max-age=31536000; SameSite=Lax`
  }, [])

  return (
    <AdminShell
      nav={ADMIN_NAV}
      activeHref={pathname}
      crumbs={crumbs.length > 0 ? crumbs : undefined}
      topbarIcons={topbarIcons}
      health={healthSnapshotStub}
      countProvider={adminNavCountProviderStub}
      user={user}
      theme={theme}
      defaultCollapsed={defaultCollapsed}
      // notifications / tasks 不传（undefined）→ M-SN-2 stub：图标禁用，Drawer 不挂载（§4.1.1 契约）
      // M-SN-3+ 接入真实端点后将替换为 SWR hook 返回值
      onNavigate={handleNavigate}
      onThemeToggle={handleThemeToggle}
      onUserMenuAction={handleUserMenuAction}
      onCollapsedChange={handleCollapsedChange}
    >
      {children}
    </AdminShell>
  )
}
