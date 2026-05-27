'use client'

/**
 * usePendingQueue.ts — 审核台 pending 队列 hook（CHG-347 / SPLIT-A）
 *
 * 职责：
 *   - 拉取 pending 队列 + cursor 分页 loadMore + 自动预取（near-end）
 *   - activeIdx sessionStorage per-tab 持久化
 *   - 单条乐观 approve / reject + 失败回滚（splice 回原位）
 *   - 批量 approve / reject（返回 { ok, failed, failedIds? }）
 *   - 本地更新 staffNote（不调 API，由 PendingCenter 外部调 updateStaffNote 后通知 hook）
 *   - error 暴露（caller 也可写，用于批量动作错误统一显示）
 *
 * 不在职责内：
 *   - selectedIds / batchModeOn / approveAndPublishOn 持久化 / toast / reviewLabels
 *     这些都留在 ModerationConsole（caller 自己管批量 UI + 业务策略）
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { VideoQueueRow } from '@resovo/types'
import type { RejectModalSubmitPayload } from '@resovo/admin-ui'
import * as api from '@/lib/moderation/api'
import { M } from '@/i18n/messages/zh-CN/moderation'
import type { FilterPresetQuery } from '@/lib/moderation/use-filter-presets'

/** CHG-350：扩 FilterPresetQuery 加 q（title 搜索词；不进预设语义，只动态传给 fetch） */
export interface PendingQueueFilters extends FilterPresetQuery {
  readonly q?: string
}

export interface UsePendingQueueOptions {
  /** sessionStorage key 命名（'pending' / 'rejected' 等） */
  readonly tab: string
  /** approve 时是否走 approve_and_publish action（admin 角色） */
  readonly approveAndPublishOn: boolean
  /** false → 不自动 fetch（用于 tab !== 'pending' 时禁用） */
  readonly enabled?: boolean
}

export interface UsePendingQueueResult {
  readonly videos: VideoQueueRow[]
  readonly nextCursor: string | null
  readonly total: number
  readonly todayStats: { reviewed: number; approveRate: number | null }
  readonly activeIdx: number
  readonly loading: boolean
  readonly loadingMore: boolean
  readonly error: string | null

  readonly setActiveIdx: (updater: number | ((prev: number) => number)) => void
  readonly loadMore: () => void
  /** 通过指定 idx 视频（默认 activeIdx）；乐观更新 + 失败回滚 */
  readonly approveAt: (idx?: number) => Promise<void>
  /** 拒绝指定 idx 视频（默认 activeIdx）；乐观更新 + 失败 throw（caller 显示 modal 错误） */
  readonly rejectAt: (idx: number | undefined, payload: RejectModalSubmitPayload) => Promise<void>
  /** 批量通过；后端返回 { ok, failed, failedIds? } 透传 */
  readonly batchApprove: (ids: readonly string[]) => Promise<{ ok: number; failed: number; failedIds?: readonly string[] }>
  /** 批量拒绝；后端返回 { ok, failed, failedIds? } 透传 */
  readonly batchReject: (ids: readonly string[], payload: RejectModalSubmitPayload) => Promise<{ ok: number; failed: number; failedIds?: readonly string[] }>
  /** 本地仅更新单条视频的 staffNote 字段（API 调用由 PendingCenter 在外侧负责） */
  readonly updateStaffNoteLocal: (videoId: string, note: string | null) => void
  /** 手动刷新（filter 切换 / 编辑保存后） */
  readonly refetch: () => Promise<void>
  readonly setError: (msg: string | null) => void
}

export function usePendingQueue(
  filters: PendingQueueFilters,
  options: UsePendingQueueOptions,
): UsePendingQueueResult {
  const { tab, approveAndPublishOn, enabled = true } = options

  const [videos, setVideos] = useState<VideoQueueRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [todayStats, setTodayStats] = useState<{ reviewed: number; approveRate: number | null }>({ reviewed: 0, approveRate: null })
  const [activeIdxRaw, setActiveIdxRaw] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tabRef = useRef(tab)
  useEffect(() => { tabRef.current = tab }, [tab])

  // CHG-355 R1：filters 用 ref 持有最新值，refetch/loadMore 不依赖 filters 引用变化
  //   防 ModerationConsole 每次 re-render 重算 queueFilters useMemo → 新引用 →
  //   refetch useCallback 重建 → useEffect 重跑 → fetch 风暴 + setLoading(true) 风暴
  //   触发 trigger 改用 filters 内容稳定 key（JSON.stringify）控制
  const filtersRef = useRef(filters)
  useEffect(() => { filtersRef.current = filters }, [filters])
  const filtersKey = JSON.stringify(filters)

  const setActiveIdx = useCallback((updater: number | ((prev: number) => number)) => {
    setActiveIdxRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { sessionStorage.setItem(`admin.moderation.${tabRef.current}.activeIdx.v1`, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  // restore activeIdx from sessionStorage when tab changes
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`admin.moderation.${tab}.activeIdx.v1`)
      setActiveIdxRaw(stored ? Math.max(0, parseInt(stored, 10)) : 0)
    } catch { setActiveIdxRaw(0) }
  }, [tab])

  // CHG-355 R1：空依赖 useCallback → 引用稳定 → 不再让 useEffect 因引用变化重跑
  //   内部用 filtersRef.current 读最新 filters（同步事件链可靠）
  const refetch = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.log('[CHG-358 DEBUG] usePendingQueue.refetch called / filters=', filtersRef.current)
    setLoading(true)
    setError(null)
    try {
      const res = await api.fetchPendingQueue(filtersRef.current)
      // eslint-disable-next-line no-console
      console.log('[CHG-358 DEBUG] fetchPendingQueue returned', res.data.length, 'videos')
      // CHG-358-DEBUG2：dump 测试视频 2563b359 probe/render 实际值
      const testVideo = res.data.find((v: { id: string }) => v.id?.startsWith('2563b359'))
      if (testVideo) {
        // eslint-disable-next-line no-console
        console.log('[CHG-358 DEBUG2] test video 2563b359 probe/render:', JSON.stringify(testVideo))
      } else {
        // eslint-disable-next-line no-console
        console.log('[CHG-358 DEBUG2] test video 2563b359 NOT in returned page / 30 video ids:', res.data.map((v: { id: string }) => v.id))
      }
      setVideos(res.data as VideoQueueRow[])
      setNextCursor(res.nextCursor)
      setTotal(res.total)
      setTodayStats(res.todayStats)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[CHG-358 DEBUG] fetchPendingQueue failed', e)
      setError(M.errors.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [])

  // 仅在 enabled / filters 内容真变（按 JSON 序列化 key 比较）时触发 refetch
  useEffect(() => {
    if (!enabled) return
    void refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filtersKey])

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    api.fetchPendingQueue({ ...filtersRef.current, cursor: nextCursor })
      .then(res => {
        setVideos(prev => [...prev, ...(res.data as VideoQueueRow[])])
        setNextCursor(res.nextCursor)
        setTotal(res.total)
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoadingMore(false))
  }, [nextCursor, loadingMore])

  // auto-load more when activeIdx near end
  useEffect(() => {
    if (videos.length > 0 && activeIdxRaw >= videos.length - 5 && nextCursor && !loadingMore) {
      loadMore()
    }
  }, [activeIdxRaw, videos.length, nextCursor, loadingMore, loadMore])

  const approveAt = useCallback(async (idx?: number) => {
    const targetIdx = idx ?? activeIdxRaw
    const current = videos[targetIdx]
    if (!current) return
    const savedV = current
    const savedIdx = targetIdx
    const newVideos = videos.filter((_, i) => i !== savedIdx)
    setVideos(newVideos)
    setTotal(t => Math.max(0, t - 1))
    setActiveIdx(Math.min(savedIdx, Math.max(0, newVideos.length - 1)))
    try {
      await api.approveVideo(savedV.id, approveAndPublishOn)
    } catch {
      setVideos(prev => { const next = [...prev]; next.splice(savedIdx, 0, savedV); return next })
      setTotal(t => t + 1)
      setError(M.errors.approveFailed)
    }
  }, [videos, activeIdxRaw, approveAndPublishOn, setActiveIdx])

  const rejectAt = useCallback(async (idx: number | undefined, payload: RejectModalSubmitPayload) => {
    const targetIdx = idx ?? activeIdxRaw
    const current = videos[targetIdx]
    if (!current) return
    try {
      await api.rejectVideo(current.id, payload, current.updatedAt)
      const newVideos = videos.filter(item => item.id !== current.id)
      setVideos(newVideos)
      setTotal(t => Math.max(0, t - 1))
      setActiveIdx(Math.min(targetIdx, Math.max(0, newVideos.length - 1)))
    } catch {
      setError(M.errors.rejectFailed)
      throw new Error(M.errors.rejectFailed)
    }
  }, [videos, activeIdxRaw, setActiveIdx])

  const batchApprove = useCallback(async (ids: readonly string[]) => {
    if (ids.length === 0) return { ok: 0, failed: 0 }
    try {
      const result = await api.batchApproveVideos([...ids])
      const idSet = new Set(ids)
      setVideos(prev => prev.filter(v => !idSet.has(v.id)))
      setTotal(t => Math.max(0, t - result.ok))
      setError(null)
      return result
    } catch {
      setError(M.errors.approveFailed)
      throw new Error(M.errors.approveFailed)
    }
  }, [])

  const batchReject = useCallback(async (ids: readonly string[], payload: RejectModalSubmitPayload) => {
    if (ids.length === 0) return { ok: 0, failed: 0 }
    try {
      const result = await api.batchRejectVideos([...ids], payload.reason ?? '批量拒绝', payload.labelKey)
      const idSet = new Set(ids)
      setVideos(prev => prev.filter(v => !idSet.has(v.id)))
      setTotal(t => Math.max(0, t - result.ok))
      return result
    } catch {
      setError(M.errors.rejectFailed)
      throw new Error(M.errors.rejectFailed)
    }
  }, [])

  const updateStaffNoteLocal = useCallback((videoId: string, note: string | null) => {
    setVideos(prev => prev.map(item => item.id === videoId ? { ...item, staffNote: note } : item))
  }, [])

  return {
    videos,
    nextCursor,
    total,
    todayStats,
    activeIdx: activeIdxRaw,
    loading,
    loadingMore,
    error,
    setActiveIdx,
    loadMore,
    approveAt,
    rejectAt,
    batchApprove,
    batchReject,
    updateStaffNoteLocal,
    refetch,
    setError,
  }
}
