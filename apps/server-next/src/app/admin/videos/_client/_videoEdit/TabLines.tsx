'use client'

/**
 * TabLines.tsx — 视频编辑抽屉线路标签页（CHG-VSR-PRE-2 消费中性控制器）
 *
 * 变更：`useVideoSources` → `useSourceLinesController`（与审核台同一数据层）。
 *   - regular density / 无选中态（编辑抽屉不需要 AdminPlayer 桥接）
 *   - 新增 probe / render-check 能力（单源 + 全量），失败经 onActionResult → alert(VE)
 *   - LineHealthDrawer 开合/分页/标题留本地（R5）；取数走 actions.fetchHealth
 */
import React, { useCallback, useMemo } from 'react'
import {
  LinesPanel,
  groupSourcesByLine,
  LoadingState,
  ErrorState,
  LineHealthDrawer,
} from '@resovo/admin-ui'
import type { SourceHealthEvent } from '@resovo/types'
import { VE } from '@/i18n/messages/zh-CN/videos-edit'
import { toDisplayState } from '@/lib/sources/api'
import { useSourceLinesController } from '@/lib/sources/use-source-lines-controller'
import type { SourceActionResult } from '@/lib/sources/use-source-lines-controller'
import { useLineHealthDrawer } from '@/lib/sources/use-line-health-drawer'

export interface TabLinesProps {
  readonly videoId: string
}

export function TabLines({ videoId }: TabLinesProps): React.ReactElement {
  const m = VE.lines

  // R4：动作失败经 onActionResult → alert（编辑抽屉 success 静默）
  const handleActionResult = useCallback((r: SourceActionResult) => {
    if (r.status === 'success') return
    switch (r.action) {
      case 'toggle':
        alert(r.status === 'race' ? m.errors.reviewRace : r.code === 'STATE_INVALID' ? m.errors.stateInvalid : m.errors.toggleFailed)
        return
      case 'disableDead':
        alert(m.errors.disableDeadFailed)
        return
      case 'refetch':
        alert(m.errors.refetchFailed)
        return
      default:
        // probeEpisode / renderCheckEpisode / probeAll / renderCheckAll 失败 → 通用文案
        alert(m.errors.toggleFailed)
        return
    }
  }, [m])

  const [state, actions] = useSourceLinesController(videoId, { onActionResult: handleActionResult })

  const aggregatedLines = useMemo(() => groupSourcesByLine(state.lines), [state.lines])

  // ── Health drawer（CHG-VSR-6-FOLLOWUP：共享 hook / 取数+并发+分页中性化）──────
  // 省略 loadFailedText → 保持 TabLines 现状（catch 静默清空，无 error 态）；
  // probeState/renderState/title 仍由本组件从 state.lines 实时派生（R3/R4 留消费方控制）。
  const [health, healthActions] = useLineHealthDrawer({ fetchHealth: actions.fetchHealth })

  const healthSrc = health.sourceId ? state.lines.find((s) => s.id === health.sourceId) ?? null : null
  const healthTitle = healthSrc
    ? m.healthDrawer.title(
        healthSrc.source_site_key ?? healthSrc.site_key ?? healthSrc.source_name,
        healthSrc.episode_number != null ? m.episodes(healthSrc.episode_number) : '',
      )
    : ''

  if (state.loading && state.lines.length === 0) return <LoadingState variant="spinner" />
  if (state.error && state.lines.length === 0) return (
    <ErrorState error={state.error} title={m.errors.loadFailed} onRetry={actions.reload} />
  )

  return (
    <div>
      <LinesPanel
        lines={aggregatedLines}
        density="regular"
        onToggleEpisode={({ episodeId, nextActive }) => actions.toggleEpisode(episodeId, nextActive)}
        onDisableDead={actions.disableDead}
        onRefetch={() => actions.refetch()}
        onHealthOpen={({ episodeId }) => healthActions.open(episodeId)}
        onProbeEpisode={({ episodeId }) => actions.probeEpisode(episodeId)}
        onRenderCheckEpisode={({ episodeId }) => actions.renderCheckEpisode(episodeId)}
        onProbeAllSources={actions.probeAllSources}
        onRenderCheckAllSources={actions.renderCheckAllSources}
        toggling={state.togglingIds}
        probingEpisodeIds={state.probingIds}
        renderCheckingEpisodeIds={state.renderCheckingIds}
        probingAllSources={state.probingAllSources}
        renderCheckingAllSources={state.renderCheckingAllSources}
        loading={state.loading && state.lines.length === 0}
        aria-label={m.title}
      />

      <p style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)', marginTop: '8px' }}>
        {m.hints.dragHint}
      </p>

      <LineHealthDrawer
        open={health.open}
        onClose={healthActions.close}
        title={healthTitle}
        probeState={healthSrc ? toDisplayState(healthSrc.probe_status) : 'unknown'}
        renderState={healthSrc ? toDisplayState(healthSrc.render_status) : 'unknown'}
        events={health.events as SourceHealthEvent[]}
        loading={health.loading}
        emptyText={m.healthDrawer.empty}
        loadingText={m.healthDrawer.loading}
        pagination={health.pagination}
        testId="data-line-health-drawer"
      />
    </div>
  )
}
