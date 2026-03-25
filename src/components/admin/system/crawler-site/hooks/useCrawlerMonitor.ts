'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'

export interface CrawlerOverview {
  siteTotal: number
  connected: number
  running: number
  paused: number
  failed: number
  todayVideos: number
  todayDurationMs: number
}

export interface CrawlerRunSummary {
  id: string
  triggerType: 'single' | 'batch' | 'all' | 'schedule'
  mode: 'incremental' | 'full'
  status: 'queued' | 'running' | 'paused' | 'success' | 'partial_failed' | 'failed' | 'cancelled'
  controlStatus: 'active' | 'pausing' | 'paused' | 'cancelling' | 'cancelled'
  summary: Record<string, unknown> | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

export interface CrawlerSystemStatus {
  schedulerEnabled: boolean
  freezeEnabled: boolean
  orphanTaskCount: number
}

interface UseCrawlerMonitorOptions {
  pollIntervalMs?: number
  showToast: (message: string, ok: boolean) => void
}

export function useCrawlerMonitor({
  pollIntervalMs = 5000,
  showToast,
}: UseCrawlerMonitorOptions) {
  const [overview, setOverview] = useState<CrawlerOverview | null>(null)
  const [runs, setRuns] = useState<CrawlerRunSummary[]>([])
  const [systemStatus, setSystemStatus] = useState<CrawlerSystemStatus | null>(null)
  const [stopAllPending, setStopAllPending] = useState(false)
  const [freezeSwitchPending, setFreezeSwitchPending] = useState(false)

  const fetchOverview = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: CrawlerOverview }>('/admin/crawler/overview')
      setOverview(res.data)
    } catch {
      // 非阻塞
    }
  }, [])

  const fetchRuns = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: CrawlerRunSummary[] }>('/admin/crawler/runs?limit=20')
      setRuns(res.data)
    } catch {
      // 非阻塞
    }
  }, [])

  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: CrawlerSystemStatus }>('/admin/crawler/system-status')
      setSystemStatus(res.data)
    } catch {
      // 非阻塞
    }
  }, [])

  const refreshMonitor = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        data: {
          overview: CrawlerOverview
          runs: CrawlerRunSummary[]
          systemStatus: CrawlerSystemStatus
        }
      }>('/admin/crawler/monitor-snapshot')
      setOverview(res.data.overview)
      setRuns(res.data.runs)
      setSystemStatus(res.data.systemStatus)
    } catch {
      // 聚合接口失败时降级为 3 个独立请求
      await Promise.all([fetchOverview(), fetchRuns(), fetchSystemStatus()])
    }
  }, [fetchOverview, fetchRuns, fetchSystemStatus])

  useEffect(() => {
    void refreshMonitor()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshMonitor()
    }, pollIntervalMs)
    return () => window.clearInterval(timer)
  }, [pollIntervalMs, refreshMonitor])

  const runningRuns = useMemo(
    () =>
      runs.filter((run) =>
        run.status === 'running' ||
        run.status === 'queued' ||
        run.status === 'paused' ||
        run.controlStatus === 'cancelling' ||
        run.controlStatus === 'pausing',
      ),
    [runs],
  )

  const recentRuns = useMemo(
    () => runs.filter((run) => run.status === 'success' || run.status === 'partial_failed' || run.status === 'failed' || run.status === 'cancelled'),
    [runs],
  )

  const pauseRun = useCallback(
    async (runId: string) => {
      try {
        await apiClient.post(`/admin/crawler/runs/${runId}/pause`)
        showToast('已发送暂停请求', true)
        await fetchRuns()
      } catch {
        showToast('暂停批次失败', false)
      }
    },
    [fetchRuns, showToast],
  )

  const resumeRun = useCallback(
    async (runId: string) => {
      try {
        await apiClient.post(`/admin/crawler/runs/${runId}/resume`)
        showToast('已发送恢复请求', true)
        await fetchRuns()
      } catch {
        showToast('恢复批次失败', false)
      }
    },
    [fetchRuns, showToast],
  )

  const cancelRun = useCallback(
    async (runId: string) => {
      try {
        await apiClient.post(`/admin/crawler/runs/${runId}/cancel`)
        showToast('已发送中止请求', true)
        await fetchRuns()
      } catch {
        showToast('中止批次失败', false)
      }
    },
    [fetchRuns, showToast],
  )

  const stopAll = useCallback(async () => {
    setStopAllPending(true)
    try {
      await apiClient.post('/admin/crawler/stop-all', {
        freeze: true,
        removeRepeatableTick: true,
      })
      showToast('已执行 stop-all（冻结 + 取消活跃任务）', true)
      await refreshMonitor()
    } catch {
      showToast('执行 stop-all 失败', false)
    } finally {
      setStopAllPending(false)
    }
  }, [refreshMonitor, showToast])

  const setFreezeEnabled = useCallback(async (enabled: boolean) => {
    setFreezeSwitchPending(true)
    try {
      await apiClient.post('/admin/crawler/freeze', { enabled })
      showToast(enabled ? '已开启全局冻结' : '已关闭全局冻结', true)
      await refreshMonitor()
    } catch {
      showToast(enabled ? '开启全局冻结失败' : '关闭全局冻结失败', false)
    } finally {
      setFreezeSwitchPending(false)
    }
  }, [refreshMonitor, showToast])

  return {
    overview,
    runs,
    systemStatus,
    runningRuns,
    recentRuns,
    fetchOverview,
    fetchRuns,
    fetchSystemStatus,
    refreshMonitor,
    pauseRun,
    resumeRun,
    cancelRun,
    stopAll,
    setFreezeEnabled,
    stopAllPending,
    freezeSwitchPending,
  }
}
