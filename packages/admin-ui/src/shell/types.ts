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
