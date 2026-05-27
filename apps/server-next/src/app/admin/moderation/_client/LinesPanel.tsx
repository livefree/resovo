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
  useToast,
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
  // CHG-358-FIX：使用 admin-ui useToast 浮层反馈（不改变页面布局 / 取代 inline actionError 红条）
  const toast = useToast()

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

  // CHG-358-FIX：4 handler 全用 useToast 浮层反馈（取代 setActionError inline 红条 / 不改变页面布局）
  //   规则：成功（ok）静默 + pill 联动（pill 变色 + 左队列 refetch 是首要反馈）
  //         dead / 失败 / freeze → toast.push level=warn/danger
  const handleProbeEpisode = useCallback(async ({ episodeId }: { lineKey: string; episodeId: string }) => {
    setProbingIds(s => new Set(s).add(episodeId))
    try {
      const result = await api.probeOneSource(episodeId)
      setLines(prev => prev.map(l =>
        l.id === episodeId
          ? { ...l, probe_status: result.newProbeStatus, latency_ms: result.latencyMs }
          : l
      ))
      onSourceHealthChanged?.()
      if (result.newProbeStatus === 'dead') {
        toast.push({ title: '探测', description: '该线路失效', level: 'warn' })
      }
    } catch (e: unknown) {
      const isFreeze = e instanceof ApiClientError && e.status === 409
      toast.push({
        title: '探测失败',
        description: isFreeze ? '采集已冻结，无法触发探测' : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setProbingIds(s => { const next = new Set(s); next.delete(episodeId); return next })
    }
  }, [onSourceHealthChanged, toast])

  const handleRenderCheckEpisode = useCallback(async ({ episodeId }: { lineKey: string; episodeId: string }) => {
    setRenderCheckingIds(s => new Set(s).add(episodeId))
    try {
      const result = await api.renderCheckOneSource(episodeId)
      setLines(prev => prev.map(l =>
        l.id === episodeId
          ? { ...l, render_status: result.newRenderStatus }
          : l
      ))
      onSourceHealthChanged?.()
      if (result.newRenderStatus === 'dead') {
        toast.push({ title: '试播', description: '该线路渲染失败', level: 'warn' })
      }
    } catch {
      toast.push({ title: '试播失败', description: '请稍后重试', level: 'danger' })
    } finally {
      setRenderCheckingIds(s => { const next = new Set(s); next.delete(episodeId); return next })
    }
  }, [onSourceHealthChanged, toast])

  // CHG-357 / ADR-158 AMENDMENT 2：视频级 batch 探测/试播
  //   I4 race 防御：videoIdRef 防 user 切视频后 batch 仍 setLines 当前视频；I4 admin-ui useMemo 防 inline 按钮 race
  // CHG-358-FIX：batch 完成全用 toast.push 浮层（不改变页面布局）
  //   全 ok → toast level=success（pill 已联动 / toast 短暂确认操作完成）
  //   有 dead/failed → toast level=warn 含 X/Y · 失败 Z
  //   freeze / 失败 → toast level=danger
  const handleProbeAllSources = useCallback(async () => {
    setProbingAllSources(true)
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
      onSourceHealthChanged?.()
      const { ok, dead, total, failed } = result.summary
      if (dead > 0 || failed > 0) {
        toast.push({
          title: '全部探测完成',
          description: `${ok}/${total} 可访问${dead > 0 ? ` · ${dead} 失效` : ''}${failed > 0 ? ` · ${failed} 异常` : ''}`,
          level: 'warn',
        })
      } else {
        toast.push({ title: '全部探测完成', description: `${total} 条线路均可访问`, level: 'success' })
      }
    } catch (e: unknown) {
      const isFreeze = e instanceof ApiClientError && e.status === 409
      toast.push({
        title: '全部探测失败',
        description: isFreeze ? '采集已冻结，无法批量探测' : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setProbingAllSources(false)
    }
  }, [videoId, onSourceHealthChanged, toast])

  const handleRenderCheckAllSources = useCallback(async () => {
    setRenderCheckingAllSources(true)
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
      onSourceHealthChanged?.()
      const { ok, dead, total, failed } = result.summary
      if (dead > 0 || failed > 0) {
        toast.push({
          title: '全部试播完成',
          description: `${ok}/${total} 渲染正常${dead > 0 ? ` · ${dead} 失败` : ''}${failed > 0 ? ` · ${failed} 异常` : ''}`,
          level: 'warn',
        })
      } else {
        toast.push({ title: '全部试播完成', description: `${total} 条线路渲染正常`, level: 'success' })
      }
    } catch {
      toast.push({ title: '全部试播失败', description: '请稍后重试', level: 'danger' })
    } finally {
      setRenderCheckingAllSources(false)
    }
  }, [videoId, onSourceHealthChanged, toast])

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
