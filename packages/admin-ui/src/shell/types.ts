/**
 * shell/types.ts — packages/admin-ui Shell 公开数据契约（AdminNav 类型 SSOT）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.2 AdminNavItem 5 字段扩展协议
 *   - ADR-103a §4.4-4 零图标库依赖（icon: ReactNode 由 server-next 应用层注入）
 *
 * ── 类型 SSOT 迁移（CHG-SN-2-05 新增）──
 *
 * AdminNavItem / AdminNavSection / AdminNavCountProvider 类型定义在 packages/admin-ui
 * 作为公开 API（消费方 server-next admin-nav.tsx import 后定义 ADMIN_NAV 常量）。
 *
 * 原因：
 *   1. inferBreadcrumbs / Sidebar / CommandPalette / KeyboardShortcuts / AdminShell 等
 *      Shell 组件需消费 AdminNavSection 类型（ADR-103a §4.1.x）
 *   2. packages/admin-ui 不能反向 import server-next（plan §4.6 边界）
 *   3. 类型 SSOT 在 packages/admin-ui 让 server-next 与未来 cutover 后 apps/admin
 *      共享同一类型定义；ADMIN_NAV 数据常量仍由消费方维护
 *
 * 跨域消费：本文件类型仅在 packages/admin-ui Shell 内部 + apps/server-next admin-nav.tsx
 * 使用；apps/web-next / apps/api 不消费（admin 专属）。
 */
import type { ReactNode } from 'react'

/** AdminNav 单项导航条目（ADR-103a §4.2 5 字段扩展协议）
 *  消费方（server-next admin-nav.tsx）填充 icon ReactNode 时按 ADR-103b 选定的
 *  lucide-react 提供 named import 节点；packages/admin-ui 严禁直接 import 图标库 */
export interface AdminNavItem {
  readonly label: string
  readonly href: string
  /** 图标节点（由 server-next 应用层注入；packages/admin-ui 不依赖 lucide-react，§4.4-4） */
  readonly icon?: ReactNode
  /** 静态计数（编译期回退值）；AdminShellProps.countProvider 的 runtime 返回值优先于本字段 */
  readonly count?: number
  /** 角标语义（控制 dot/count 颜色；undefined → neutral） */
  readonly badge?: 'info' | 'warn' | 'danger'
  /** 规范化快捷键字符串（'mod+1' / 'mod+,'）；formatShortcut() 渲染期映射平台标签 */
  readonly shortcut?: string
  readonly children?: readonly AdminNavItem[]
}

/** AdminNav 5 组分段（运营中心 / 内容资产 / 首页运营 / 采集中心 / 系统管理）
 *  ADR-100 IA 修订段 v1 5 组结构；具体值由 server-next admin-nav.tsx ADMIN_NAV 常量提供 */
export interface AdminNavSection {
  readonly title: string
  readonly items: readonly AdminNavItem[]
}

/** count 运行时供给（ADR-103a §4.2 / CHG-SN-2-02 stage 2/2 新增）
 *  同步求值，返回 ReadonlyMap<href, count>；M-SN-2 落地 stub 返 empty；
 *  M-SN-3+ 接入 RSC/SWR 真数据后由消费方实现 */
export type AdminNavCountProvider = () => ReadonlyMap<string, number>

/** Topbar 健康指标快照（ADR-103a §4.1.8 / CHG-SN-2-06 SSOT 上提）
 *  3 项指标 × { value + status: 'ok' | 'warn' | 'danger' }；status 驱动 dot 颜色 token 映射
 *  消费方（server-next）从 /admin/system/monitor + /admin/moderation 真端点构造；M-SN-2 stub 用 mock */
export interface HealthSnapshot {
  readonly crawler: { readonly running: number; readonly total: number; readonly status: 'ok' | 'warn' | 'danger' }
  readonly invalidRate: { readonly rate: number; readonly status: 'ok' | 'warn' | 'danger' }
  readonly moderationPending: { readonly count: number; readonly status: 'ok' | 'warn' | 'danger' }
}

/** AdminShell 当前用户信息（ADR-103a §4.1.1 + §4.1.4 编排层语义 / CHG-SN-2-07 SSOT 上提）
 *  ADR §4.1.1 字面定义 role: string + avatarText: string（必填）；
 *  本 SSOT 按 §4.1.4 编排层 UserMenuAction union 语义精化：
 *    - role: 'admin' | 'moderator' union（与 onUserMenuAction 调度 schema 对齐，收敛 string 兜底）
 *    - avatarText 可选（由 deriveAvatarText helper 从 displayName 兜底推断）
 *  ADR-103a 修订记录段（CHG-SN-2-07 落地）已显式背书此精化。 */
export interface AdminShellUser {
  readonly id: string
  readonly displayName: string
  readonly email: string
  readonly role: 'admin' | 'moderator'
  /** 默认从 displayName 首两字推断（多词→首字母 / CJK→前两字 / 单字符→自身） */
  readonly avatarText?: string
}

/** UserMenu 6 项菜单的 callback 集合（ADR-103a §4.1.4）
 *  - 可选 actions（onProfile / onPreferences / onToggleTheme / onHelp / onSwitchAccount）：
 *    undefined 时对应菜单项隐藏（如 server-next 鉴权层不支持多账号 → onSwitchAccount=undefined → 切换账号项隐藏）
 *  - 必填 actions（onLogout）：登出是硬性入口，永远渲染 */
export interface AdminUserActions {
  readonly onProfile?: () => void
  readonly onPreferences?: () => void
  readonly onToggleTheme?: () => void
  readonly onHelp?: () => void
  readonly onSwitchAccount?: () => void
  readonly onLogout: () => void
}

/** UserMenu action union schema（fix(CHG-SN-2-01) §4.1.1 修订）
 *  AdminShell 编排层调度 schema（onUserMenuAction 单一回调消费此 union），
 *  内部分派到 AdminUserActions 各 callback；UserMenu 叶子层直接消费 actions 对象 */
export type UserMenuAction =
  | 'profile'
  | 'preferences'
  | 'theme'
  | 'help'
  | 'switchAccount'
  | 'logout'

/** 通知抽屉单项（ADR-103a §4.1.5 / CHG-SN-2-10 SSOT 上提）
 *  消费方（server-next）从 /admin/notifications 真端点构造；M-SN-2 stub 用 mock */
export interface NotificationItem {
  readonly id: string
  readonly title: string
  readonly body?: string
  readonly level: 'info' | 'warn' | 'danger'
  /** ISO 8601 时间戳（如 '2026-04-29T01:23:45Z'） */
  readonly createdAt: string
  readonly read: boolean
  /** 点击跳转目标；undefined 时仅触发 onItemClick 不导航 */
  readonly href?: string
}

/** 后台任务抽屉单项（ADR-103a §4.1.5 / CHG-SN-2-10 SSOT 上提）
 *  消费方（server-next）从 /admin/system/jobs 真端点 + WebSocket 增量构造；M-SN-2 stub 用 mock */
export interface TaskItem {
  readonly id: string
  readonly title: string
  readonly status: 'pending' | 'running' | 'success' | 'failed'
  /** 进度百分比（0-100）；仅 status='running' 时显示 progress bar */
  readonly progress?: number
  /** ISO 8601 起始时间 */
  readonly startedAt: string
  /** ISO 8601 结束时间（status='success' | 'failed' 时提供）*/
  readonly finishedAt?: string
  /** 失败原因（status='failed' 时提供）*/
  readonly errorMessage?: string
}

/** CommandPalette 单条命令（ADR-103a §4.1.6 / CHG-SN-2-11 SSOT 上提）
 *  消费方（server-next）按 ADMIN_NAV + 自定义 actions 组装；M-SN-2 stub 用 mock */
export interface CommandItem {
  readonly id: string
  readonly label: string
  readonly icon?: ReactNode
  /** 规范化快捷键字符串（'mod+k' / 'mod+,'）；formatShortcut() 渲染期映射平台标签 */
  readonly shortcut?: string
  /** 右侧灰字提示（如 'G then M' / 'Profile · Settings'） */
  readonly meta?: string
  /** action 类型：'navigate' 触发 onAction 后由消费方 router.push；'invoke' 触发自定义副作用 */
  readonly kind: 'navigate' | 'invoke'
  /** kind='navigate' 时必填（运行时由消费方负责校验，搜索结果项可能 href 异步注入故未用 discriminated union；
   *  若 M-SN-3+ 需要强约束，可升级为 discriminated union 不破坏 SSOT 兼容性） */
  readonly href?: string
}

/** CommandPalette 命令分组（ADR-103a §4.1.6）
 *  默认 3 组（导航 / 快捷操作 / 搜索结果），消费方可自定义；空 group 渲染时自动过滤 */
export interface CommandGroup {
  readonly id: string
  readonly label: string
  readonly items: readonly CommandItem[]
}
