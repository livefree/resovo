'use client'

/**
 * LinesPanel.tsx — 审核台线路面板（FIX-B Stage C 消费方迁移）
 *
 * 变更：原 per-row 平铺视图 → 消费共享 LinesPanel 组件（compact density）
 *   - 聚合键：(source_site_key, source_name)  → LineAggregate[]
 *   - selectedKey + onLineSelect 透传给父级（FIX-D AdminPlayer 桥接）
 *   - 乐观锁（PRE-01-C）：onToggleEpisode.updatedAt 透传 toggleSource
 *   - LineHealthDrawer 保留本地（不进入共享组件）
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  LinesPanel as LinesPanelUI,
  groupSourcesByLine,
  LineHealthDrawer,
} from '@resovo/admin-ui'
import type { LineAggregate } from '@resovo/admin-ui'
import type { SourceHealthEvent } from '@resovo/types'
import type { ContentSourceRow } from '@/lib/moderation/api'
import * as api from '@/lib/moderation/api'
import { ApiClientError } from '@/lib/api-client'
import { M } from '@/i18n/messages/zh-CN/moderation'

// ── Health drawer state ─────────────────────────────────────────────────────

interface HealthDrawerState {
  readonly open: boolean
  readonly sourceId: string | null
  readonly title: string
  readonly probeState: string
  readonly renderState: string
  readonly events: SourceHealthEvent[]
  readonly loading: boolean
  readonly error: string | null
  readonly page: number
  readonly total: number
}

const DRAWER_CLOSED: HealthDrawerState = {
  open: false, sourceId: null, title: '', probeState: 'unknown', renderState: 'unknown',
  events: [], loading: false, error: null, page: 1, total: 0,
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface LinesPanelProps {
  readonly videoId: string
  /** FIX-D AdminPlayer 桥接：受控选中线路 key */
  readonly selectedKey?: string | null
  /** FIX-D AdminPlayer 桥接：线路选中回调，firstActiveUrl 供播放器切源 */
  readonly onLineSelect?: (args: {
    readonly lineKey: string
    readonly line: LineAggregate
    readonly firstActiveUrl: string | null
  }) => void
  /**
   * CHG-358：probe / render-check 完成后通知上游（左队列 PendingQueue 聚合 pill 联动刷新）
   * 调用方式：每次 single / batch probe 或 render-check 成功（含全 dead）后触发 1 次
   * 上游通常调 usePendingQueue.refetch() 重 fetch 让 ModListRow.probe/render 投影刷新
   */
  readonly onSourceHealthChanged?: () => void
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function LinesPanel({ videoId, selectedKey, onLineSelect, onSourceHealthChanged }: LinesPanelProps): React.ReactElement {
  const [lines, setLines] = useState<ContentSourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(new Set())
  // CHG-351-C / ADR-158 / arch-reviewer A1+I2 范式：双独立 set 跟踪 probe / render-check pending
  const [probingIds, setProbingIds] = useState<ReadonlySet<string>>(new Set())
  const [renderCheckingIds, setRenderCheckingIds] = useState<ReadonlySet<string>>(new Set())
  // CHG-357 / ADR-158 AMENDMENT 2：视频级 batch 进行中标志
  const [probingAllSources, setProbingAllSources] = useState(false)
  const [renderCheckingAllSources, setRenderCheckingAllSources] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<HealthDrawerState>(DRAWER_CLOSED)
  // CHG-357 / arch-reviewer I4：videoId race 防御 — batch 完成时 setLines 必须检查 videoId 仍是当前
  const videoIdRef = useRef(videoId)
  useEffect(() => { videoIdRef.current = videoId }, [videoId])

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.fetchVideoSources(videoId)
      .then(data => {
        setLines(data)
        if (onLineSelect) {
          const agg = groupSourcesByLine(data)
          const firstLine = agg[0]
          if (firstLine) {
            const firstActiveEp = firstLine.episodes.find(e => e.isActive)
            if (firstActiveEp) {
              onLineSelect({ lineKey: firstLine.key, line: firstLine, firstActiveUrl: firstActiveEp.sourceUrl })
            }
          }
        }
      })
      .catch(() => setError(M.errors.loadFailed))
      .finally(() => setLoading(false))
  }, [videoId, onLineSelect])

  const aggregatedLines = useMemo(() => groupSourcesByLine(lines), [lines])

  const handleToggleEpisode = useCallback(async ({
    episodeId, nextActive, updatedAt,
  }: { lineKey: string; episodeId: string; nextActive: boolean; updatedAt: string }) => {
    setTogglingIds(s => new Set(s).add(episodeId))
    setActionError(null)
    try {
      const result = await api.toggleSource(videoId, episodeId, nextActive, updatedAt)
      setLines(prev => prev.map(l =>
        l.id === episodeId ? { ...l, is_active: result.is_active, updated_at: result.updated_at } : l
      ))
    } catch (e: unknown) {
      if (e instanceof ApiClientError && (e.code === 'REVIEW_RACE' || e.status === 409)) {
        setActionError(M.lines.toggleRace)
        api.fetchVideoSources(videoId).then(setLines).catch(() => setActionError(M.lines.loadFailed))
      } else {
        setActionError(M.lines.toggleFailed)
      }
    } finally {
      setTogglingIds(s => { const next = new Set(s); next.delete(episodeId); return next })
    }
  }, [videoId])

  const handleHealthOpen = useCallback(({ episodeId }: { lineKey: string; episodeId: string }) => {
    const src = lines.find(l => l.id === episodeId)
    if (!src) return
    const title = `${src.source_name} · EP${src.episode_number ?? M.lines.fullEpisode}`
    setDrawer({
      open: true, sourceId: src.id, title,
      probeState: api.toDisplayState(src.probe_status),
      renderState: api.toDisplayState(src.render_status),
      events: [], loading: true, error: null, page: 1, total: 0,
    })
    api.fetchLineHealth(videoId, src.id, 1)
      .then(res => setDrawer(d => ({
        ...d, events: res.data as SourceHealthEvent[], loading: false, total: res.pagination.total, page: 1,
      })))
      .catch(() => setDrawer(d => ({ ...d, loading: false, error: M.lines.loadFailed })))
  }, [videoId, lines])

  const handleHealthPage = useCallback(async (page: number) => {
    if (!drawer.sourceId) return
    setDrawer(d => ({ ...d, loading: true }))
    try {
      const res = await api.fetchLineHealth(videoId, drawer.sourceId, page)
      setDrawer(d => ({ ...d, events: res.data as SourceHealthEvent[], loading: false, page }))
    } catch {
      setDrawer(d => ({ ...d, loading: false, error: M.lines.loadFailed }))
    }
  }, [videoId, drawer.sourceId])

  const handleDisableDead = useCallback(async () => {
    setActionError(null)
    try {
      const res = await api.disableDeadSources(videoId)
      if (res.disabled > 0) {
        setLines(prev => prev.map(l =>
          (l.probe_status === 'dead' && l.render_status === 'dead') ? { ...l, is_active: false } : l
        ))
      }
    } catch {
      setActionError(M.lines.disableDeadFailed)
    }
  }, [videoId])

  const handleRefetch = useCallback(async () => {
    setActionError(null)
    try { await api.refetchSources(videoId) } catch { setActionError(M.lines.refetchFailed) }
  }, [videoId])

  // CHG-351-C / ADR-158 + AMENDMENT (CHG-356) + CHG-358 UX 修订：单源 inline 探测
  //   AMENDMENT: 同步快探返回 newProbeStatus + latencyMs → setLines 立即 update → SignalChip 立即重渲
  //   probe 守 freeze / 409 STATE_CONFLICT 抛 probeFrozen 提示
  //   CHG-358：actionError 仅 dead / 失败 / freeze 时设；成功（ok）不弹横幅（pill 变色已是反馈）
  //          + onSourceHealthChanged 触发上游 PendingQueue refetch（左队列 ModListRow pill 联动）
  const handleProbeEpisode = useCallback(async ({ episodeId }: { lineKey: string; episodeId: string }) => {
    setProbingIds(s => new Set(s).add(episodeId))
    setActionError(null)
    try {
      const result = await api.probeOneSource(episodeId)
      setLines(prev => prev.map(l =>
        l.id === episodeId
          ? { ...l, probe_status: result.newProbeStatus, latency_ms: result.latencyMs }
          : l
      ))
      // CHG-358：仅 dead 时显示（ok 不弹 / pill 已反馈）
      if (result.newProbeStatus === 'dead') {
        setActionError(M.lines.probeDead)
      }
      onSourceHealthChanged?.()  // 联动左队列聚合 pill
    } catch (e: unknown) {
      if (e instanceof ApiClientError && e.status === 409) {
        setActionError(M.lines.probeFrozen)
      } else {
        setActionError(M.lines.probeFailed)
      }
    } finally {
      setProbingIds(s => { const next = new Set(s); next.delete(episodeId); return next })
    }
  }, [onSourceHealthChanged])

  const handleRenderCheckEpisode = useCallback(async ({ episodeId }: { lineKey: string; episodeId: string }) => {
    setRenderCheckingIds(s => new Set(s).add(episodeId))
    setActionError(null)
    try {
      const result = await api.renderCheckOneSource(episodeId)
      setLines(prev => prev.map(l =>
        l.id === episodeId
          ? { ...l, render_status: result.newRenderStatus }
          : l
      ))
      if (result.newRenderStatus === 'dead') {
        setActionError(M.lines.renderCheckDead)
      }
      onSourceHealthChanged?.()
    } catch {
      setActionError(M.lines.renderCheckFailed)
    } finally {
      setRenderCheckingIds(s => { const next = new Set(s); next.delete(episodeId); return next })
    }
  }, [onSourceHealthChanged])

  // CHG-357 / ADR-158 AMENDMENT 2：视频级 batch 探测/试播
  //   I4 race 防御：videoIdRef 防 user 切视频后 batch 仍 setLines 当前视频；I4 admin-ui useMemo 防 inline 按钮 race
  // CHG-358：batch 完成反馈仅在 dead/failed > 0 时显示（全 ok 不弹 / pill 联动 + 左队列 refetch 已是反馈）
  const handleProbeAllSources = useCallback(async () => {
    setProbingAllSources(true)
    setActionError(null)
    const startedVideoId = videoId
    try {
      const result = await api.batchProbeVideo(videoId)
      if (videoIdRef.current !== startedVideoId) return
      setLines(prev => prev.map(l => {
        const r = result.results.find(x => x.sourceId === l.id)
        return r && !r.error
          ? { ...l, probe_status: r.newProbeStatus, latency_ms: r.latencyMs }
          : l
      }))
      const { ok, dead, total, failed } = result.summary
      if (dead > 0 || failed > 0) {
        setActionError(M.lines.batchProbeDone(ok, dead, total, failed))
      }
      onSourceHealthChanged?.()
    } catch (e: unknown) {
      if (e instanceof ApiClientError && e.status === 409) {
        setActionError(M.lines.batchProbeFrozen)
      } else {
        setActionError(M.lines.batchProbeFailed)
      }
    } finally {
      setProbingAllSources(false)
    }
  }, [videoId, onSourceHealthChanged])

  const handleRenderCheckAllSources = useCallback(async () => {
    setRenderCheckingAllSources(true)
    setActionError(null)
    const startedVideoId = videoId
    try {
      const result = await api.batchRenderCheckVideo(videoId)
      if (videoIdRef.current !== startedVideoId) return
      setLines(prev => prev.map(l => {
        const r = result.results.find(x => x.sourceId === l.id)
        return r && !r.error
          ? { ...l, render_status: r.newRenderStatus }
          : l
      }))
      const { ok, dead, total, failed } = result.summary
      if (dead > 0 || failed > 0) {
        setActionError(M.lines.batchRenderCheckDone(ok, dead, total, failed))
      }
      onSourceHealthChanged?.()
    } catch {
      setActionError(M.lines.batchRenderCheckFailed)
    } finally {
      setRenderCheckingAllSources(false)
    }
  }, [videoId, onSourceHealthChanged])

  return (
    <>
      <LinesPanelUI
        lines={aggregatedLines}
        density="compact"
        onToggleEpisode={handleToggleEpisode}
        onDisableDead={handleDisableDead}
        onRefetch={handleRefetch}
        onHealthOpen={handleHealthOpen}
        onProbeEpisode={handleProbeEpisode}
        onRenderCheckEpisode={handleRenderCheckEpisode}
        onProbeAllSources={handleProbeAllSources}
        onRenderCheckAllSources={handleRenderCheckAllSources}
        selectedKey={selectedKey}
        onLineSelect={onLineSelect}
        toggling={togglingIds}
        probingEpisodeIds={probingIds}
        renderCheckingEpisodeIds={renderCheckingIds}
        probingAllSources={probingAllSources}
        renderCheckingAllSources={renderCheckingAllSources}
        loading={loading}
        error={error}
        actionError={actionError}
        aria-label="审核台视频线路"
      />
      <LineHealthDrawer
        open={drawer.open}
        onClose={() => setDrawer(DRAWER_CLOSED)}
        title={drawer.title}
        probeState={drawer.probeState as Parameters<typeof LineHealthDrawer>[0]['probeState']}
        renderState={drawer.renderState as Parameters<typeof LineHealthDrawer>[0]['renderState']}
        events={drawer.events}
        loading={drawer.loading}
        error={drawer.error
          ? { message: drawer.error, onRetry: () => drawer.sourceId && void handleHealthPage(drawer.page) }
          : null}
        pagination={drawer.total > 20
          ? { page: drawer.page, total: drawer.total, limit: 20, onPageChange: handleHealthPage }
          : undefined}
      />
    </>
  )
}
