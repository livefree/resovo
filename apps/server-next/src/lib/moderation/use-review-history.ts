/**
 * use-review-history.ts — 审核台 RightPane.History 时间线数据 hook
 *
 * CHG-SN-4-FIX-C：调用 GET /admin/moderation/:id/audit-log（target_kind='video'）
 * 返回 audit_log 时间线 + 分页 + loading/error 状态机。
 *
 * 不复用 SWR/useTableQuery：本 hook 使用面单一（仅 RightPane.History Tab），
 * 切换 videoId 时清空 + 重新拉取首页；分页 loadPage 由消费方触发。
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchVideoAuditLog } from '@/lib/moderation/api'
import type { AuditLogQueryRow } from '@/lib/moderation/api'

export interface UseReviewHistoryState {
  readonly events: readonly AuditLogQueryRow[]
  readonly loading: boolean
  readonly error: string | null
  readonly page: number
  readonly total: number
  readonly limit: number
  readonly hasNext: boolean
}

export interface UseReviewHistoryActions {
  readonly loadPage: (page: number) => Promise<void>
  readonly reload: () => Promise<void>
}

const INITIAL_STATE: UseReviewHistoryState = {
  events: [],
  loading: false,
  error: null,
  page: 1,
  total: 0,
  limit: 20,
  hasNext: false,
}

export function useReviewHistory(
  videoId: string | null,
): readonly [UseReviewHistoryState, UseReviewHistoryActions] {
  const [state, setState] = useState<UseReviewHistoryState>(INITIAL_STATE)
  const cancelledRef = useRef(false)

  const loadPage = useCallback(async (page: number) => {
    if (!videoId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetchVideoAuditLog(videoId, page, INITIAL_STATE.limit)
      if (cancelledRef.current) return
      setState({
        events: res.data,
        loading: false,
        error: null,
        page: res.pagination.page,
        total: res.pagination.total,
        limit: res.pagination.limit,
        hasNext: res.pagination.hasNext,
      })
    } catch {
      if (cancelledRef.current) return
      setState((s) => ({ ...s, loading: false, error: '加载失败' }))
    }
  }, [videoId])

  const reload = useCallback(() => loadPage(state.page), [loadPage, state.page])

  useEffect(() => {
    cancelledRef.current = false
    if (!videoId) {
      setState(INITIAL_STATE)
      return
    }
    void loadPage(1)
    return () => {
      cancelledRef.current = true
    }
  }, [videoId, loadPage])

  return [state, { loadPage, reload }] as const
}
