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
import { AdminShell, inferBreadcrumbs, useToast } from '@resovo/admin-ui'
import type { AdminNavSection, AdminShellUser, NotificationItem, UserMenuAction } from '@resovo/admin-ui'
// CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-B / ADR-147：admin shell 通知 + 任务真端点
// ADR-155 D-155-2 / EP-2：useAdminNotifications + useAdminTasks 内部已合并 background events
// （并发 GET /admin/notifications + /admin/system/background-events），不再需要独立 BackgroundEventBell
import { useAdminNotifications, useAdminTasks } from '@/lib/admin-shell-notifications'
import { UserMenuActionModal, type UserMenuActionModalType } from './_client/UserMenuActionModal'
import { ThemeContext } from '@/contexts/BrandProvider'
import { ADMIN_NAV } from '@/lib/admin-nav'

// CHG-SN-8-GAPS-AUDIT-NAV-HIDE：后端 /admin/users + /admin/system/settings 全 adminOnly；
// moderator 进这些 href 点击 → API 403 → 死链。消费层 nav 过滤。
// CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP（ADR-142）：/admin/audit 已恢复 moderator self-scope，
// 从本 Set 移除；前端 moderator 看 audit 页面时显 "仅显示你的操作记录" info banner。
const ADMIN_ONLY_HREFS: ReadonlySet<string> = new Set(['/admin/users', '/admin/settings'])

function filterNavForRole(
  nav: readonly AdminNavSection[],
  role: AdminShellUser['role'],
): readonly AdminNavSection[] {
  if (role === 'admin') return nav
  return nav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !ADMIN_ONLY_HREFS.has(item.href)),
    }))
    .filter((section) => section.items.length > 0)
}
import {
  buildTopbarIconsStub,
  healthSnapshotStub,
} from '@/lib/shell-data'
// CHG-VIR-13-A1：countProvider 实接（merge pending 候选总数 60s 轮询，替换 stub）
import { useAdminNavCounts } from '@/lib/admin-shell-nav-counts'
import { apiClient } from '@/lib/api-client'

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

  const navForRole = useMemo(() => filterNavForRole(ADMIN_NAV, initialRole), [initialRole])

  const crumbs = useMemo(() => inferBreadcrumbs(pathname, ADMIN_NAV), [pathname])

  const topbarIcons = useMemo(() => buildTopbarIconsStub(theme), [theme])

  // CHG-VIR-13-A1：merge pending 候选总数 60s 轮询 → countProvider（runtime 优先于静态 count）
  const navCountProvider = useAdminNavCounts()

  const handleNavigate = useCallback((href: string) => {
    router.push(href)
  }, [router])

  const handleThemeToggle = useCallback(() => {
    themeContext?.setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, themeContext])

  // CHG-SN-8-FUP-USER-MENU：4 noop action → Modal/Toast 反馈
  const [actionModalType, setActionModalType] = useState<UserMenuActionModalType | null>(null)
  const toast = useToast()

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
        setActionModalType(action as UserMenuActionModalType)
        break
      case 'switchAccount':
        toast.push({
          title: '多账号切换筹备中',
          description: '当前一个浏览器仅支持一个登录态；多账号切换功能在 M-SN-N 实装',
          level: 'info',
        })
        break
    }
  }, [handleThemeToggle, router, toast])

  const handleCollapsedChange = useCallback((next: boolean) => {
    document.cookie = `${COOKIE_COLLAPSED}=${next}; path=/; max-age=31536000; SameSite=Lax`
  }, [])

  // CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-B / ADR-147 D-147-2/4：60s polling + localStorage read
  // notifications：read 状态由 useAdminNotifications 内部用 lastViewedAt 计算
  // tasks：仅读，cancel/retry 端点 N1-147-4 待立（按需启动）
  // ADR-155 D-155-2 / EP-2：notifications + tasks 数据流已合并 background events 三源
  // （upcoming/finished → category='background' / active → source='crawler'），
  // 无需独立 useAdminBackgroundEvents hook + BackgroundEventBell 旁路
  // ADR-196 D-196-5②：红点改读 unread-count（SSE 实时 + 端点 fallback）；items 仍供 drawer
  const { items: notifications, unreadCount: notificationUnreadCount, markAllRead, markOneRead } = useAdminNotifications()
  const { items: tasks, reload: reloadTasks } = useAdminTasks()

  const handleNotificationItemClick = useCallback((item: NotificationItem) => {
    markOneRead(item.id)
    if (item.href) router.push(item.href)
  }, [markOneRead, router])

  const handleMarkAllNotificationsRead = useCallback(() => {
    markAllRead()
  }, [markAllRead])

  // NTLG-P0-3-B / ADR-191：CrawlerRun + bull job cancel/retry 真实接线（补 N1-147-4）。
  // POST /admin/tasks/:id/{cancel,retry} 按 id 分派（裸 UUID=crawler run / bull-{queue}-{jobId}=bull job）；
  // 成功 → success toast + reload 刷新抽屉；失败 → danger toast 透传后端 message（含 409 文案，如运行中作业不可取消）。
  const handleCancelTask = useCallback((taskId: string) => {
    void (async () => {
      try {
        await apiClient.post(`/admin/tasks/${encodeURIComponent(taskId)}/cancel`, {})
        toast.push({ title: '已请求取消任务', level: 'success' })
        await reloadTasks()
      } catch (err) {
        toast.push({
          title: '取消任务失败',
          description: err instanceof Error ? err.message : '请稍后重试',
          level: 'danger',
        })
      }
    })()
  }, [toast, reloadTasks])

  const handleRetryTask = useCallback((taskId: string) => {
    void (async () => {
      try {
        await apiClient.post(`/admin/tasks/${encodeURIComponent(taskId)}/retry`, {})
        toast.push({ title: '已请求重试任务', level: 'success' })
        await reloadTasks()
      } catch (err) {
        toast.push({
          title: '重试任务失败',
          description: err instanceof Error ? err.message : '请稍后重试',
          level: 'danger',
        })
      }
    })()
  }, [toast, reloadTasks])

  return (
    <>
    <AdminShell
      nav={navForRole}
      activeHref={pathname}
      crumbs={crumbs.length > 0 ? crumbs : undefined}
      topbarIcons={topbarIcons}
      health={healthSnapshotStub}
      countProvider={navCountProvider}
      user={user}
      theme={theme}
      defaultCollapsed={defaultCollapsed}
      notifications={notifications}
      notificationUnreadCount={notificationUnreadCount}
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
      {/* CHG-SN-8-FUP-USER-MENU：4 noop action 反馈 Modal */}
      <UserMenuActionModal
        type={actionModalType}
        user={user}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onClose={() => setActionModalType(null)}
      />
    </AdminShell>
    {/* ADR-155 D-155-2 / EP-2：删除 BackgroundEventBell position:fixed 旁路（N1-152-A 撤销）；
        background events 数据已通过 useAdminNotifications + useAdminTasks 合并到现有 topbar
        铃铛 + 闪电两图标 */}
    </>
  )
}
