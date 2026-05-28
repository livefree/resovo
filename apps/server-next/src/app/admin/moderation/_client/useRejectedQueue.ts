'use client'

/**
 * useRejectedQueue.ts — 审核台 rejected 队列 hook（CHG-SN-9-REJECTED-ENHANCE-A / plan §5 P2 / plan §7 拆 -A 分页）
 *
 * 职责（仿 usePendingQueue 精简版 / 业务面更小 / 不含 approve/reject/批量）：
 *   - 拉取 rejected 队列 + page+limit 分页 loadMore + 自动预取（near-end）
 *   - activeIdx sessionStorage per-tab 持久化（'rejected' tab）
 *   - 单条 reopen + 本地 splice + 失败 throw（caller 显示错误）
 *   - error 暴露 + setError 让 caller 显示批量动作错误
 *
 * 不在职责内：
 *   - filters / selectedIds / batchMode（rejected 当前无批量 reopen / -B 子卡承接）
 *   - 视觉对齐（BTN_SM → AdminButton / SplitPane 复用） → CHG-SN-9-REJECTED-ENHANCE-B follow-up
 *
 * 与 usePendingQueue 差异：
 *   - 用 page+limit 模式（后端 /admin/videos?reviewStatus=rejected&page=N&limit=M 既有契约）
 *     而非 usePendingQueue 的 cursor 模式（pending 用 cursor 因为分页跨 fetch 集合稳定）
 *   - 无 todayStats / 无 approveAt / 无 batchApprove / 无 batchReject / 无 updateStaffNoteLocal
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RejectedVideoRow } from '@/lib/moderation/api'
import * as api from '@/lib/moderation/api'
import { M } from '@/i18n/messages/zh-CN/moderation'

const TAB_KEY = 'rejected'
const PAGE_LIMIT = 30
const NEAR_END_THRESHOLD = 5

export interface UseRejectedQueueResult {
  readonly videos: RejectedVideoRow[]
  readonly page: number
  readonly total: number
  readonly hasMore: boolean
  readonly activeIdx: number
  readonly loading: boolean
  readonly loadingMore: boolean
  readonly error: string | null

  readonly setActiveIdx: (updater: number | ((prev: number) => number)) => void
  readonly loadMore: () => void
  /** reopen 指定 idx 视频（默认 activeIdx）；成功后本地 splice / 失败抛错 caller 显示 */
  readonly reopenAt: (idx?: number) => Promise<void>
  /** 手动刷新（reset 到 page=1） */
  readonly refetch: () => Promise<void>
  readonly setError: (msg: string | null) => void
}

export function useRejectedQueue(enabled = true): UseRejectedQueueResult {
  const [videos, setVideos] = useState<RejectedVideoRow[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [activeIdxRaw, setActiveIdxRaw] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasMore = videos.length < total

  // page ref 让 loadMore useCallback 无依赖 / 防引用 churn 触发 useEffect 风暴
  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page }, [page])

  const setActiveIdx = useCallback((updater: number | ((prev: number) => number)) => {
    setActiveIdxRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { sessionStorage.setItem(`admin.moderation.${TAB_KEY}.activeIdx.v1`, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  // 初次 mount restore activeIdx from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`admin.moderation.${TAB_KEY}.activeIdx.v1`)
      setActiveIdxRaw(stored ? Math.max(0, parseInt(stored, 10)) : 0)
    } catch { setActiveIdxRaw(0) }
  }, [])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.fetchRejectedVideos(1, PAGE_LIMIT)
      setVideos(res.data as RejectedVideoRow[])
      setPage(1)
      setTotal(res.total)
    } catch {
      setError(M.rejected.errors.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [])

  // 启动时拉一次（enabled 切换不会拉第二次 / 仅 enabled 0→1 或 mount 时拉）
  useEffect(() => {
    if (!enabled) return
    void refetch()
  }, [enabled, refetch])

  const loadMore = useCallback(() => {
    if (loadingMore) return
    const nextPage = pageRef.current + 1
    setLoadingMore(true)
    api.fetchRejectedVideos(nextPage, PAGE_LIMIT)
      .then(res => {
        const newRows = res.data as RejectedVideoRow[]
        setVideos(prev => [...prev, ...newRows])
        setPage(nextPage)
        setTotal(res.total)
      })
      .catch(() => { /* silent loadMore 失败 / 用户可重试 / 不弹错防中断浏览 */ })
      .finally(() => setLoadingMore(false))
  }, [loadingMore])

  // near-end 预取（activeIdx >= length - 5 + length > 5 防短列表 spurious + hasMore + !loadingMore）
  // length > NEAR_END_THRESHOLD 守卫：防短列表（length ≤ 5）时 length - 5 ≤ 0 导致 activeIdx=0 即触发
  // 真实场景：page=1 limit=30 → length=30 → 守卫不触发；用户翻到 25 行 → length-5=25 → loadMore 正常
  useEffect(() => {
    if (
      videos.length > NEAR_END_THRESHOLD &&
      activeIdxRaw >= videos.length - NEAR_END_THRESHOLD &&
      hasMore &&
      !loadingMore
    ) {
      loadMore()
    }
  }, [activeIdxRaw, videos.length, hasMore, loadingMore, loadMore])

  const reopenAt = useCallback(async (idx?: number) => {
    const targetIdx = idx ?? activeIdxRaw
    const current = videos[targetIdx]
    if (!current) return
    try {
      await api.reopenVideo(current.id)
      const newVideos = videos.filter(item => item.id !== current.id)
      setVideos(newVideos)
      setTotal(t => Math.max(0, t - 1))
      setActiveIdx(Math.min(targetIdx, Math.max(0, newVideos.length - 1)))
    } catch {
      setError(M.rejected.errors.reopenFailed)
      throw new Error(M.rejected.errors.reopenFailed)
    }
  }, [videos, activeIdxRaw, setActiveIdx])

  return {
    videos,
    page,
    total,
    hasMore,
    activeIdx: activeIdxRaw,
    loading,
    loadingMore,
    error,
    setActiveIdx,
    loadMore,
    reopenAt,
    refetch,
    setError,
  }
}
