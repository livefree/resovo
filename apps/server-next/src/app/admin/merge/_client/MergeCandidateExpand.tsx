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

import { useCallback, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdminButton } from '@resovo/admin-ui'
import type { CandidateGroup } from '@resovo/types'
import { EvidencePanel } from './EvidencePanel'
import { MergeComparePanel } from './MergeComparePanel'
import { MergeResultPreview } from './MergeResultPreview'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

/** 次要文字（CandidatesSection 列/工具栏共用，真源在此） */
export const SECONDARY_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const EXPAND_PANEL_STYLE: CSSProperties = {
  padding: '12px 16px',
  background: 'var(--bg-surface-elevated)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const CONFIDENCE_PILL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
}

// CHG-VIR-7：身份评分（identityScore 与 legacyScore 双值并存，文案区分防语义混淆 / R3）
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
  onMerge: (targetVideoId: string) => void
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
      {/* 置信度（legacyScore=源重合度）+ 身份分（identityScore=多证据）双 pill + 候选数（字段分离 / R3）*/}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={CONFIDENCE_PILL_STYLE} data-testid="confidence-pill">
          {(group.score * 100).toFixed(1)}% 置信度
        </span>
        {group.identity && (
          <span style={IDENTITY_PILL_STYLE} data-testid="identity-pill">
            身份分 {(group.identity.identityScore * 100).toFixed(1)}%
          </span>
        )}
        <span style={SECONDARY_TEXT}>{group.videos.length} 个候选视频</span>
      </div>

      {/* CHG-VIR-7：多证据身份评分面板（为何可合并 / 为何拦截 / 逐对明细）
          CHG-VIR-9-D：折叠组（多 pair）时逐 pair 拒绝按钮注入明细行 */}
      {group.identity && <EvidencePanel identity={group.identity} onRejectPair={onRejectPair} />}

      {/* CHG-VIR-13-B2B：N 列字段对比矩阵（列头 target 单选 / 冲突标警 / §10.4） */}
      <MergeComparePanel
        videos={group.videos}
        targetId={targetId}
        onTargetChange={setTargetId}
        recommendedTargetId={group.recommendedTargetVideoId}
      />

      {/* CHG-VIR-13-B2B：合并后结果预览（After 重算 + 软删列表 + 状态降级警示 + §10.5 结构预览） */}
      <MergeResultPreview kind="merge" videos={group.videos} targetId={targetId} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* §10.4-2：>11 组整组合并禁用 → 引导转工作区裁剪分批（替换旧「逐对明细分批」提示） */}
        {exceedsMergeLimit && (
          <span style={SECONDARY_TEXT} data-testid="merge-limit-note">
            组内 {group.videos.length} 个视频超过单次合并上限（{MAX_MERGE_GROUP_VIDEOS}），请转入合并工作区裁剪集合分批合并
          </span>
        )}
        {/* §10.4-2：次级动作 — 组成员带入 mode=merge 集合编辑器（可继续增删后执行） */}
        <AdminButton
          size="sm"
          variant="secondary"
          onClick={transferToWorkspace}
          data-testid="candidate-transfer-workspace"
        >
          转入合并工作区
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
          onClick={() => onMerge(targetId)}
        >
          执行合并（{group.videos.length - 1} → target）
        </AdminButton>
      </div>
    </div>
  )
}
