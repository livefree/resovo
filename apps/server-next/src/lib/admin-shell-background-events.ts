/**
 * admin-shell-background-events.ts — BackgroundEventBell SWR-style polling hook
 * CW1-E-EP step 7 / ADR-152 D-152-3/4
 *
 * 数据源（ADR-152 §1）：
 *   GET /v1/admin/system/background-events → AdminBackgroundEvent[]
 *
 * 推送模型（ADR-152 D-152-3/4）：
 *   - 前端 polling 60s（refreshInterval: 60_000ms）
 *   - dedupingInterval: 15_000ms（避免 mount 抖动重复请求）
 *   - errorRetryCount: 3（admin 后台不需要激进重试）
 *   - mutate 供 CrawlerClient 触发写操作后显式跳过 max-age（Y-152-4）
 *
 * 同范式：admin-shell-notifications.ts（ADR-147）
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdminBackgroundEvent } from '@resovo/types'
import { apiClient, ApiClientError } from '@/lib/api-client'

const BACKGROUND_EVENTS_URL = '/admin/system/background-events'
const POLL_INTERVAL_MS = 60_000
const DEDUP_INTERVAL_MS = 15_000
const MAX_ERROR_RETRIES = 3

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

export interface UseAdminBackgroundEventsResult {
  readonly events: readonly AdminBackgroundEvent[]
  readonly degraded: boolean
  /** 显式触发一次重新拉取（供 CrawlerClient Y-152-4 mutate invalidate 调用） */
  readonly mutate: () => Promise<void>
}

/** 全局 mutate 注册表：让 CrawlerClient 无需 prop drilling 即可触发 invalidate */
const globalMutateRegistry = new Set<() => Promise<void>>()

/**
 * ADR-152 Y-152-4：CrawlerClient 触发写操作后调此函数强制 refetch，跳过 max-age=30 缓存。
 * 用法：`import { invalidateBackgroundEvents } from '@/lib/admin-shell-background-events'`
 */
export async function invalidateBackgroundEvents(): Promise<void> {
  await Promise.allSettled([...globalMutateRegistry].map((fn) => fn()))
}

/** ADR-152 D-152-3/4：admin shell 后台事件 polling hook */
export function useAdminBackgroundEvents(): UseAdminBackgroundEventsResult {
  const [events, setEvents] = useState<readonly AdminBackgroundEvent[]>([])
  const [degraded, setDegraded] = useState(false)
  const lastFetchRef = useRef<number>(0)
  const errorCountRef = useRef<number>(0)

  const fetch = useCallback(async () => {
    // dedupingInterval 防抖：15s 内不重复
    if (Date.now() - lastFetchRef.current < DEDUP_INTERVAL_MS) return
    lastFetchRef.current = Date.now()
    try {
      const res = await apiClient.get<BackgroundEventsResponse>(BACKGROUND_EVENTS_URL)
      setEvents(res.data)
      setDegraded(res.meta.degraded === true)
      errorCountRef.current = 0
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) return
      errorCountRef.current += 1
      // errorRetryCount: 3（超出后不 silent，保留最后一次数据）
      if (errorCountRef.current > MAX_ERROR_RETRIES) {
        setDegraded(true)
      }
    }
  }, [])

  const mutate = useCallback(async () => {
    // mutate 跳过 dedup（写操作触发后必须立即 refetch）
    lastFetchRef.current = 0
    await fetch()
  }, [fetch])

  // 注册到全局表（供 invalidateBackgroundEvents 调用）
  useEffect(() => {
    globalMutateRegistry.add(mutate)
    return () => {
      globalMutateRegistry.delete(mutate)
    }
  }, [mutate])

  // 初始加载 + 60s polling
  useEffect(() => {
    void fetch()
    const timer = setInterval(() => {
      void fetch()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetch])

  return { events, degraded, mutate }
}
