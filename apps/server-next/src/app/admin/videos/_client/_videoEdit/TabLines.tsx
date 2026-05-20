'use client'

/**
 * TabLines.tsx — 视频编辑抽屉线路标签页（FIX-B Stage C 消费方迁移）
 *
 * 变更：原 per-row 表格视图 → 消费共享 LinesPanel 组件（regular density）
 *   - 聚合键：(source_site_key, source_name)  → LineAggregate[]
 *   - 无选中态（VideoEditDrawer 不需要 AdminPlayer 桥接）
 *   - useVideoSources hook 保留原有 toggle / disableDead / refetch / health 逻辑
 *   - LineHealthDrawer 保留本地
 */
import React, { useMemo } from 'react'
import {
  LinesPanel,
  groupSourcesByLine,
  LoadingState,
  ErrorState,
  LineHealthDrawer,
} from '@resovo/admin-ui'
import { VE } from '@/i18n/messages/zh-CN/videos-edit'
import { useVideoSources, toDisplayState } from '@/lib/videos/use-sources'

function getApiCode(e: unknown): string | null {
  if (e !== null && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') {
    return (e as { code: string }).code
  }
  return null
}

export interface TabLinesProps {
  readonly videoId: string
}

export function TabLines({ videoId }: TabLinesProps): React.ReactElement {
  const [state, actions] = useVideoSources(videoId)
  const m = VE.lines

  const aggregatedLines = useMemo(() => groupSourcesByLine(state.sources), [state.sources])

  const handleToggleEpisode = async ({
    episodeId, nextActive,
  }: { lineKey: string; episodeId: string; nextActive: boolean; updatedAt: string }) => {
    try {
      await actions.toggle(episodeId, nextActive)
    } catch (e: unknown) {
      const code = getApiCode(e)
      const msg = code === 'REVIEW_RACE' ? m.errors.reviewRace
        : code === 'STATE_INVALID' ? m.errors.stateInvalid
        : m.errors.toggleFailed
      alert(msg)
    }
  }

  const handleDisableDead = async () => {
    try { await actions.disableDead() } catch { alert(m.errors.disableDeadFailed) }
  }

  const handleRefetch = async () => {
    try { await actions.refetch() } catch { alert(m.errors.refetchFailed) }
  }

  const handleHealthOpen = ({ episodeId }: { lineKey: string; episodeId: string }) => {
    actions.openHealth(episodeId)
  }

  const healthSrc = state.healthSourceId
    ? state.sources.find((s) => s.id === state.healthSourceId)
    : null
  const healthTitle = healthSrc
    ? m.healthDrawer.title(
        healthSrc.source_site_key ?? healthSrc.site_key ?? healthSrc.source_name,
        m.episodes(healthSrc.episode_number),
      )
    : ''

  if (state.loading && state.sources.length === 0) return <LoadingState variant="spinner" />
  if (state.error && state.sources.length === 0) return (
    <ErrorState error={state.error} title={m.errors.loadFailed} onRetry={actions.reload} />
  )

  return (
    <div>
      <LinesPanel
        lines={aggregatedLines}
        density="regular"
        onToggleEpisode={handleToggleEpisode}
        onDisableDead={handleDisableDead}
        onRefetch={handleRefetch}
        onHealthOpen={handleHealthOpen}
        toggling={state.togglePending}
        loading={state.loading && state.sources.length === 0}
        aria-label={m.title}
      />

      <p style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)', marginTop: '8px' }}>
        {m.hints.dragHint}
      </p>

      <LineHealthDrawer
        open={state.healthSourceId !== null}
        onClose={actions.closeHealth}
        title={healthTitle}
        probeState={healthSrc ? toDisplayState(healthSrc.probe_status) : 'unknown'}
        renderState={healthSrc ? toDisplayState(healthSrc.render_status) : 'unknown'}
        events={state.health?.data ?? []}
        loading={state.healthLoading}
        emptyText={m.healthDrawer.empty}
        loadingText={m.healthDrawer.loading}
        pagination={state.health ? {
          page: state.healthPage,
          total: state.health.pagination.total,
          limit: state.health.pagination.limit,
          onPageChange: actions.loadHealthPage,
        } : undefined}
        testId="data-line-health-drawer"
      />
    </div>
  )
}
