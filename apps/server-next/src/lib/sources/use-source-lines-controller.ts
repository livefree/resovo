'use client'

/**
 * use-source-lines-controller.ts — 播放线路数据层「中性控制器」（CHG-VSR-PRE-2 / 设计 §5.5）
 *
 * 三消费方共用同一控制器（arch-reviewer claude-opus-4-8 蓝图 R1-R5 / Y1-Y4）：
 *   1. 审核台 PendingCenter → moderation/_client/LinesPanel（compact / 受控选中 + onLineSelect）
 *   2. 视频编辑抽屉 → videos/_client/_videoEdit/TabLines（regular / 无选中态）
 *   3. CHG-VSR-6 播放线路展开区（后续消费）
 *
 * 职责（数据 + 副作用编排）：
 *   - 拉取全部源（含禁用 / active=all，待校准点①）
 *   - 单集 toggle：乐观更新 + 409 REVIEW_RACE 重 fetch + 非 race 回滚 snapshot（R2，统一升级审核台）
 *   - 单/批 probe·render（CHG-356/357 同步快探 + 本地 setLines）
 *   - disableDead（dead 行本地置 inactive）/ refetch
 *   - fetchHealth(sourceId,page)：仅暴露取数，drawer 状态留消费方（R5）
 *   - videoIdRef stale-write 防御（R3）
 *
 * 不持有（R4 / Y4 / R5）：
 *   - toast / alert / localized actionError 红条 → 经 `options.onActionResult` 推结构化 SourceActionResult，消费方本地化
 *   - 首行自动选 / onLineSelect / onSourceHealthChanged → 经 `options.onLoaded` 留消费方
 *   - LineHealthDrawer 开合 / 标题 / 分页 i18n → 消费方本地
 *
 * 依赖方向：lib/sources（→ api-client + sources/api + sources/types），不反向 import /admin/moderation 内部组件。
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  fetchVideoSources,
  toggleSource,
  disableDeadSources,
  refetchSources,
  probeOneSource,
  renderCheckOneSource,
  batchProbeVideo,
  batchRenderCheckVideo,
  fetchLineHealth,
  type LineHealthPage,
} from './api'
import type { SourceLineRowData, SourceActionResult } from './types'

export type { SourceLineRowData, SourceActionResult } from './types'

// ── 公开契约 ──────────────────────────────────────────────────────────

export interface SourceLinesState {
  readonly lines: readonly SourceLineRowData[]
  readonly loading: boolean
  /** 加载错误（原始 Error；消费方本地化展示，R4） */
  readonly error: Error | null
  readonly togglingIds: ReadonlySet<string>
  readonly probingIds: ReadonlySet<string>
  readonly renderCheckingIds: ReadonlySet<string>
  readonly probingAllSources: boolean
  readonly renderCheckingAllSources: boolean
  readonly disableDeadPending: boolean
  readonly refetchPending: boolean
}

export interface SourceLinesActions {
  readonly reload: () => void
  /** 单集启停（行级乐观锁；hook 内部读 state 中的 updated_at） */
  readonly toggleEpisode: (episodeId: string, nextActive: boolean) => Promise<void>
  readonly disableDead: () => Promise<void>
  readonly refetch: (siteKeys?: readonly string[]) => Promise<void>
  readonly probeEpisode: (episodeId: string) => Promise<void>
  readonly renderCheckEpisode: (episodeId: string) => Promise<void>
  readonly probeAllSources: () => Promise<void>
  readonly renderCheckAllSources: () => Promise<void>
  /** 取线路健康事件（drawer 状态留消费方，R5） */
  readonly fetchHealth: (sourceId: string, page?: number) => Promise<LineHealthPage>
}

export interface UseSourceLinesControllerOptions {
  /** 每次成功 reload 后回调（首行自动选 / onLineSelect 桥接由消费方实现，Y4）；传原始行 */
  readonly onLoaded?: (lines: readonly SourceLineRowData[]) => void
  /** 结构化动作反馈注入（消费方映射 toast / alert / 红条，R4）；hook 内不 push */
  readonly onActionResult?: (result: SourceActionResult) => void
}

// ── 错误归类（duck-typed，对齐 use-sources 参照范式 R2；兼容 ApiClientError 与裸 {code,status}）──

function getErrorCode(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: unknown }).code === 'string') {
    return (e as { code: string }).code
  }
  return undefined
}

function getErrorStatus(e: unknown): number | undefined {
  if (typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status: unknown }).status === 'number') {
    return (e as { status: number }).status
  }
  return undefined
}

/** toggle 409 REVIEW_RACE（被他人改过 / 乐观锁版本不匹配） */
function isRaceError(e: unknown): boolean {
  return getErrorCode(e) === 'REVIEW_RACE' || getErrorStatus(e) === 409
}

/** probe / batch 409（采集冻结） */
function isFreezeError(e: unknown): boolean {
  return getErrorStatus(e) === 409
}

// ── 控制器 ────────────────────────────────────────────────────────────

export function useSourceLinesController(
  videoId: string,
  options: UseSourceLinesControllerOptions = {},
): [SourceLinesState, SourceLinesActions] {
  const [lines, setLines] = useState<readonly SourceLineRowData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(new Set())
  const [probingIds, setProbingIds] = useState<ReadonlySet<string>>(new Set())
  const [renderCheckingIds, setRenderCheckingIds] = useState<ReadonlySet<string>>(new Set())
  const [probingAllSources, setProbingAllSources] = useState(false)
  const [renderCheckingAllSources, setRenderCheckingAllSources] = useState(false)
  const [disableDeadPending, setDisableDeadPending] = useState(false)
  const [refetchPending, setRefetchPending] = useState(false)

  // R2 乐观锁回滚 / toggle 内部读 updated_at：用 ref 取最新 lines，避免回调随 lines 变更而重建
  const linesRef = useRef(lines)
  useEffect(() => { linesRef.current = lines }, [lines])

  // R3 stale-write 防御：异步完成时校验 videoId 仍是当前
  const videoIdRef = useRef(videoId)
  useEffect(() => { videoIdRef.current = videoId }, [videoId])

  // options 经 ref 取最新，避免 onLoaded/onActionResult 身份变化重触发 reload
  const optionsRef = useRef(options)
  useEffect(() => { optionsRef.current = options })

  const emit = useCallback((result: SourceActionResult) => {
    optionsRef.current.onActionResult?.(result)
  }, [])

  // ── reload ──────────────────────────────────────────────────────────
  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    const started = videoId
    fetchVideoSources(videoId)
      .then((data) => {
        if (videoIdRef.current !== started) return
        setLines(data)
        optionsRef.current.onLoaded?.(data)
      })
      .catch((e: unknown) => {
        if (videoIdRef.current !== started) return
        setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (videoIdRef.current !== started) return
        setLoading(false)
      })
  }, [videoId])

  useEffect(() => { reload() }, [reload])

  // ── toggle（R2 乐观更新 + 409 重 fetch + 失败仅回滚目标行）───────────────
  const toggleEpisode = useCallback(async (episodeId: string, nextActive: boolean) => {
    const target = linesRef.current.find((l) => l.id === episodeId)
    const prevActive = target?.is_active
    // Codex stop-time review FIX：失败时**仅回滚本次目标行** is_active，绝不整组还原启动快照
    //   （整组还原会抹掉期间并发操作对其他行的 server-confirmed 更新 → 客户端偏离 server 真相 + 恢复 stale 行）
    const rollbackTarget = () =>
      setLines((prev) => prev.map((l) => l.id === episodeId ? { ...l, is_active: prevActive ?? l.is_active } : l))
    setTogglingIds((s) => new Set(s).add(episodeId))
    setLines((prev) => prev.map((l) => l.id === episodeId ? { ...l, is_active: nextActive } : l))
    try {
      const res = await toggleSource(videoId, episodeId, nextActive, target?.updated_at)
      setLines((prev) => prev.map((l) =>
        l.id === episodeId ? { ...l, is_active: res.is_active, updated_at: res.updated_at } : l,
      ))
      emit({ action: 'toggle', status: 'success' })
    } catch (e: unknown) {
      if (isRaceError(e)) {
        // 409：以 server 真相覆盖整组（重 fetch 失败则退化为仅回滚目标行，不还原 stale 快照）
        try {
          const fresh = await fetchVideoSources(videoId)
          if (videoIdRef.current === videoId) setLines(fresh)
        } catch {
          rollbackTarget()
        }
        emit({ action: 'toggle', status: 'race' })
      } else {
        rollbackTarget()
        emit({ action: 'toggle', status: 'failed', code: getErrorCode(e) })
      }
    } finally {
      setTogglingIds((s) => { const next = new Set(s); next.delete(episodeId); return next })
    }
  }, [videoId, emit])

  // ── disableDead（dead 行本地置 inactive）─────────────────────────────
  const disableDead = useCallback(async () => {
    setDisableDeadPending(true)
    try {
      const res = await disableDeadSources(videoId)
      if (res.disabled > 0) {
        setLines((prev) => prev.map((l) =>
          (l.probe_status === 'dead' && l.render_status === 'dead') ? { ...l, is_active: false } : l,
        ))
      }
      emit({ action: 'disableDead', status: 'success' })
    } catch {
      emit({ action: 'disableDead', status: 'failed' })
    } finally {
      setDisableDeadPending(false)
    }
  }, [videoId, emit])

  // ── refetch ─────────────────────────────────────────────────────────
  const refetch = useCallback(async (siteKeys?: readonly string[]) => {
    setRefetchPending(true)
    try {
      await refetchSources(videoId, siteKeys)
      emit({ action: 'refetch', status: 'success' })
    } catch {
      emit({ action: 'refetch', status: 'failed' })
    } finally {
      setRefetchPending(false)
    }
  }, [videoId, emit])

  // ── 单源 probe / render-check ───────────────────────────────────────
  const probeEpisode = useCallback(async (episodeId: string) => {
    setProbingIds((s) => new Set(s).add(episodeId))
    try {
      const result = await probeOneSource(episodeId)
      setLines((prev) => prev.map((l) =>
        l.id === episodeId ? { ...l, probe_status: result.newProbeStatus, latency_ms: result.latencyMs } : l,
      ))
      emit({ action: 'probeEpisode', status: 'success', dead: result.newProbeStatus === 'dead' })
    } catch (e: unknown) {
      emit({ action: 'probeEpisode', status: isFreezeError(e) ? 'freeze' : 'failed' })
    } finally {
      setProbingIds((s) => { const next = new Set(s); next.delete(episodeId); return next })
    }
  }, [emit])

  const renderCheckEpisode = useCallback(async (episodeId: string) => {
    setRenderCheckingIds((s) => new Set(s).add(episodeId))
    try {
      const result = await renderCheckOneSource(episodeId)
      setLines((prev) => prev.map((l) =>
        l.id === episodeId ? { ...l, render_status: result.newRenderStatus } : l,
      ))
      emit({ action: 'renderCheckEpisode', status: 'success', dead: result.newRenderStatus === 'dead' })
    } catch {
      emit({ action: 'renderCheckEpisode', status: 'failed' })
    } finally {
      setRenderCheckingIds((s) => { const next = new Set(s); next.delete(episodeId); return next })
    }
  }, [emit])

  // ── 视频级 batch（R3 stale-write 防御）───────────────────────────────
  const probeAllSources = useCallback(async () => {
    setProbingAllSources(true)
    const started = videoId
    try {
      const result = await batchProbeVideo(videoId)
      if (videoIdRef.current !== started) return
      setLines((prev) => prev.map((l) => {
        const r = result.results.find((x) => x.sourceId === l.id)
        return r && !r.error ? { ...l, probe_status: r.newProbeStatus, latency_ms: r.latencyMs } : l
      }))
      emit({ action: 'probeAll', status: 'success', summary: result.summary })
    } catch (e: unknown) {
      emit({ action: 'probeAll', status: isFreezeError(e) ? 'freeze' : 'failed' })
    } finally {
      setProbingAllSources(false)
    }
  }, [videoId, emit])

  const renderCheckAllSources = useCallback(async () => {
    setRenderCheckingAllSources(true)
    const started = videoId
    try {
      const result = await batchRenderCheckVideo(videoId)
      if (videoIdRef.current !== started) return
      setLines((prev) => prev.map((l) => {
        const r = result.results.find((x) => x.sourceId === l.id)
        return r && !r.error ? { ...l, render_status: r.newRenderStatus } : l
      }))
      emit({ action: 'renderCheckAll', status: 'success', summary: result.summary })
    } catch {
      emit({ action: 'renderCheckAll', status: 'failed' })
    } finally {
      setRenderCheckingAllSources(false)
    }
  }, [videoId, emit])

  // ── health（仅取数，R5 drawer 留消费方）──────────────────────────────
  const fetchHealth = useCallback((sourceId: string, page = 1): Promise<LineHealthPage> => {
    return fetchLineHealth(videoId, sourceId, page)
  }, [videoId])

  const state: SourceLinesState = {
    lines, loading, error,
    togglingIds, probingIds, renderCheckingIds,
    probingAllSources, renderCheckingAllSources,
    disableDeadPending, refetchPending,
  }

  const actions: SourceLinesActions = {
    reload, toggleEpisode, disableDead, refetch,
    probeEpisode, renderCheckEpisode, probeAllSources, renderCheckAllSources,
    fetchHealth,
  }

  return [state, actions]
}
