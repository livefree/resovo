/**
 * shell-data.tsx — server-next 应用层为 packages/admin-ui Shell 准备的 stub providers
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1 / §4.2（AdminShell / Sidebar / Topbar Props 接口契约）
 *   - ADR-103a §4.4-1（Provider 不下沉硬约束 — 数据由 server-next 应用层 SWR/RSC 准备后注入）
 *
 * 职责（M-SN-2 stage 2/2 阶段）：
 *   - countProvider stub：AdminNavCountProvider 同步求值，返 empty Map
 *     （M-SN-3+ 接入 RSC / SWR 真数据；当前 admin-nav.ts ADMIN_NAV 静态 count
 *      为编译期回退值即可满足 demo 需求）
 *   - healthSnapshot stub：HealthSnapshot 三项指标 mock 数据（待 M-SN-3+ 接入
 *     /admin/system/monitor + /admin/moderation 的真实端点）
 *   - topbarIcons stub：TopbarIcons 5 类按钮 ReactNode（lucide-react named import）
 *
 * Shell 组件（packages/admin-ui Shell 10 组件，CHG-SN-2-03+ 落地）将通过
 * <AdminShell /> Props 接收本文件导出的 stub。M-SN-3+ 业务卡按需替换为真数据 hook。
 *
 * 不变约束：
 *   - Edge Runtime 兼容：本文件零 fetch / Cookie / localStorage 副作用（同步求值）
 *   - lucide-react 仅在本文件 import（admin-nav.tsx 也用，但 packages/admin-ui 严禁）
 *   - 所有 stub 返回 readonly 数据（与 Shell Props readonly 契约对齐）
 */
import {
  Search,
  Sun,
  Moon,
  Bell,
  Zap,
  Settings,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { AdminNavCountProvider } from './admin-nav'

/** AdminNavCountProvider stub — M-SN-2 返 empty Map；M-SN-3+ 接入真数据 */
export const adminNavCountProviderStub: AdminNavCountProvider = () => new Map()

/** HealthSnapshot 类型（与 ADR-103a §4.1.8 HealthSnapshot 契约一致；packages/admin-ui 导出后可改为 import） */
export interface HealthSnapshotStub {
  readonly crawler: { readonly running: number; readonly total: number; readonly status: 'ok' | 'warn' | 'danger' }
  readonly invalidRate: { readonly rate: number; readonly status: 'ok' | 'warn' | 'danger' }
  readonly moderationPending: { readonly count: number; readonly status: 'ok' | 'warn' | 'danger' }
}

/** healthSnapshot stub — M-SN-2 mock；M-SN-3+ 接入 /admin/system/monitor + /admin/moderation 真端点 */
export const healthSnapshotStub: HealthSnapshotStub = {
  crawler: { running: 3, total: 12, status: 'ok' },
  invalidRate: { rate: 0.013, status: 'ok' },
  moderationPending: { count: 484, status: 'warn' },
}

/** TopbarIcons 类型（与 ADR-103a §4.1.3 TopbarIcons 契约一致；packages/admin-ui 导出后可改为 import） */
export interface TopbarIconsStub {
  readonly search: ReactNode
  readonly theme: ReactNode
  readonly notifications: ReactNode
  readonly tasks: ReactNode
  readonly settings: ReactNode
}

/** topbarIcons stub — 按当前 theme 渲染 sun/moon；调用方按需切换 ReactNode 实例 */
export function buildTopbarIconsStub(theme: 'dark' | 'light'): TopbarIconsStub {
  return {
    search: <Search />,
    theme: theme === 'dark' ? <Sun /> : <Moon />,
    notifications: <Bell />,
    tasks: <Zap />,
    settings: <Settings />,
  }
}
