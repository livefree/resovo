'use client'

/**
 * SourceLinesExpand.tsx — `/admin/sources` 行展开区线路面板（CHG-VSR-6 / 设计 §3.6）
 *
 * 替换旧 `MatrixExpand`（SourceMatrixRow.tsx）：消费中性 `useSourceLinesController`
 * + 共享 `LinesPanel` + client 端 `groupSourcesByLine`。
 *
 * 相对旧实现的修复（设计 §3.6 收益）：
 *   - 消除 render 阶段发请求反范式（controller 在 useEffect 内 reload）
 *   - 消除 `.slice(0,8)` 集数截断（LinesPanel 行展开后渲染全部集，任意集数不截断）
 *   - 全操作接通：单集/整组 toggle·probe·render·disableDead·refetch·health（旧版 3 个按钮无 onClick）
 *   - 显示别名运维短码 codename / 退役态 retired / 自动退役 auto_retired（LinesPanel 已内建）
 *
 * 用法定位：
 *   - density='regular'（表格内展开区，非审核台 compact）
 *   - 无选中态：不传 selectedKey/onLineSelect（无 AdminPlayer 桥接需求）
 *   - 不传 onToggleLine：controller 无 line 级 toggle 原子操作，与审核台/TabLines 两参考消费方一致
 *
 * 反馈（R4 留消费方本地化）：
 *   - toggle/disableDead/refetch 失败 → LinesPanel `actionError` 红条（与审核台一致）
 *   - probe/render/batch 结果 → useToast 浮层（全局 store / 无需 Provider）
 *
 * Drawer（R5 留消费方）：开合/分页/标题本地；取数走 `actions.fetchHealth`。
 *   本组件为 drawer 逻辑第 3 处本地实现（仿 TabLines）；提取共享 `useLineHealthDrawer`
 *   留独立 follow-up 卡（用户裁决 2026-06-02 / 需 Opus 评审 + 审核台关键路径回归）。
 *
 * 依赖方向单向：lib/sources + @resovo/admin-ui，不反向 import /admin/moderation 内部组件。
 */

import { useState, useCallback, useMemo } from 'react'
import {
  LinesPanel,
  groupSourcesByLine,
  LineHealthDrawer,
  useToast,
} from '@resovo/admin-ui'
import { toDisplayState } from '@/lib/sources/api'
import { useSourceLinesController } from '@/lib/sources/use-source-lines-controller'
import type { SourceActionResult } from '@/lib/sources/use-source-lines-controller'
import { useLineHealthDrawer } from '@/lib/sources/use-line-health-drawer'

// ── 内联文案（sources 模块无 i18n 文件，跟随 SourcesClient/SourceColumns 现状）──────

const TXT = {
  loadFailed: '线路加载失败',
  toggleRace: '该源已被他人修改，请刷新后重试',
  toggleFailed: '启停失败，请稍后重试',
  disableDeadFailed: '禁用失效源失败',
  refetchFailed: '重新采集失败',
  probeDead: '该线路探测失效',
  probeFreeze: '采集已冻结，无法触发探测',
  probeFailed: '探测失败，请稍后重试',
  renderDead: '该线路渲染失败',
  renderFailed: '试播失败，请稍后重试',
  probeAllFreeze: '采集已冻结，无法批量探测',
  probeAllFailed: '全部探测失败，请稍后重试',
  renderAllFailed: '全部试播失败，请稍后重试',
  ariaLabel: '播放线路展开',
  fullEpisode: '全集',
  healthEmpty: '暂无健康事件记录',
  healthLoading: '加载中…',
} as const

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SourceLinesExpandProps {
  readonly videoId: string
  /**
   * SRCHEALTH-P1-4（B3）：probe / render-check（单集或批量）成功后通知上游——
   * 外层 VideoGroupRow 聚合列（探测/试播/最近检测）来自 listVideoGroups 服务端聚合，
   * 需联动 refetch 才与 video_sources 现状一致。范式对齐审核台 LinesPanel（CHG-358）。
   * toggle / disableDead 不触发（非探测口径，与审核台一致）。
   */
  readonly onSourceHealthChanged?: () => void
}

// ── Main ────────────────────────────────────────────────────────────────────────

export function SourceLinesExpand({ videoId, onSourceHealthChanged }: SourceLinesExpandProps) {
  const toast = useToast()
  // R4：toggle/disableDead/refetch 失败本地化红条（LinesPanel actionError slot）
  const [actionError, setActionError] = useState<string | null>(null)

  // R4：结构化结果 → toast 浮层 / actionError 红条（与审核台 LinesPanel 同口径）
  const handleActionResult = useCallback((r: SourceActionResult) => {
    switch (r.action) {
      case 'toggle':
        setActionError(r.status === 'race' ? TXT.toggleRace : r.status === 'failed' ? TXT.toggleFailed : null)
        return
      case 'disableDead':
        if (r.status === 'failed') setActionError(TXT.disableDeadFailed)
        return
      case 'refetch':
        if (r.status === 'failed') setActionError(TXT.refetchFailed)
        return
      case 'probeEpisode':
        if (r.status === 'success') {
          onSourceHealthChanged?.()
          if (r.dead) toast.push({ title: '探测', description: TXT.probeDead, level: 'warn' })
        } else {
          toast.push({ title: '探测失败', description: r.status === 'freeze' ? TXT.probeFreeze : TXT.probeFailed, level: 'danger' })
        }
        return
      case 'renderCheckEpisode':
        if (r.status === 'success') {
          onSourceHealthChanged?.()
          if (r.dead) toast.push({ title: '试播', description: TXT.renderDead, level: 'warn' })
        } else {
          toast.push({ title: '试播失败', description: TXT.renderFailed, level: 'danger' })
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
          toast.push({ title: '全部探测失败', description: r.status === 'freeze' ? TXT.probeAllFreeze : TXT.probeAllFailed, level: 'danger' })
        }
        return
      case 'renderCheckAll':
        if (r.status === 'success' && r.summary) {
          onSourceHealthChanged?.()
          const { ok, dead, total, failed } = r.summary
          // SRCHEALTH-P1-3：partial（manifest 部分可用）独立分桶，不并入 ok/dead
          const partial = r.summary.partial ?? 0
          if (dead > 0 || failed > 0 || partial > 0) {
            toast.push({ title: '全部试播完成', description: `${ok}/${total} 渲染正常${partial > 0 ? ` · ${partial} 部分可用` : ''}${dead > 0 ? ` · ${dead} 失败` : ''}${failed > 0 ? ` · ${failed} 异常` : ''}`, level: 'warn' })
          } else {
            toast.push({ title: '全部试播完成', description: `${total} 条线路渲染正常`, level: 'success' })
          }
        } else {
          toast.push({ title: '全部试播失败', description: TXT.renderAllFailed, level: 'danger' })
        }
        return
    }
  }, [toast, onSourceHealthChanged])

  const [state, actions] = useSourceLinesController(videoId, { onActionResult: handleActionResult })

  const aggregatedLines = useMemo(() => groupSourcesByLine(state.lines), [state.lines])

  // ── Health drawer（CHG-VSR-6-FOLLOWUP：共享 hook / 取数+并发+分页中性化）──────
  // loadFailedText 注入 → 保留 error 红条 + retry（R3）；probeState/renderState/title 实时派生留本地（R4）。
  const [health, healthActions] = useLineHealthDrawer({
    fetchHealth: actions.fetchHealth,
    loadFailedText: TXT.loadFailed,
  })

  const healthSrc = health.sourceId ? state.lines.find((l) => l.id === health.sourceId) ?? null : null
  const healthTitle = healthSrc
    ? `${healthSrc.source_name} · ${healthSrc.episode_number != null ? `EP${healthSrc.episode_number}` : TXT.fullEpisode}`
    : ''

  return (
    <div style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
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
        error={state.error ? TXT.loadFailed : null}
        onErrorRetry={actions.reload}
        actionError={actionError}
        aria-label={TXT.ariaLabel}
        testId="sources-lines-expand"
      />
      <LineHealthDrawer
        open={health.open}
        onClose={healthActions.close}
        title={healthTitle}
        probeState={healthSrc ? toDisplayState(healthSrc.probe_status) : 'unknown'}
        renderState={healthSrc ? toDisplayState(healthSrc.render_status) : 'unknown'}
        events={health.events}
        loading={health.loading}
        error={health.error ? { message: health.error, onRetry: healthActions.retry } : null}
        emptyText={TXT.healthEmpty}
        loadingText={TXT.healthLoading}
        pagination={health.pagination}
        testId="sources-line-health-drawer"
      />
    </div>
  )
}
