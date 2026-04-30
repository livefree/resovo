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
import type {
  AdminNavCountProvider,
  HealthSnapshot,
  NotificationItem,
  TaskItem,
} from '@resovo/admin-ui'

/** AdminNavCountProvider stub — M-SN-2 返 empty Map；M-SN-3+ 接入真数据 */
export const adminNavCountProviderStub: AdminNavCountProvider = () => new Map()

/** healthSnapshot stub — M-SN-2 mock；M-SN-3+ 接入 /admin/system/monitor + /admin/moderation 真端点
 *  HealthSnapshot 类型 SSOT 在 packages/admin-ui/src/shell/types.ts（CHG-SN-2-06 上提） */
export const healthSnapshotStub: HealthSnapshot = {
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

/** notifications mock — CHG-DESIGN-05；M-SN-4+ 接入 /admin/notifications 真端点替换 */
export const mockNotifications: readonly NotificationItem[] = [
  {
    id: 'n-1',
    title: '审核队列堆积超阈值',
    body: '当前待审核 484 条，建议尽快处理',
    level: 'warn',
    createdAt: '2026-04-30T08:30:00Z',
    read: false,
    href: '/admin/moderation',
  },
  {
    id: 'n-2',
    title: '采集任务 #1287 失败',
    body: 'Site: example.com / 失败原因：超时',
    level: 'danger',
    createdAt: '2026-04-30T07:15:00Z',
    read: false,
    href: '/admin/crawler',
  },
  {
    id: 'n-3',
    title: '新视频已上架',
    body: '《流光夜话》已通过审核',
    level: 'info',
    createdAt: '2026-04-30T05:42:00Z',
    read: true,
  },
]

/** tasks mock — CHG-DESIGN-05；M-SN-4+ 接入 /admin/system/jobs + WebSocket 真端点替换 */
export const mockTasks: readonly TaskItem[] = [
  {
    id: 't-1',
    title: '元数据增量同步',
    status: 'running',
    progress: 62,
    startedAt: '2026-04-30T08:50:00Z',
  },
  {
    id: 't-2',
    title: '缩略图重生成',
    status: 'success',
    progress: 100,
    startedAt: '2026-04-30T07:20:00Z',
    finishedAt: '2026-04-30T07:48:00Z',
  },
  {
    id: 't-3',
    title: '搜索索引重建',
    status: 'failed',
    startedAt: '2026-04-30T06:10:00Z',
    finishedAt: '2026-04-30T06:12:00Z',
    errorMessage: 'Elasticsearch connection refused',
  },
]
