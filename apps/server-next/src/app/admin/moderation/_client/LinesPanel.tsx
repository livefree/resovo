'use client'

/**
 * LinesPanel.tsx — 审核台线路面板（CHG-VSR-PRE-2 消费中性控制器）
 *
 * 变更：内联 8 state + handler → 消费 `useSourceLinesController`（数据 + 乐观锁 + probe/render 编排统一）。
 *   - compact density；selectedKey + onLineSelect 透传父级（FIX-D AdminPlayer 桥接）
 *   - 首行自动选经 controller `onLoaded`（Y4）
 *   - 结构化反馈经 controller `onActionResult` → 映射 useToast 浮层 + actionError 红条（R4 i18n 留消费方）
 *   - LineHealthDrawer 开合/分页/标题留本地（R5）；取数走 actions.fetchHealth
 */
import React, { useState, useCallback, useMemo } from 'react'
import {
  LinesPanel as LinesPanelUI,
  groupSourcesByLine,
  LineHealthDrawer,
  useToast,
} from '@resovo/admin-ui'
import type { LineAggregate } from '@resovo/admin-ui'
import type { DualSignalDisplayState } from '@resovo/types'
import { toDisplayState } from '@/lib/sources/api'
import { useSourceLinesController } from '@/lib/sources/use-source-lines-controller'
import type { SourceLineRowData, SourceActionResult } from '@/lib/sources/use-source-lines-controller'
import { useLineHealthDrawer } from '@/lib/sources/use-line-health-drawer'
import { M } from '@/i18n/messages/zh-CN/moderation'

// ── Health drawer 快照（CHG-VSR-6-FOLLOWUP / R4 审核台保持「open 时快照」）────────
// 审核台**不**实时派生 probe/render/title：open 时存快照，drawer 期间冻结，并发 probe 改
// state.lines 不影响已开抽屉头部 BarSignal（保持现行为，避免触碰并发关键路径）。
interface HealthSnapshot {
  readonly title: string
  readonly probeState: DualSignalDisplayState
  readonly renderState: DualSignalDisplayState
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
   */
  readonly onSourceHealthChanged?: () => void
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function LinesPanel({ videoId, selectedKey, onLineSelect, onSourceHealthChanged }: LinesPanelProps): React.ReactElement {
  const toast = useToast()
  // R4：localized 红条留消费方（toggle race/fail + disableDead/refetch fail）
  const [actionError, setActionError] = useState<string | null>(null)
  // CHG-VSR-6-FOLLOWUP：health drawer 取数/并发/分页经共享 hook；title/probe/render 走本地快照（R4）
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null)

  // Y4：每次 reload 后首行自动选 → onLineSelect 桥接（仅受控用法）
  const handleLoaded = useCallback((rows: readonly SourceLineRowData[]) => {
    if (!onLineSelect) return
    const agg = groupSourcesByLine(rows)
    const firstLine = agg[0]
    if (!firstLine) return
    const firstActiveEp = firstLine.episodes.find((e) => e.isActive)
    if (firstActiveEp) {
      onLineSelect({ lineKey: firstLine.key, line: firstLine, firstActiveUrl: firstActiveEp.sourceUrl })
    }
  }, [onLineSelect])

  // R4：结构化结果 → toast 浮层 / actionError 红条（沿用 CHG-358-FIX 反馈口径）
  const handleActionResult = useCallback((r: SourceActionResult) => {
    switch (r.action) {
      case 'toggle':
        setActionError(r.status === 'race' ? M.lines.toggleRace : r.status === 'failed' ? M.lines.toggleFailed : null)
        return
      case 'disableDead':
        if (r.status === 'failed') setActionError(M.lines.disableDeadFailed)
        return
      case 'refetch':
        if (r.status === 'failed') setActionError(M.lines.refetchFailed)
        return
      case 'probeEpisode':
        if (r.status === 'success') {
          onSourceHealthChanged?.()
          if (r.dead) toast.push({ title: '探测', description: '该线路失效', level: 'warn' })
        } else {
          toast.push({ title: '探测失败', description: r.status === 'freeze' ? '采集已冻结，无法触发探测' : '请稍后重试', level: 'danger' })
        }
        return
      case 'renderCheckEpisode':
        if (r.status === 'success') {
          onSourceHealthChanged?.()
          if (r.dead) toast.push({ title: '试播', description: '该线路渲染失败', level: 'warn' })
        } else {
          toast.push({ title: '试播失败', description: '请稍后重试', level: 'danger' })
        }
        return
      case 'probeAll':
        if (r.status === 'success' && r.summary) {
          onSourceHealthChanged?.()
          const { ok, dead, total, failed } = r.summary
          if (dead > 0 || failed > 0) {
            toast.push({ title: '全部探测完成', description: `${ok}/${total} 可访问${dead > 0 ? ` · ${dead} 失效` : ''}${failed > 0 ? ` · ${failed} 异常` : ''}`, level: 'warn' })
          } else {
            toast.push({ title: '全部探测完成', description: `${total} 条线路均可访问`, level: 'success' })
          }
        } else {
          toast.push({ title: '全部探测失败', description: r.status === 'freeze' ? '采集已冻结，无法批量探测' : '请稍后重试', level: 'danger' })
        }
        return
      case 'renderCheckAll':
        if (r.status === 'success' && r.summary) {
          onSourceHealthChanged?.()
          const { ok, dead, total, failed } = r.summary
          if (dead > 0 || failed > 0) {
            toast.push({ title: '全部试播完成', description: `${ok}/${total} 渲染正常${dead > 0 ? ` · ${dead} 失败` : ''}${failed > 0 ? ` · ${failed} 异常` : ''}`, level: 'warn' })
          } else {
            toast.push({ title: '全部试播完成', description: `${total} 条线路渲染正常`, level: 'success' })
          }
        } else {
          toast.push({ title: '全部试播失败', description: '请稍后重试', level: 'danger' })
        }
        return
    }
  }, [toast, onSourceHealthChanged])

  const [state, actions] = useSourceLinesController(videoId, {
    onLoaded: handleLoaded,
    onActionResult: handleActionResult,
  })

  // R3：loadFailedText 必传 → 保留 error 红条 + retry（审核台现有能力）
  const [health, healthActions] = useLineHealthDrawer({
    fetchHealth: actions.fetchHealth,
    loadFailedText: M.lines.loadFailed,
  })

  const aggregatedLines = useMemo(() => groupSourcesByLine(state.lines), [state.lines])

  // R4：open 时存快照（title/probe/render 冻结）+ hook 接管取数/并发/分页
  const handleHealthOpen = useCallback(({ episodeId }: { lineKey: string; episodeId: string }) => {
    const src = state.lines.find((l) => l.id === episodeId)
    if (!src) return
    setSnapshot({
      title: `${src.source_name} · EP${src.episode_number ?? M.lines.fullEpisode}`,
      probeState: toDisplayState(src.probe_status),
      renderState: toDisplayState(src.render_status),
    })
    healthActions.open(src.id)
  }, [state.lines, healthActions])

  const closeHealth = useCallback(() => {
    healthActions.close()
    setSnapshot(null)
  }, [healthActions])

  return (
    <>
      <LinesPanelUI
        lines={aggregatedLines}
        density="compact"
        onToggleEpisode={({ episodeId, nextActive }) => actions.toggleEpisode(episodeId, nextActive)}
        onDisableDead={actions.disableDead}
        onRefetch={() => actions.refetch()}
        onHealthOpen={handleHealthOpen}
        onProbeEpisode={({ episodeId }) => actions.probeEpisode(episodeId)}
        onRenderCheckEpisode={({ episodeId }) => actions.renderCheckEpisode(episodeId)}
        onProbeAllSources={actions.probeAllSources}
        onRenderCheckAllSources={actions.renderCheckAllSources}
        selectedKey={selectedKey}
        onLineSelect={onLineSelect}
        toggling={state.togglingIds}
        probingEpisodeIds={state.probingIds}
        renderCheckingEpisodeIds={state.renderCheckingIds}
        probingAllSources={state.probingAllSources}
        renderCheckingAllSources={state.renderCheckingAllSources}
        loading={state.loading}
        error={state.error ? M.errors.loadFailed : null}
        actionError={actionError}
        aria-label="审核台视频线路"
      />
      <LineHealthDrawer
        open={health.open}
        onClose={closeHealth}
        title={snapshot?.title ?? ''}
        probeState={snapshot?.probeState ?? 'unknown'}
        renderState={snapshot?.renderState ?? 'unknown'}
        events={health.events}
        loading={health.loading}
        error={health.error ? { message: health.error, onRetry: healthActions.retry } : null}
        pagination={health.pagination}
      />
    </>
  )
}
