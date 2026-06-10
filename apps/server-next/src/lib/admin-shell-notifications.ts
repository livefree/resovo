/**
 * admin-shell-notifications.ts —
 * admin Shell 通知 + 任务面板 hook（ADR-147 EP-B + ADR-155 D-155-2 / EP-2）
 *
 * 数据源（ADR-147 D-147-6 + ADR-155 D-155-2 Y-155-3 并发两 GET 短期方案）：
 *   useAdminNotifications:
 *     GET /v1/admin/notifications              → NotificationItem[]（category='general'）
 *     GET /v1/admin/system/background-events   → AdminBackgroundEvent[]
 *       - upcoming/finished lane 映射为 NotificationItem + category='background'
 *     合并 + 按 createdAt DESC 排序
 *   useAdminTasks:
 *     GET /v1/admin/system/jobs                → TaskItem[]（source='general'）
 *     GET /v1/admin/system/background-events   → AdminBackgroundEvent[]
 *       - active lane 映射为 TaskItem + source='crawler'
 *     合并 + 按 startedAt DESC 排序
 *
 * 推送模型（ADR-147 D-147-2）：60s 间隔前端 polling
 * read 状态（NTLG-P1-c-C / D-192-AMD-4）：服务端 cursor 单一已读源——list meta.readAt 高水位线
 *   （COALESCE(cursor, users.created_at)），对 general + background 合并项统一计算 read（替 localStorage）；
 *   markAllRead 改调 POST /admin/notifications/read（跨设备持久），markOneRead 仍客户端 ephemeral（逐行 reads deferred P2）
 *
 * 全局 invalidate（ADR-152 Y-152-4 / EP-2 沿用）：useAdminNotifications/Tasks 在 mount 时
 *   注册 reload 到 globalMutateRegistry；CrawlerClient invalidateBackgroundEvents() 调所有 reload。
 */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NotificationItem, TaskItem } from '@resovo/admin-ui'
import type { AdminBackgroundEvent } from '@resovo/types'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { globalMutateRegistry } from '@/lib/admin-shell-background-events'
import { connectNotificationStream } from '@/lib/notification-stream-client'

const POLL_INTERVAL_MS = 60_000

interface NotificationListResponse {
  data: NotificationItem[]
  // NTLG-P1-c-C：meta.readAt = 服务端已读高水位线（cursor 单一源）；缺省（旧 mock / user 防御）→ undefined，前端 ?? '' 兜底
  meta: { total: number; limit: number; since: string; readAt?: string | null }
}

/** POST /admin/notifications/read 响应（markAllRead 返回落库高水位线） */
interface MarkReadResponse {
  data: { readAt: string }
}

interface JobsListResponse {
  data: TaskItem[]
  meta: {
    total: number
    limit: number
    since: string
    queueCounts: { crawler: { waiting: number; active: number }; maintenance: { waiting: number; active: number } }
    degraded?: boolean
  }
}

interface BackgroundEventsResponse {
  data: AdminBackgroundEvent[]
  meta: {
    total: number
    limit: number
    windowHours: number
    generatedAt: string
    degraded?: boolean
  }
}

// ── ADR-155 D-155-2 / EP-2：BackgroundEvent → NotificationItem/TaskItem 映射 ──

/**
 * upcoming + finished lane → NotificationItem（category='background'）
 *
 * 语义对应：
 *   - upcoming.scheduledAt → NotificationItem.createdAt（即将发生的事件按"通知"对待）
 *   - finished.finishedAt → NotificationItem.createdAt
 *   - kind → title 前缀（auto_crawl / scheduler_timer / crawler_run / audit_high_risk）
 *   - status → level（success→info / failed/timeout→danger / partial_failed/cancelled→warn / scheduled→info）
 */
function mapBackgroundEventToNotification(event: AdminBackgroundEvent): NotificationItem | null {
  if (event.lane === 'upcoming') {
    return {
      id: `bg-${event.id}`,
      title: event.title,
      body: event.description,
      level: event.level,
      createdAt: event.scheduledAt,
      read: false,
      href: event.href,
      category: 'background',
    }
  }
  if (event.lane === 'finished') {
    // status='success' → 'info'；其他保留 event.level（finished 已是 info/warn/danger）
    return {
      id: `bg-${event.id}`,
      title: event.title,
      body: event.description,
      level: event.level,
      createdAt: event.finishedAt,
      read: false,
      href: event.href,
      category: 'background',
    }
  }
  return null  // active lane 不映射为通知（→ 任务）
}

/**
 * active lane → TaskItem（source='crawler'）
 *
 * 语义对应：
 *   - status: queued/running/paused → TaskItem.status（pending/running 映射；paused 兜底 running）
 *   - startedAt → TaskItem.startedAt
 *   - kind='crawler_run' → source='crawler'
 */
function mapBackgroundEventToTask(event: AdminBackgroundEvent): TaskItem | null {
  if (event.lane !== 'active') return null
  const taskStatus: TaskItem['status'] =
    event.status === 'running' ? 'running'
    : event.status === 'queued' ? 'pending'
    : 'running'  // paused 兜底为 running（保持可见性）
  return {
    id: `bg-${event.id}`,
    title: event.title,
    status: taskStatus,
    startedAt: event.startedAt,
    source: 'crawler',
  }
}

export interface UseAdminNotificationsResult {
  readonly items: readonly NotificationItem[]
  readonly markAllRead: () => void
  readonly markOneRead: (id: string) => void
  readonly reload: () => Promise<void>
}

/** ADR-147 EP-B + ADR-155 D-155-2 EP-2 + NTLG-P1-c-C：admin shell 通知 polling + 服务端 cursor read + background 合并 */
export function useAdminNotifications(): UseAdminNotificationsResult {
  const [generalItems, setGeneralItems] = useState<readonly NotificationItem[]>([])
  const [backgroundItems, setBackgroundItems] = useState<readonly NotificationItem[]>([])
  // NTLG-P1-c-C：已读高水位线来自服务端 list meta.readAt（cursor 单一源），替 localStorage lastViewedAt
  const [readAt, setReadAt] = useState<string>('')
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set())
  // ADR-196 D-196-1/6：SSE 连接态（open → 停 60s 轮询，SSE 驱动实时；closed → 轮询 fallback 接管）
  const [sseConnected, setSseConnected] = useState(false)

  const reload = useCallback(async () => {
    const [generalResult, bgResult] = await Promise.allSettled([
      apiClient.get<NotificationListResponse>('/admin/notifications'),
      apiClient.get<BackgroundEventsResponse>('/admin/system/background-events'),
    ])
    if (generalResult.status === 'fulfilled') {
      setGeneralItems(generalResult.value.data.map((item) => ({ ...item, category: 'general' as const })))
      setReadAt(generalResult.value.meta.readAt ?? '')
    } else if (
      !(generalResult.reason instanceof ApiClientError && generalResult.reason.status === 401)
    ) {
      // Y-EP2-3 + HOTFIX-G：非 401 错误降级留痕（warn 级而非 error / 避免 dev console 红色干扰用户）
      // 401 由 apiClient 自动处理；这里是降级路径不是异常
      // eslint-disable-next-line no-console -- 客户端 hook 无 logger / degraded mode 留痕到浏览器 devtools
      console.warn('[useAdminNotifications] /admin/notifications failed (degraded mode):', generalResult.reason)
    }
    if (bgResult.status === 'fulfilled') {
      const mapped = bgResult.value.data
        .map(mapBackgroundEventToNotification)
        .filter((x): x is NotificationItem => x !== null)
      setBackgroundItems(mapped)
    } else {
      // Y-EP2-3 + HOTFIX-G：background-events 端点失败降级留痕（warn 而非 error / 主端点已正常时不打扰用户 UX）
      // eslint-disable-next-line no-console -- 客户端 hook 无 logger / degraded mode 留痕
      console.warn('[useAdminNotifications] /admin/system/background-events failed (degraded mode):', bgResult.reason)
    }
  }, [])

  // 初始加载一次（SSE/轮询之外的首屏拉取）
  useEffect(() => {
    void reload()
  }, [reload])

  // ADR-196 D-196-1/6：SSE 实时优先——`unread` 事件触发 reload（红点经 list-derived 实时更新，
  // F6② 红点改读 unread-count 归 P2-c-C）。连接态经 onStateChange 暴露供轮询 effect 切 fallback。
  useEffect(() => {
    const ctrl = connectNotificationStream({
      onUnread: () => { void reload() },
      onStateChange: (state) => { setSseConnected(state === 'open') },
    })
    return () => { ctrl.close() }
  }, [reload])

  // ADR-196 D-196-6：60s 轮询 fallback——仅 SSE 未连通时启（SSE open → SSE 驱动实时、停轮询）。不删轮询。
  useEffect(() => {
    if (sseConnected) return
    const timer = setInterval(() => { void reload() }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [reload, sseConnected])

  // ADR-152 Y-152-4 / EP-2 / N1-EP2-1：注册到 globalMutateRegistry 让 CrawlerClient 触发刷新
  // Map<id, fn>：同 id 重复注册只保留最新 fn（防 StrictMode/HMR stale reference）
  useEffect(() => {
    globalMutateRegistry.set('admin-notifications', reload)
    return () => { globalMutateRegistry.delete('admin-notifications') }
  }, [reload])

  const items = useMemo<readonly NotificationItem[]>(() => {
    const merged = [...generalItems, ...backgroundItems]
    // 按 createdAt DESC 排序；read 据服务端 readAt 高水位线对 general+background 统一计算（单一已读源）
    return merged
      .map((item) => ({
        ...item,
        read: readIds.has(item.id) || (readAt !== '' && item.createdAt <= readAt),
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  }, [generalItems, backgroundItems, readAt, readIds])

  // NTLG-P1-c-C：markAllRead 改调 POST /admin/notifications/read（cursor 跨设备持久）。
  // 乐观即时清点（readAt=now）→ 服务端权威基线对齐 → reload 拉取期间新增项；失败仅 warn 降级（乐观态由下次 reload 校正）。
  const markAllRead = useCallback(() => {
    setReadAt(new Date().toISOString())
    void (async () => {
      try {
        const resp = await apiClient.post<MarkReadResponse>('/admin/notifications/read', {})
        setReadAt(resp.data.readAt)
        await reload()
      } catch (err) {
        // eslint-disable-next-line no-console -- 客户端 hook 无 logger / degraded mode 留痕到 devtools
        console.warn('[useAdminNotifications] markAllRead failed (degraded mode):', err)
      }
    })()
  }, [reload])

  const markOneRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  return { items, markAllRead, markOneRead, reload }
}

export interface UseAdminTasksResult {
  readonly items: readonly TaskItem[]
  readonly degraded: boolean
  readonly reload: () => Promise<void>
}

/** ADR-147 EP-B + ADR-155 D-155-2 EP-2：admin shell 任务 polling + background active 合并 */
export function useAdminTasks(): UseAdminTasksResult {
  const [generalItems, setGeneralItems] = useState<readonly TaskItem[]>([])
  const [backgroundItems, setBackgroundItems] = useState<readonly TaskItem[]>([])
  const [degraded, setDegraded] = useState(false)

  const reload = useCallback(async () => {
    const [jobsResult, bgResult] = await Promise.allSettled([
      apiClient.get<JobsListResponse>('/admin/system/jobs'),
      apiClient.get<BackgroundEventsResponse>('/admin/system/background-events'),
    ])
    if (jobsResult.status === 'fulfilled') {
      setGeneralItems(jobsResult.value.data.map((item) => ({ ...item, source: 'general' as const })))
      setDegraded(jobsResult.value.meta.degraded === true)
    } else if (
      !(jobsResult.reason instanceof ApiClientError && jobsResult.reason.status === 401)
    ) {
      // Y-EP2-3 + HOTFIX-G：非 401 降级留痕（warn 而非 error）
      // eslint-disable-next-line no-console -- 客户端 hook 无 logger / degraded mode 留痕
      console.warn('[useAdminTasks] /admin/system/jobs failed (degraded mode):', jobsResult.reason)
    }
    if (bgResult.status === 'fulfilled') {
      const mapped = bgResult.value.data
        .map(mapBackgroundEventToTask)
        .filter((x): x is TaskItem => x !== null)
      setBackgroundItems(mapped)
    } else {
      // HOTFIX-G：降级留痕（warn 而非 error / 避免 dev console 红色干扰）
      // eslint-disable-next-line no-console -- 客户端 hook 无 logger / degraded mode 留痕
      console.warn('[useAdminTasks] /admin/system/background-events failed (degraded mode):', bgResult.reason)
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = setInterval(() => { void reload() }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [reload])

  // ADR-152 Y-152-4 / EP-2 / N1-EP2-1：注册到 globalMutateRegistry（Map<id, fn>）
  useEffect(() => {
    globalMutateRegistry.set('admin-tasks', reload)
    return () => { globalMutateRegistry.delete('admin-tasks') }
  }, [reload])

  const items = useMemo<readonly TaskItem[]>(() => {
    const merged = [...generalItems, ...backgroundItems]
    return merged.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
  }, [generalItems, backgroundItems])

  return { items, degraded, reload }
}
