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
import { useCallback, useContext, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { AdminShell, inferBreadcrumbs } from '@resovo/admin-ui'
import type { AdminShellUser, NotificationItem, TaskItem, UserMenuAction } from '@resovo/admin-ui'
import { ThemeContext } from '@/contexts/BrandProvider'
import { ADMIN_NAV } from '@/lib/admin-nav'
import {
  adminNavCountProviderStub,
  buildTopbarIconsStub,
  healthSnapshotStub,
  mockNotifications,
  mockTasks,
} from '@/lib/shell-data'

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

export function AdminShellClient({ defaultCollapsed, initialTheme, initialRole, children }: AdminShellClientProps) {
  const rawPathname = usePathname()
  const pathname = rawPathname ?? '/admin'
  const router = useRouter()
  const themeContext = useContext(ThemeContext)

  const theme = themeContext?.resolvedTheme ?? initialTheme

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
    themeContext?.setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, themeContext])

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

  // CHG-DESIGN-05：notifications / tasks 用 useState 持有 mock 数据，4 个交互 callback
  // 真实修改 state，让点击产生可见反馈（演示完整 UI 交互通路）。
  // M-SN-4+ 接入 /admin/notifications + /admin/system/jobs 真端点时：
  //   - 数据源改 SWR hook 返回值（替代 useState 初始值）
  //   - callback 改调用对应 PATCH/POST 端点 + revalidate；本地乐观更新可保留
  const [notifications, setNotifications] = useState<readonly NotificationItem[]>(mockNotifications)
  const [tasks, setTasks] = useState<readonly TaskItem[]>(mockTasks)

  const handleNotificationItemClick = useCallback((item: NotificationItem) => {
    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)))
    if (item.href) router.push(item.href)
  }, [router])

  const handleMarkAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })))
  }, [])

  const handleCancelTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t
      return {
        ...t,
        status: 'failed' as const,
        finishedAt: new Date().toISOString(),
        errorMessage: '用户取消',
      }
    }))
  }, [])

  const handleRetryTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t
      // 重置为 running 形态：清掉 finishedAt / errorMessage，进度归零
      return {
        id: t.id,
        title: t.title,
        status: 'running' as const,
        progress: 0,
        startedAt: new Date().toISOString(),
      }
    }))
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
      notifications={notifications}
      tasks={tasks}
      onNavigate={handleNavigate}
      onThemeToggle={handleThemeToggle}
      onUserMenuAction={handleUserMenuAction}
      onCollapsedChange={handleCollapsedChange}
      onNotificationItemClick={handleNotificationItemClick}
      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      onCancelTask={handleCancelTask}
      onRetryTask={handleRetryTask}
    >
      {children}
    </AdminShell>
  )
}
