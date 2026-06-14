'use client'

/**
 * admin-shell.tsx — packages/admin-ui Shell 顶层装配体（ADR-103a §4.1.1）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.1 AdminShell 职责、AdminShellProps 接口、不做段
 *   - fix(CHG-SN-2-01) P1-B：topbarIcons 必填 + notifications/tasks + Drawer 互斥
 *   - fix(CHG-SN-2-01) P2-B：crumbs optional（undefined → Topbar 不渲染面包屑）
 *   - ADR-103a §4.4 4 项硬约束
 *
 * 组件形态：
 *   章法 1A store-driven（per-instance store via useRef + useSyncExternalStore）
 *
 * 设计要点：
 *   - per-instance store：useRef 持有 createAdminShellStore(defaultCollapsed) 实例
 *   - 受控/非受控 collapsed 双模式：collapsed prop 存在 → 受控；否则 → 非受控（store 值）
 *   - Drawer 互斥：openNotifications / openTasks 同时只开一个，openCmdk 关 Drawer
 *   - 键盘快捷键：⌘B（折叠侧栏）+ ⌘K（CmdK）+ nav 各项 shortcut（⌘1-5/⌘,）
 *   - CommandPalette groups：commandGroups 未提供时从 nav 自动构建默认导航组
 *   - 布局：flex row（sidebar | flex column(topbar + main)）
 *
 * 不做：
 *   - 不调用 inferBreadcrumbs（消费方传 crumbs；undefined → 空数组传 Topbar）
 *   - 不持久化折叠态（onCollapsedChange 外提；consumer 用 cookie 持久化后 defaultCollapsed 注入）
 *   - 不获取通知/任务数据（由 props 注入）
 *   - 不直连 apiClient / router（onNavigate 外提）
 *   - 不内置主题切换逻辑（onThemeToggle 外提）
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Sidebar } from './sidebar'
import { Topbar, type TopbarIcons } from './topbar'
import { CommandPalette } from './command-palette'
import { NotificationDrawer } from './notification-drawer'
import { TaskDrawer } from './task-drawer'
import { ToastViewport } from './toast-viewport'
import { KeyboardShortcuts, type ShortcutBinding } from './keyboard-shortcuts'
import { AdminShellStyles } from './admin-shell-styles'
import { InteractionStyles } from './interaction-styles'
import { createAdminShellStore } from './admin-shell-store'
import type { AdminShellStoreState } from './admin-shell-store'
import type {
  AdminNavSection,
  AdminNavCountProvider,
  HealthSnapshot,
  AdminShellUser,
  UserMenuAction,
  NotificationItem,
  TaskItem,
  CommandItem,
  CommandGroup,
} from './types'
import type { BreadcrumbItem } from './breadcrumbs'

export interface AdminShellProps {
  /** 当前激活路由 href（Sidebar 高亮 + 消费方调 inferBreadcrumbs 的输入）*/
  readonly activeHref: string
  /** 5 组 NAV 数据（透传到 Sidebar / CommandPalette / KeyboardShortcuts）*/
  readonly nav: readonly AdminNavSection[]
  /** 面包屑；undefined 时 Topbar 不渲染面包屑（消费方按需调 inferBreadcrumbs 后注入）*/
  readonly crumbs?: readonly BreadcrumbItem[]
  /** Topbar 5 类按钮图标插槽（必填；零图标库依赖约束 4.4-4 的兑现入口）*/
  readonly topbarIcons: TopbarIcons
  /** 健康指标；undefined 时不显示 HealthBadge */
  readonly health?: HealthSnapshot
  /** count provider（运行时计数；返回值优先于 AdminNavItem.count 静态值）*/
  readonly countProvider?: AdminNavCountProvider
  /** 当前用户（UserMenu 渲染）*/
  readonly user: AdminShellUser
  /** 主题（'dark' | 'light'）*/
  readonly theme: 'dark' | 'light'
  /** 折叠态（受控）；undefined 时进入非受控模式 + 使用 defaultCollapsed */
  readonly collapsed?: boolean
  /** 折叠态默认值（非受控模式生效）；服务端 cookie 注入用 */
  readonly defaultCollapsed?: boolean
  /** 通知数据；undefined 时通知图标禁用，NotificationDrawer 不挂载 */
  readonly notifications?: readonly NotificationItem[]
  /**
   * 未读计数（红点数据源 / ADR-196 D-196-5②）：消费方传 unread-count 数字（SSE 实时 + 端点/轮询 fallback），
   * shell 内 `count > 0` → 红点。**undefined 时回退** `notifications.some(!read)`（向后兼容，旧消费方/stub 不破）。
   * 与 `tasks` 的 `runningTaskCount` 同范式（消费方传计数、shell 内派生展示）。
   */
  readonly notificationUnreadCount?: number
  /** 任务数据；undefined 时任务图标禁用，TaskDrawer 不挂载 */
  readonly tasks?: readonly TaskItem[]
  /** 自定义 CmdK 命令分组；undefined 时从 nav 自动构建导航组 */
  readonly commandGroups?: readonly CommandGroup[]
  /**
   * CmdK 远程搜索接线（ADR-200 / SEARCH-02）——透传到 CommandPalette：
   *   - onCommandQueryChange：输入词变更（消费方注入 debounce + AbortController 调 /admin/search；应 memoize）
   *   - commandPrefilteredGroups：服务端已过滤的结果组（跳本地过滤、原样展示）
   *   - commandLoading：远程请求中（驱动 aria-busy + 空态优先级）
   *   - commandEmptyState：自定义空态节点（优先级 loading > emptyState > 内置）
   * 均 undefined 时 CommandPalette 退化为纯本地命令面板（向后兼容）。
   */
  readonly onCommandQueryChange?: (q: string) => void
  readonly commandPrefilteredGroups?: readonly CommandGroup[]
  readonly commandLoading?: boolean
  readonly commandEmptyState?: ReactNode
  /** 路由跳转回调（注入 Next.js router.push 等）*/
  readonly onNavigate: (href: string) => void
  /** 主题切换回调 */
  readonly onThemeToggle: () => void
  /** 用户菜单动作回调（6 项 union）*/
  readonly onUserMenuAction: (action: UserMenuAction) => void
  /** 折叠态变更回调（受控/非受控双模式都触发，便于持久化）*/
  readonly onCollapsedChange?: (next: boolean) => void
  /** 通知项点击回调；undefined 时通知项不可点击 */
  readonly onNotificationItemClick?: (item: NotificationItem) => void
  /** 全部已读回调；undefined 时按钮隐藏 */
  readonly onMarkAllNotificationsRead?: () => void
  /** 通知单项软移除回调（ADR-197 / NTLG-NTF-DISMISS-C1）；undefined 时移除按钮隐藏 */
  readonly onDismissNotification?: (itemKey: string) => void
  /** 通知批量清空回调（回传可见可 dismiss itemKeys）；undefined 时清空按钮隐藏 */
  readonly onClearAllNotifications?: (itemKeys: readonly string[]) => void
  /** 任务取消回调；undefined 时取消按钮隐藏 */
  readonly onCancelTask?: (taskId: string) => void
  /** 任务重试回调；undefined 时重试按钮隐藏 */
  readonly onRetryTask?: (taskId: string) => void
  /** 终态任务软移除回调（ADR-197 / NTLG-NTF-DISMISS-C2）；undefined 时移除按钮隐藏 */
  readonly onDismissTask?: (itemKey: string) => void
  /** 任务批量清除已完成回调（回传可见可 dismiss itemKeys）；undefined 时按钮隐藏 */
  readonly onClearAllTasks?: (itemKeys: readonly string[]) => void
  readonly children: ReactNode
}

const EMPTY_CRUMBS: readonly BreadcrumbItem[] = []

const SHELL_STYLE: CSSProperties = {
  display: 'flex',
  height: '100vh',
  overflow: 'hidden',
  background: 'var(--bg-canvas)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm)',
}

const CONTENT_STYLE: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 0,
}

const MAIN_STYLE: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 'var(--space-5)',
  background: 'var(--bg-canvas)',
}

export function AdminShell(props: AdminShellProps) {
  const {
    activeHref, nav, crumbs, topbarIcons, health, countProvider, user, theme,
    collapsed: controlledCollapsed, defaultCollapsed, notifications, notificationUnreadCount, tasks, commandGroups,
    onCommandQueryChange, commandPrefilteredGroups, commandLoading, commandEmptyState,
    onNavigate, onThemeToggle, onUserMenuAction, onCollapsedChange,
    onNotificationItemClick, onMarkAllNotificationsRead, onDismissNotification, onClearAllNotifications,
    onCancelTask, onRetryTask, onDismissTask, onClearAllTasks,
    children,
  } = props

  // ── per-instance store ─────────────────────────────────
  const storeRef = useRef<ReturnType<typeof createAdminShellStore> | null>(null)
  if (!storeRef.current) {
    storeRef.current = createAdminShellStore(defaultCollapsed ?? false)
  }

  // store.getState 原生引用：AdminShellStoreState & Actions 是 AdminShellStoreState 的子类型，
  // 函数返回类型协变保证可直接传入而无需类型断言；引用稳定避免无限重渲染
  // getServerSnapshot = store.getState（与 getSnapshot 相同）：store 以 defaultCollapsed 初始化，
  // 服务端 snapshot 直接反映真实初值，避免 collapsed=false 硬编码常量与 defaultCollapsed=true 产生水合不匹配
  const store = storeRef.current
  const storeState = useSyncExternalStore<AdminShellStoreState>(
    store.subscribe,
    store.getState,
    store.getState,
  )

  // ── collapsed 受控/非受控双模式 ───────────────────────────
  const isControlled = controlledCollapsed !== undefined
  const collapsed = isControlled ? controlledCollapsed : storeState.collapsed

  // 受控模式下同步 prop 值到 store（使 store 始终持有最新值，便于 toggleCollapsed 计算正确 next）
  useEffect(() => {
    if (isControlled && controlledCollapsed !== undefined) {
      storeRef.current!.getState().setCollapsed(controlledCollapsed)
    }
  }, [isControlled, controlledCollapsed])

  // ── 派生值 ─────────────────────────────────────────────
  const counts = useMemo(() => countProvider?.() ?? undefined, [countProvider])

  // ADR-196 D-196-5②：红点优先消费 unread-count 数字（SSE 实时 + 端点/轮询 fallback）；
  // 未提供时回退 list-derived。守卫用 `!== undefined`（非 truthy）——count=0 须命中「有 prop 无未读→隐藏」，
  // 不可回退 list-derived（否则 upcoming createdAt 未来恒未读的旧缺陷无法修正）。
  const notificationDotVisible = useMemo(
    () => {
      if (notificationUnreadCount !== undefined) return notificationUnreadCount > 0
      return (notifications ?? []).some((n) => !n.read)
    },
    [notificationUnreadCount, notifications],
  )
  const runningTaskCount = useMemo(
    () => (tasks ?? []).filter((t) => t.status === 'running').length,
    [tasks],
  )

  const resolvedGroups: readonly CommandGroup[] = useMemo(() => {
    if (commandGroups) return commandGroups
    const items: CommandItem[] = nav.flatMap((section) =>
      section.items.map((item) => ({
        id: item.href,
        label: item.label,
        icon: item.icon,
        shortcut: item.shortcut,
        kind: 'navigate' as const,
        href: item.href,
      })),
    )
    return [{ id: 'nav', label: '导航', items }]
  }, [commandGroups, nav])

  // ── 回调 ──────────────────────────────────────────────

  const handleToggleCollapsed = useCallback(() => {
    const next = !collapsed
    if (!isControlled) store.getState().setCollapsed(next)
    onCollapsedChange?.(next)
  }, [collapsed, isControlled, store, onCollapsedChange])

  const handleOpenNotifications = useCallback(() => {
    if (notifications !== undefined) store.getState().openDrawer('notifications')
  }, [notifications, store])

  const handleOpenTasks = useCallback(() => {
    if (tasks !== undefined) store.getState().openDrawer('tasks')
  }, [tasks, store])

  const handleCloseDrawer = useCallback(() => store.getState().closeDrawer(), [store])

  const handleOpenCmdk = useCallback(() => store.getState().openCmdk(), [store])

  const handleCloseCmdk = useCallback(() => store.getState().closeCmdk(), [store])

  const handleOpenSettings = useCallback(() => onNavigate('/admin/system/settings'), [onNavigate])

  const handleCommandAction = useCallback((item: CommandItem) => {
    if (item.kind === 'navigate' && item.href) onNavigate(item.href)
  }, [onNavigate])

  // ── 键盘快捷键 ─────────────────────────────────────────
  const shortcutBindings = useMemo<readonly ShortcutBinding[]>(() => {
    const navBindings: ShortcutBinding[] = nav
      .flatMap((s) => s.items)
      .filter((item) => Boolean(item.shortcut))
      .map((item) => ({
        id: `nav-${item.href}`,
        spec: item.shortcut!,
        handler: () => onNavigate(item.href),
      }))

    return [
      ...navBindings,
      { id: 'toggle-sidebar', spec: 'mod+b', handler: (e) => { e.preventDefault(); handleToggleCollapsed() } },
      { id: 'open-cmdk', spec: 'mod+k', handler: (e) => { e.preventDefault(); handleOpenCmdk() } },
    ]
  }, [nav, onNavigate, handleToggleCollapsed, handleOpenCmdk])

  // ── 渲染 ─────────────────────────────────────────────
  return (
    <div data-admin-shell style={SHELL_STYLE}>
      <AdminShellStyles />
      <InteractionStyles />
      <Sidebar
        nav={nav}
        activeHref={activeHref}
        collapsed={collapsed}
        user={user}
        onToggleCollapsed={handleToggleCollapsed}
        onNavigate={onNavigate}
        onUserMenuAction={onUserMenuAction}
        counts={counts}
      />
      <div data-admin-shell-content style={CONTENT_STYLE}>
        <Topbar
          crumbs={crumbs ?? EMPTY_CRUMBS}
          theme={theme}
          icons={topbarIcons}
          health={health}
          notificationDotVisible={notificationDotVisible}
          runningTaskCount={runningTaskCount}
          notificationsDisabled={notifications === undefined}
          tasksDisabled={tasks === undefined}
          onOpenCommandPalette={handleOpenCmdk}
          onThemeToggle={onThemeToggle}
          onOpenNotifications={handleOpenNotifications}
          onOpenTasks={handleOpenTasks}
          onOpenSettings={handleOpenSettings}
        />
        <main data-admin-shell-main style={MAIN_STYLE}>
          {children}
        </main>
      </div>

      <KeyboardShortcuts bindings={shortcutBindings} />

      <CommandPalette
        open={storeState.cmdkOpen}
        groups={resolvedGroups}
        prefilteredGroups={commandPrefilteredGroups}
        loading={commandLoading}
        emptyRemoteState={commandEmptyState}
        onQueryChange={onCommandQueryChange}
        onClose={handleCloseCmdk}
        onAction={handleCommandAction}
      />

      {notifications !== undefined && (
        <NotificationDrawer
          open={storeState.drawerOpen === 'notifications'}
          items={notifications}
          onClose={handleCloseDrawer}
          onItemClick={onNotificationItemClick}
          onMarkAllRead={onMarkAllNotificationsRead}
          onDismiss={onDismissNotification}
          onClearAll={onClearAllNotifications}
        />
      )}

      {tasks !== undefined && (
        <TaskDrawer
          open={storeState.drawerOpen === 'tasks'}
          items={tasks}
          onClose={handleCloseDrawer}
          onCancel={onCancelTask}
          onRetry={onRetryTask}
          onDismiss={onDismissTask}
          onClearAll={onClearAllTasks}
        />
      )}

      <ToastViewport />
    </div>
  )
}
