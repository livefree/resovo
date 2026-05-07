'use client'

/**
 * use-sources.ts — VideoEditDrawer 线路 Tab 数据层 hook（CHG-SN-4-08）
 */

import { useState, useCallback, useEffect } from 'react'
import type { VideoSource, SignalStatus } from './types'
import type { DualSignalDisplayState } from '@resovo/types'
import {
  listVideoSources,
  toggleVideoSource,
  disableDeadSources,
  refetchSources,
  getLineHealthEvents,
  type LineHealthResult,
} from './api'

export type { VideoSource, SignalStatus }

export interface SourcesState {
  sources: VideoSource[]
  loading: boolean
  error: Error | null
  togglePending: Set<string>
  bulkPending: boolean
  refetchPending: boolean
  health: LineHealthResult | null
  healthLoading: boolean
  healthSourceId: string | null
  healthPage: number
}

export interface SourcesActions {
  reload: () => void
  toggle: (sourceId: string, isActive: boolean) => Promise<void>
  disableDead: () => Promise<void>
  refetch: (siteKeys?: string[]) => Promise<void>
  openHealth: (sourceId: string) => void
  closeHealth: () => void
  loadHealthPage: (page: number) => void
}

export function toDisplayState(status: SignalStatus): DualSignalDisplayState {
  if (status === 'pending') return 'pending'
  return status
}

export function useVideoSources(videoId: string): [SourcesState, SourcesActions] {
  const [sources, setSources] = useState<VideoSource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [togglePending, setTogglePending] = useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = useState(false)
  const [refetchPending, setRefetchPending] = useState(false)
  const [health, setHealth] = useState<LineHealthResult | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthSourceId, setHealthSourceId] = useState<string | null>(null)
  const [healthPage, setHealthPage] = useState(1)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    listVideoSources(videoId)
      .then(setSources)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [videoId])

  useEffect(() => { reload() }, [reload])

  const toggle = useCallback(async (sourceId: string, isActive: boolean) => {
    const target = sources.find((s) => s.id === sourceId)
    setTogglePending((prev) => new Set(prev).add(sourceId))
    const snapshot = sources
    setSources((prev) => prev.map((s) => s.id === sourceId ? { ...s, is_active: isActive } : s))
    try {
      // CHG-SN-5-PRE-01-C：透传 updated_at 启用乐观锁；server 不匹配抛 409 REVIEW_RACE
      const res = await toggleVideoSource(videoId, sourceId, isActive, target?.updated_at)
      // 用 server 返回的新 updated_at 同步本地版本，下次 toggle 用最新版本
      const fresh = res.data
      setSources((prev) => prev.map((s) => s.id === sourceId ? { ...s, ...fresh } : s))
    } catch (e: unknown) {
      const isRace = typeof e === 'object' && e !== null
        && (('code' in e && (e as { code: unknown }).code === 'REVIEW_RACE')
        || ('status' in e && (e as { status: unknown }).status === 409))
      if (isRace) {
        // 409 REVIEW_RACE：用 server 真相覆盖，避免落到 snapshot（已被对方改过的旧值）
        try {
          const fresh = await listVideoSources(videoId)
          setSources(fresh)
        } catch {
          setSources(snapshot)  // 重载也失败 → 回滚到调用前
        }
      } else {
        setSources(snapshot)  // 非 race 错误 → 回滚乐观更新
      }
      throw e
    } finally {
      setTogglePending((prev) => { const next = new Set(prev); next.delete(sourceId); return next })
    }
  }, [videoId, sources])

  const disableDead = useCallback(async () => {
    setBulkPending(true)
    try {
      await disableDeadSources(videoId)
      await listVideoSources(videoId).then(setSources)
    } finally {
      setBulkPending(false)
    }
  }, [videoId])

  const refetch = useCallback(async (siteKeys?: string[]) => {
    setRefetchPending(true)
    try { await refetchSources(videoId, siteKeys) } finally { setRefetchPending(false) }
  }, [videoId])

  const loadHealth = useCallback((sid: string, page: number) => {
    setHealthLoading(true)
    getLineHealthEvents(videoId, sid, page)
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false))
  }, [videoId])

  const openHealth = useCallback((sourceId: string) => {
    setHealthSourceId(sourceId)
    setHealthPage(1)
    loadHealth(sourceId, 1)
  }, [loadHealth])

  const closeHealth = useCallback(() => {
    setHealthSourceId(null)
    setHealth(null)
  }, [])

  const loadHealthPage = useCallback((page: number) => {
    setHealthPage(page)
    if (healthSourceId) loadHealth(healthSourceId, page)
  }, [healthSourceId, loadHealth])

  const state: SourcesState = {
    sources, loading, error, togglePending, bulkPending, refetchPending,
    health, healthLoading, healthSourceId, healthPage,
  }

  const actions: SourcesActions = { reload, toggle, disableDead, refetch, openHealth, closeHealth, loadHealthPage }

  return [state, actions]
}
