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
 * read 状态（ADR-147 D-147-4 方案 A）：localStorage lastViewedAt 时间戳
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

const LAST_VIEWED_STORAGE_KEY = 'admin_notification_lastViewedAt'
const POLL_INTERVAL_MS = 60_000

interface NotificationListResponse {
  data: NotificationItem[]
  meta: { total: number; limit: number; since: string }
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

function readStoredLastViewedAt(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(LAST_VIEWED_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeStoredLastViewedAt(value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_VIEWED_STORAGE_KEY, value)
  } catch {
    // localStorage 不可用（隐私模式）静默
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

/** ADR-147 EP-B + ADR-155 D-155-2 EP-2：admin shell 通知 polling + localStorage read + background 合并 */
export function useAdminNotifications(): UseAdminNotificationsResult {
  const [generalItems, setGeneralItems] = useState<readonly NotificationItem[]>([])
  const [backgroundItems, setBackgroundItems] = useState<readonly NotificationItem[]>([])
  const [lastViewedAt, setLastViewedAt] = useState<string>(readStoredLastViewedAt)
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set())

  const reload = useCallback(async () => {
    const [generalResult, bgResult] = await Promise.allSettled([
      apiClient.get<NotificationListResponse>('/admin/notifications'),
      apiClient.get<BackgroundEventsResponse>('/admin/system/background-events'),
    ])
    if (generalResult.status === 'fulfilled') {
      setGeneralItems(generalResult.value.data.map((item) => ({ ...item, category: 'general' as const })))
    } else if (
      !(generalResult.reason instanceof ApiClientError && generalResult.reason.status === 401)
    ) {
      // Y-EP2-3：非 401 错误显式 console.error（避免 CLAUDE.md 空 catch 精神冲突）；401 由 apiClient 自动处理
      // eslint-disable-next-line no-console -- 客户端 hook 无 logger / 错误留痕到浏览器 devtools
      console.error('[useAdminNotifications] /admin/notifications failed:', generalResult.reason)
    }
    if (bgResult.status === 'fulfilled') {
      const mapped = bgResult.value.data
        .map(mapBackgroundEventToNotification)
        .filter((x): x is NotificationItem => x !== null)
      setBackgroundItems(mapped)
    } else {
      // Y-EP2-3：background-events 端点失败留痕（主端点已正常时不打扰用户 UX）
      // eslint-disable-next-line no-console -- 客户端 hook 无 logger
      console.error('[useAdminNotifications] /admin/system/background-events failed:', bgResult.reason)
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = setInterval(() => { void reload() }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [reload])

  // ADR-152 Y-152-4 / EP-2：注册到 globalMutateRegistry 让 CrawlerClient 触发刷新
  useEffect(() => {
    globalMutateRegistry.add(reload)
    return () => { globalMutateRegistry.delete(reload) }
  }, [reload])

  const items = useMemo<readonly NotificationItem[]>(() => {
    const merged = [...generalItems, ...backgroundItems]
    // 按 createdAt DESC 排序
    return merged
      .map((item) => ({
        ...item,
        read: readIds.has(item.id) || (lastViewedAt !== '' && item.createdAt <= lastViewedAt),
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  }, [generalItems, backgroundItems, lastViewedAt, readIds])

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString()
    setLastViewedAt(now)
    writeStoredLastViewedAt(now)
  }, [])

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
      // Y-EP2-3：非 401 错误显式 console.error
      // eslint-disable-next-line no-console -- 客户端 hook 无 logger
      console.error('[useAdminTasks] /admin/system/jobs failed:', jobsResult.reason)
    }
    if (bgResult.status === 'fulfilled') {
      const mapped = bgResult.value.data
        .map(mapBackgroundEventToTask)
        .filter((x): x is TaskItem => x !== null)
      setBackgroundItems(mapped)
    } else {
      // eslint-disable-next-line no-console -- 客户端 hook 无 logger
      console.error('[useAdminTasks] /admin/system/background-events failed:', bgResult.reason)
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = setInterval(() => { void reload() }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [reload])

  // ADR-152 Y-152-4 / EP-2：注册到 globalMutateRegistry
  useEffect(() => {
    globalMutateRegistry.add(reload)
    return () => { globalMutateRegistry.delete(reload) }
  }, [reload])

  const items = useMemo<readonly TaskItem[]>(() => {
    const merged = [...generalItems, ...backgroundItems]
    return merged.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
  }, [generalItems, backgroundItems])

  return { items, degraded, reload }
}
