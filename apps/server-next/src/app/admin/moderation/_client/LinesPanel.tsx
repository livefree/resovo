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
import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function LinesPanel({ videoId, selectedKey, onLineSelect }: LinesPanelProps): React.ReactElement {
  const [lines, setLines] = useState<ContentSourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<HealthDrawerState>(DRAWER_CLOSED)

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

  return (
    <>
      <LinesPanelUI
        lines={aggregatedLines}
        density="compact"
        onToggleEpisode={handleToggleEpisode}
        onDisableDead={handleDisableDead}
        onRefetch={handleRefetch}
        onHealthOpen={handleHealthOpen}
        selectedKey={selectedKey}
        onLineSelect={onLineSelect}
        toggling={togglingIds}
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
