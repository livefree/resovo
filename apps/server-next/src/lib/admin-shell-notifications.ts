/**
 * admin-shell-notifications.ts —
 * admin Shell 通知 + 任务面板 SWR-style hook（ADR-147 EP-B / CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-B）
 *
 * 数据源（ADR-147 D-147-6）：
 *   GET /v1/admin/notifications → NotificationItem[]
 *   GET /v1/admin/system/jobs    → TaskItem[]
 *
 * 推送模型（ADR-147 D-147-2）：60s 间隔前端 polling（不引入 SWR / SSE / WS）
 *
 * read 状态（ADR-147 D-147-4 方案 A）：localStorage lastViewedAt 时间戳；
 *   item.createdAt <= lastViewedAt → read=true（后端统一返回 read=false）
 */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NotificationItem, TaskItem } from '@resovo/admin-ui'
import { apiClient, ApiClientError } from '@/lib/api-client'

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

export interface UseAdminNotificationsResult {
  readonly items: readonly NotificationItem[]
  readonly markAllRead: () => void
  readonly markOneRead: (id: string) => void
  readonly reload: () => Promise<void>
}

/** ADR-147 EP-B：admin shell 通知 polling + localStorage read 状态 */
export function useAdminNotifications(): UseAdminNotificationsResult {
  const [serverItems, setServerItems] = useState<readonly NotificationItem[]>([])
  const [lastViewedAt, setLastViewedAt] = useState<string>(readStoredLastViewedAt)
  // 单条 markOneRead 的 session-only read ids（点击单条 → 弱视觉反馈；不持久化）
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set())

  const reload = useCallback(async () => {
    try {
      const res = await apiClient.get<NotificationListResponse>('/admin/notifications')
      setServerItems(res.data)
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) return
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = setInterval(() => {
      void reload()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [reload])

  const items = useMemo<readonly NotificationItem[]>(
    () =>
      serverItems.map((item) => ({
        ...item,
        read:
          readIds.has(item.id) ||
          (lastViewedAt !== '' && item.createdAt <= lastViewedAt),
      })),
    [serverItems, lastViewedAt, readIds],
  )

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

/** ADR-147 EP-B：admin shell 任务 polling + Redis 降级感知 */
export function useAdminTasks(): UseAdminTasksResult {
  const [items, setItems] = useState<readonly TaskItem[]>([])
  const [degraded, setDegraded] = useState(false)

  const reload = useCallback(async () => {
    try {
      const res = await apiClient.get<JobsListResponse>('/admin/system/jobs')
      setItems(res.data)
      setDegraded(res.meta.degraded === true)
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) return
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = setInterval(() => {
      void reload()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [reload])

  return { items, degraded, reload }
}
