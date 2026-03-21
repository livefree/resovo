'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError } from '@/lib/api-client'
import type { CrawlMode, CrawlTaskDTO } from '@/components/admin/system/crawler-site/crawlTask.types'
import {
  getLatestCrawlTaskBySite,
  getLatestCrawlTasksBySites,
  triggerSiteCrawlTask,
} from '@/components/admin/system/crawler-site/services/crawlTaskService'

interface UseCrawlerSiteCrawlTasksOptions {
  refreshSitesSilently?: () => Promise<void>
  onTaskSettled?: (siteKeys: string[]) => Promise<void> | void
  showToast: (message: string, ok: boolean) => void
  pollIntervalMs?: number
}

interface UseCrawlerSiteCrawlTasksResult {
  runningBySite: Record<string, boolean>
  runningModeBySite: Record<string, CrawlMode | null>
  latestTaskBySite: Record<string, CrawlTaskDTO | null>
  hydrateRunningFromSites: (siteKeys: string[]) => Promise<void>
  triggerSiteCrawl: (siteKey: string, mode: CrawlMode, siteName?: string) => Promise<void>
}

export function useCrawlerSiteCrawlTasks({
  refreshSitesSilently,
  onTaskSettled,
  showToast,
  pollIntervalMs = 3000,
}: UseCrawlerSiteCrawlTasksOptions): UseCrawlerSiteCrawlTasksResult {
  const [runningBySite, setRunningBySite] = useState<Record<string, boolean>>({})
  const [runningModeBySite, setRunningModeBySite] = useState<Record<string, CrawlMode | null>>({})
  const [latestTaskBySite, setLatestTaskBySite] = useState<Record<string, CrawlTaskDTO | null>>({})

  const activeSitesRef = useRef<Set<string>>(new Set())
  const notifiedTaskIdsRef = useRef<Set<string>>(new Set())

  const syncLatestTasks = useCallback(async () => {
    try {
      const activeSiteKeys = Array.from(activeSitesRef.current)
      if (activeSiteKeys.length === 0) return

      let tasks = await getLatestCrawlTasksBySites(activeSiteKeys)
      if (tasks.length === 0 && activeSiteKeys.length === 1) {
        // 兼容接口：单站调试/降级
        const fallback = await getLatestCrawlTaskBySite(activeSiteKeys[0])
        tasks = fallback ? [fallback] : []
      }

      const taskBySite = new Map(tasks.map((task) => [task.siteKey, task]))
      setLatestTaskBySite((prev) => {
        const next = { ...prev }
        for (const siteKey of activeSiteKeys) {
          next[siteKey] = taskBySite.get(siteKey) ?? null
        }
        return next
      })

      const completedSites: string[] = []
      for (const siteKey of activeSiteKeys) {
        const latest = taskBySite.get(siteKey)
        if (!latest) continue

        if (latest.status === 'queued' || latest.status === 'running' || latest.status === 'paused') {
          setRunningBySite((prev) => ({ ...prev, [siteKey]: true }))
          setRunningModeBySite((prev) => ({ ...prev, [siteKey]: latest.mode }))
          continue
        }

        completedSites.push(siteKey)
        activeSitesRef.current.delete(siteKey)
        setRunningBySite((prev) => ({ ...prev, [siteKey]: false }))
        setRunningModeBySite((prev) => ({ ...prev, [siteKey]: null }))

        if (!notifiedTaskIdsRef.current.has(latest.id)) {
          notifiedTaskIdsRef.current.add(latest.id)
          if (latest.status === 'success') {
            showToast(
              latest.itemCount !== null
                ? `采集完成：新增/更新 ${latest.itemCount} 条`
                : '采集完成',
              true
            )
          } else if (latest.status === 'failed') {
            showToast(latest.message ? `采集失败：${latest.message}` : '采集失败', false)
          }
        }
      }

      if (completedSites.length > 0) {
        if (refreshSitesSilently) {
          await refreshSitesSilently()
        }
        if (onTaskSettled) {
          await onTaskSettled(completedSites)
        }
      }
    } catch {
      // 轮询失败不中断 UI，可等待下一轮重试
    }
  }, [onTaskSettled, refreshSitesSilently, showToast])

  useEffect(() => {
    if (activeSitesRef.current.size === 0) return
    const timer = window.setInterval(() => {
      void syncLatestTasks()
    }, pollIntervalMs)
    return () => window.clearInterval(timer)
  }, [pollIntervalMs, syncLatestTasks])

  const triggerSiteCrawl = useCallback(
    async (siteKey: string, mode: CrawlMode, siteName?: string) => {
      if (runningBySite[siteKey]) {
        showToast(`${siteName ?? siteKey} 已有采集任务在运行`, false)
        return
      }

      setRunningBySite((prev) => ({ ...prev, [siteKey]: true }))
      setRunningModeBySite((prev) => ({ ...prev, [siteKey]: mode }))
      activeSitesRef.current.add(siteKey)

      try {
        await triggerSiteCrawlTask(siteKey, mode)
        showToast(`已触发 ${siteName ?? siteKey} ${mode === 'full' ? '全量' : '增量'}采集`, true)
        await syncLatestTasks()
      } catch (error) {
        activeSitesRef.current.delete(siteKey)
        setRunningBySite((prev) => ({ ...prev, [siteKey]: false }))
        setRunningModeBySite((prev) => ({ ...prev, [siteKey]: null }))

        if (error instanceof ApiClientError && error.status === 409) {
          showToast(`${siteName ?? siteKey} 已有采集任务在运行`, false)
          return
        }

        showToast(`${siteName ?? siteKey} 采集触发失败`, false)
      }
    },
    [runningBySite, showToast, syncLatestTasks]
  )

  const hydrateRunningFromSites = useCallback(async (siteKeys: string[]) => {
    if (siteKeys.length === 0) return
    try {
      const tasks = await getLatestCrawlTasksBySites(siteKeys)
      const taskBySite = new Map(tasks.map((task) => [task.siteKey, task]))

      setLatestTaskBySite((prev) => {
        const next = { ...prev }
        for (const siteKey of siteKeys) {
          next[siteKey] = taskBySite.get(siteKey) ?? null
        }
        return next
      })

      setRunningBySite((prev) => {
        const next = { ...prev }
        for (const siteKey of siteKeys) {
          const task = taskBySite.get(siteKey)
          const isRunning = task?.status === 'queued' || task?.status === 'running' || task?.status === 'paused'
          next[siteKey] = Boolean(isRunning)
          if (isRunning) activeSitesRef.current.add(siteKey)
          else activeSitesRef.current.delete(siteKey)
        }
        return next
      })

      setRunningModeBySite((prev) => {
        const next = { ...prev }
        for (const siteKey of siteKeys) {
          const task = taskBySite.get(siteKey)
          next[siteKey] = task && (task.status === 'queued' || task.status === 'running' || task.status === 'paused') ? task.mode : null
        }
        return next
      })
    } catch {
      // 首次恢复失败不阻塞页面
    }
  }, [])

  return {
    runningBySite,
    runningModeBySite,
    latestTaskBySite,
    hydrateRunningFromSites,
    triggerSiteCrawl,
  }
}
