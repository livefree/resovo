'use client'

/**
 * MergeCandidateExpand.tsx — 候选行展开 panel（CHG-VIR-13-B2B 嵌入改造）
 *
 * 历史：CHG-SN-7-MISC-MERGE-2 card 形态 → CHG-VIR-9-C 拆出 + 拒绝按钮
 *       → CHG-VIR-13-B2B：视频卡网格 + 纯文本影响预览替换为
 *         MergeComparePanel（N 列字段矩阵 / §10.4 列头 target 单选）
 *         + MergeResultPreview（After 重算 + 软删列表 + 状态降级警示 / §10.5 结构预览）。
 *
 * 布局：双 pill → EvidencePanel → MergeComparePanel → MergeResultPreview → 操作行。
 * §10.4-2：新增「转入合并工作区」次级动作（组成员带入 mode=merge 集合编辑器）；
 * N>11 组整组合并禁用提示改为引导转工作区裁剪分批（逐 pair 拒绝保留）。
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdminButton } from '@resovo/admin-ui'
import type { CandidateGroup, VideoStatusSetting } from '@resovo/types'
import {
  legalStatusOptions,
  suggestMergeTargetStatus,
  GENERIC_STATUS_OPTIONS,
} from '@/lib/merge/status-defaults'
// CHG-VIR-15-UX-B ③：线路×集数数据拉取（按视频列嵌入对比矩阵）+ 结构信号推导
import { getVideoMatrix } from '@/lib/sources/api'
import { combineMatrices } from './StructurePreview'
import { EvidencePanel } from './EvidencePanel'
import { MergeComparePanel, type CompareLinesState } from './MergeComparePanel'
import { MergeResultPreview } from './MergeResultPreview'
import { MergeStatusControl } from './MergeStatusControl'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

/** 次要文字（CandidatesSection 列/工具栏共用，真源在此） */
export const SECONDARY_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const EXPAND_PANEL_STYLE: CSSProperties = {
  padding: '12px 16px 16px',
  background: 'var(--bg-surface-elevated)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  // CHG-VIR-15-UX-B ⑥：展开内容底部与下一条候选行强分隔
  borderBottom: '2px solid var(--border-strong)',
}

// CHG-VIR-7：身份评分（identityScore，UI 文案「相似度」/ CHG-VIR-14-SCORE-UI 定名）
const IDENTITY_PILL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  border: '1px solid var(--border-subtle)',
}

// ── 组件 ──────────────────────────────────────────────────────────

export interface CandidateExpandProps {
  group: CandidateGroup
  /** CHG-VIR-13-D2 / D-105-9：targetStatus = 操作内状态设置（null = 保持不变，不传字段） */
  onMerge: (targetVideoId: string, targetStatus?: VideoStatusSetting | null) => void
  /** CHG-VIR-9-C：identity 来源单 pair（group.candidateId 存在）时提供整行拒绝 */
  onReject?: () => void
  /** CHG-VIR-9-D / D-105a-18：折叠组逐 pair 拒绝（EvidencePanel pair 明细行内，per-candidate 端点） */
  onRejectPair?: (candidateId: string, label: string) => void
}

/** 单次 merge 视频上限 = sourceVideoIds max 10 + target 1（MergeSchema / ADR-105） */
const MAX_MERGE_GROUP_VIDEOS = 11

export function CandidateExpand({ group, onMerge, onReject, onRejectPair }: CandidateExpandProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [targetId, setTargetId] = useState(group.recommendedTargetVideoId)
  const exceedsMergeLimit = group.videos.length > MAX_MERGE_GROUP_VIDEOS

  // CHG-VIR-13-D2 / D-105-9（设计 §4.4）：操作内状态设置——智能默认 + 矩阵镜像选项。
  // D-105-7 字段缺失（legacy 候选降级）→ suggestion 安全回退不建议 + GENERIC 选项（后端 422 终守门）。
  const target = group.videos.find((v) => v.id === targetId)
  const statusSuggestion = useMemo(() => {
    if (!target) return { suggested: null, hint: null }
    return suggestMergeTargetStatus(target, group.videos.filter((v) => v.id !== targetId))
  }, [target, group.videos, targetId])
  const statusOptions = useMemo(
    () =>
      target?.reviewStatus !== undefined && target.visibilityStatus !== undefined
        ? legalStatusOptions({ reviewStatus: target.reviewStatus, visibilityStatus: target.visibilityStatus })
        : GENERIC_STATUS_OPTIONS,
    [target],
  )
  const [targetStatus, setTargetStatus] = useState<VideoStatusSetting | null>(null)
  // target 切换 → 重置为该 target 的智能默认建议
  useEffect(() => { setTargetStatus(statusSuggestion.suggested) }, [targetId, statusSuggestion.suggested])

  // CHG-VIR-15-UX-B ③：线路×集数惰性加载 + 收起（数据注入 ComparePanel 按视频列嵌入）
  const [linesState, setLinesState] = useState<CompareLinesState>({ status: 'idle', byVideo: new Map() })
  const toggleLines = useCallback(() => {
    if (linesState.status === 'ready') {
      setLinesState({ status: 'idle', byVideo: new Map() })  // 收起（再展开重新拉取）
      return
    }
    setLinesState({ status: 'loading', byVideo: new Map() })
    Promise.all(
      group.videos.map(async (v) => [v.id, await getVideoMatrix(v.id)] as const),
    )
      .then((entries) => setLinesState({ status: 'ready', byVideo: new Map(entries) }))
      .catch((err: unknown) => setLinesState({
        status: 'error', byVideo: new Map(),
        error: err instanceof Error ? err.message : '线路加载失败',
      }))
  }, [linesState.status, group.videos])

  // 结构信号（去重 N 条 / 互补 / 重叠）：线路就绪后零额外请求推导 → ResultPreview 展示
  const structureSignals = useMemo(() => {
    if (linesState.status !== 'ready') return undefined
    return combineMatrices(group.videos.map((v) => ({
      video: { id: v.id, title: v.title },
      lines: [...(linesState.byVideo.get(v.id) ?? [])],
    }))).signals
  }, [linesState, group.videos])

  // §10.4-2：组成员带入 mode=merge 集合编辑器（保留既有 URL 参数；candidate 锚点不带——
  // 工作区集合可增删，confirm 锚点仅 MergeWorkspace 自身 pair 守卫管理）
  const transferToWorkspace = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('mode', 'merge')
    p.set('ids', group.videos.map((v) => v.id).join(','))
    p.delete('candidate_a')
    p.delete('candidate_b')
    p.delete('candidate_id')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams, group.videos])

  return (
    <div style={EXPAND_PANEL_STYLE}>
      {/* 相似度（identityScore=多证据）pill + 候选数；置信度 pill（legacyScore）CHG-VIR-14-SCORE-UI 退役 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {group.identity && (
          <span style={IDENTITY_PILL_STYLE} data-testid="identity-pill">
            相似度 {(group.identity.identityScore * 100).toFixed(1)}%
          </span>
        )}
        <span style={SECONDARY_TEXT}>{group.videos.length} 个候选视频</span>
      </div>

      {/* CHG-VIR-7：多证据身份评分面板（为何可合并 / 为何拦截 / 逐对明细）
          CHG-VIR-9-D：折叠组（多 pair）时逐 pair 拒绝按钮注入明细行 */}
      {group.identity && <EvidencePanel identity={group.identity} onRejectPair={onRejectPair} />}

      {/* CHG-VIR-13-B2B：N 列字段对比矩阵（列头 target 单选 / 冲突标警 / §10.4）
          CHG-VIR-15-UX-B ③：线路×集数行按视频列嵌入（展开/收起 + 列内嵌播放器） */}
      <MergeComparePanel
        videos={group.videos}
        targetId={targetId}
        onTargetChange={setTargetId}
        recommendedTargetId={group.recommendedTargetVideoId}
        linesState={linesState}
        onToggleLines={toggleLines}
      />

      {/* CHG-VIR-13-B2B：合并后结果预览（After 重算 + 软删列表 + 状态降级警示）
          UX-B：结构信号经已加载线路数据零请求推导注入（线路列表本体已迁矩阵行） */}
      <MergeResultPreview kind="merge" videos={group.videos} targetId={targetId} signals={structureSignals} />

      {/* CHG-VIR-13-D2 / D-105-9（§4.4）：合并后 target 状态设置（智能默认预选 + 矩阵镜像选项） */}
      <MergeStatusControl
        options={statusOptions}
        value={targetStatus}
        onChange={setTargetStatus}
        hint={statusSuggestion.hint}
        data-testid="candidate-status-control"
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* §10.4-2：>11 组整组合并禁用 → 引导转工作区裁剪分批（替换旧「逐对明细分批」提示） */}
        {exceedsMergeLimit && (
          <span style={SECONDARY_TEXT} data-testid="merge-limit-note">
            组内 {group.videos.length} 个视频超过单次合并上限（{MAX_MERGE_GROUP_VIDEOS}），请转入批量合并裁剪集合分批执行
          </span>
        )}
        {/* §10.4-2：次级动作 — 组成员带入 mode=merge 集合编辑器（可继续增删后执行） */}
        <AdminButton
          size="sm"
          variant="secondary"
          onClick={transferToWorkspace}
          data-testid="candidate-transfer-workspace"
        >
          转入批量合并
        </AdminButton>
        {/* CHG-VIR-9-C：identity 来源候选可人工拒绝（confirm = 执行合并透传 candidateId）*/}
        {onReject && (
          <AdminButton size="sm" variant="danger" onClick={onReject} data-testid="candidate-reject">
            拒绝候选
          </AdminButton>
        )}
        <AdminButton
          size="sm"
          variant="primary"
          disabled={exceedsMergeLimit}
          onClick={() => onMerge(targetId, targetStatus)}
        >
          执行合并（{group.videos.length - 1} → target）
        </AdminButton>
      </div>
    </div>
  )
}
