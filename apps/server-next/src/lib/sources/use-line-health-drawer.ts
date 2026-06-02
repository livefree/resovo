'use client'

/**
 * use-line-health-drawer.ts — 线路健康事件抽屉「中性状态 + 取数编排」hook
 * （CHG-VSR-6-FOLLOWUP-DRAWER-HOOK / arch-reviewer claude-opus-4-8 蓝图 CONDITIONAL PASS）
 *
 * 抽取 3 处本地实现（审核台 moderation/LinesPanel / 编辑抽屉 videos/TabLines /
 * sources 行展开区 SourceLinesExpand）共享的 open/page/events/total/loading/error 状态 +
 * fetchHealth 取数编排 + 并发竞态保护。达 CLAUDE.md「同一 UI 模式 3 处以上必须提取」阈值。
 *
 * 中性约束（R-5）：
 *   - 不 import 任何消费方内部组件 / 不下沉 i18n（loadFailed 文案经 options 注入，缺省 → 无 error 态）。
 *   - **不持有 probeState/renderState/title**：仅暴露 sourceId，消费方在 render 时从自有 lines 派生
 *     （保留「快照 vs 实时」语义的本地控制〔R-4 审核台保持快照〕+ title i18n 拼接的本地控制）。
 *   - fetchHealth 注入（来自 useSourceLinesController.actions），与 controller 数据所有权一致，不自接 videoId。
 *
 * 并发保护（R-1/R-2）：requestToken 自增 + 响应回写前比对；快速切源 / 翻页 / close 后的 stale
 * 响应一律丢弃，不覆盖当前抽屉（同时修复现有 3 处的 stale 覆盖缺陷）。
 *
 * 分页（R-6）：阈值 `total > limit`，limit 取后端响应真值（禁止硬编码 20）。
 *
 * 依赖方向：lib/sources（→ sources/api 类型），不反向 import /admin/* 内部组件。
 */

import { useState, useCallback, useRef } from 'react'
import type { SourceHealthEvent } from '@resovo/types'
import type { LineHealthPage } from './api'

// 仅空闲态（无响应）回退；有响应后一律用 res.pagination.limit（R-6 禁硬编码）
const DEFAULT_LIMIT = 20

/**
 * 派生分页配置（结构兼容 admin-ui `LineHealthDrawerProps.pagination` / `LineHealthDrawerPagination`；
 * 该类型未从 @resovo/admin-ui barrel 导出，故本地同形态声明 + 结构类型对接）。
 */
export interface HealthDrawerPagination {
  readonly page: number
  readonly total: number
  readonly limit: number
  readonly onPageChange: (page: number) => void
}

// ── State ─────────────────────────────────────────────────────────────

export interface UseLineHealthDrawerState {
  /** Drawer 是否打开（= sourceId !== null）；直接喂 LineHealthDrawerProps.open */
  readonly open: boolean
  /** 当前打开的源 id；消费方据此从自有 lines 派生 title / probeState / renderState */
  readonly sourceId: string | null
  /** 当前页（1-based） */
  readonly page: number
  /** 当前页事件列表（关闭 / 切源时清空） */
  readonly events: readonly SourceHealthEvent[]
  /** 事件总数（分页阈值判定 total > limit） */
  readonly total: number
  /** 后端响应的真实 limit（非硬编码）；空闲态回退 DEFAULT_LIMIT */
  readonly limit: number
  /** 取数中 */
  readonly loading: boolean
  /** 本地化错误文案（null = 无错误）；文案由 options.loadFailedText 注入 */
  readonly error: string | null
  /** 派生分页：total > limit 时可直接喂 LineHealthDrawerProps.pagination，否则 undefined */
  readonly pagination: HealthDrawerPagination | undefined
}

// ── Actions ───────────────────────────────────────────────────────────

export interface UseLineHealthDrawerActions {
  /** 打开抽屉并拉第 1 页；同源重入 = 重拉第 1 页（不短路，保证刷新语义） */
  readonly open: (sourceId: string) => void
  /** 关闭：清空 + 使 in-flight 请求 stale（不回写） */
  readonly close: () => void
  /** 翻页：拉指定页（内建 stale 保护） */
  readonly changePage: (page: number) => void
  /** 重试：重取「当前页」（消费方 error.onRetry 绑定此项） */
  readonly retry: () => void
}

// ── Options ───────────────────────────────────────────────────────────

export interface UseLineHealthDrawerOptions {
  /**
   * 取数函数注入（来自 useSourceLinesController 的 actions.fetchHealth）。
   * hook 不自接 videoId（保持与 controller 数据所有权一致、解耦 + 便于单测）。
   */
  readonly fetchHealth: (sourceId: string, page?: number) => Promise<LineHealthPage>
  /**
   * 取数失败时的本地化错误文案（不下沉 i18n）。
   * - 省略 → error 恒为 null + catch 清空事件（沿用 TabLines 现状：无 error 态）。
   * - 提供 → 失败时 state.error = 该文案（审核台 / sources 展开区现状，配 retry）。
   */
  readonly loadFailedText?: string
}

// ── Hook ──────────────────────────────────────────────────────────────

/**
 * @returns [state, actions] — 与 useSourceLinesController 同形态（元组），消费方心智一致。
 */
export function useLineHealthDrawer(
  options: UseLineHealthDrawerOptions,
): [UseLineHealthDrawerState, UseLineHealthDrawerActions] {
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [events, setEvents] = useState<readonly SourceHealthEvent[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Y-3：options 经 ref 取最新，避免未 memo 的 fetchHealth/loadFailedText 导致 actions 重建
  const optionsRef = useRef(options)
  optionsRef.current = options

  // R-1 竞态令牌：每次 load 自增；响应回写前比对 tokenRef.current === token，stale 丢弃。
  const tokenRef = useRef(0)

  const load = useCallback((targetSourceId: string, targetPage: number) => {
    const token = ++tokenRef.current
    setLoading(true)
    setError(null)
    optionsRef.current.fetchHealth(targetSourceId, targetPage)
      .then((res) => {
        if (tokenRef.current !== token) return // stale → 丢弃
        setEvents(res.data)
        setTotal(res.pagination.total)
        setLimit(res.pagination.limit)
        setPage(targetPage)
        setLoading(false)
      })
      .catch(() => {
        if (tokenRef.current !== token) return // stale → 丢弃（不污染 error）
        setLoading(false)
        const text = optionsRef.current.loadFailedText
        if (text != null) {
          setError(text)
        } else {
          // TabLines 现状：catch → setHealth(null)（无 error 态，静默清空）
          setEvents([])
          setTotal(0)
        }
      })
  }, [])

  const open = useCallback((nextSourceId: string) => {
    setSourceId(nextSourceId)
    setPage(1)
    setEvents([]) // Y-1：切源立即清空旧事件，防 B 抽屉短暂渲染 A 的残留
    setTotal(0)
    setError(null)
    load(nextSourceId, 1)
  }, [load])

  const close = useCallback(() => {
    tokenRef.current++ // R-2：使 in-flight stale，close 后响应不回写
    setSourceId(null)
    setEvents([])
    setTotal(0)
    setPage(1)
    setError(null)
    setLoading(false)
  }, [])

  const changePage = useCallback((nextPage: number) => {
    if (!sourceId) return
    load(sourceId, nextPage)
  }, [sourceId, load])

  const retry = useCallback(() => {
    if (!sourceId) return
    load(sourceId, page)
  }, [sourceId, page, load])

  const pagination: HealthDrawerPagination | undefined =
    total > limit ? { page, total, limit, onPageChange: changePage } : undefined

  const state: UseLineHealthDrawerState = {
    open: sourceId !== null, sourceId, page, events, total, limit, loading, error, pagination,
  }
  const actions: UseLineHealthDrawerActions = { open, close, changePage, retry }
  return [state, actions]
}
