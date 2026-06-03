'use client'

/**
 * MergeCandidateExpand.tsx — 候选行展开 panel（card 形态，CHG-SN-7-MISC-MERGE-2）
 *
 * 拆自 MergeCandidatesSection（CHG-VIR-9-C / 500 行 budget）：
 * 左右对比卡片 + 影响预览 + 置信度/身份分双 pill + EvidencePanel（CHG-VIR-7）
 * + 拒绝候选按钮（identity 来源 / onReject 注入）。
 */

import { useState, type CSSProperties } from 'react'
import { AdminButton } from '@resovo/admin-ui'
import type { CandidateGroup, VideoSummaryForMerge } from '@resovo/types'
import { EvidencePanel } from './EvidencePanel'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

/** 次要文字（CandidatesSection 列/工具栏共用，真源在此） */
export const SECONDARY_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

// CHG-SN-5-12-PATCH P2-2：推荐 target 显式 badge
const RECOMMENDED_BADGE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  marginLeft: '6px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
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

const VIDEO_CARD_STYLE: CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  cursor: 'pointer',
}

const VIDEO_CARD_SELECTED_STYLE: CSSProperties = {
  border: '1px solid var(--state-success-border)',
  borderRadius: '8px',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  cursor: 'pointer',
  background: 'var(--state-success-bg)',
}

const IMPACT_PREVIEW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '8px 10px',
  borderRadius: '6px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
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

export function CandidateExpand({ group, onMerge, onReject, onRejectPair }: CandidateExpandProps) {
  const [targetId, setTargetId] = useState(group.recommendedTargetVideoId)
  const targetVideo = group.videos.find((v) => v.id === targetId)
  const sourceVideos = group.videos.filter((v) => v.id !== targetId)

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

      {/* 视频卡片网格（左右对比） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
        {group.videos.map((v: VideoSummaryForMerge) => (
          <div
            key={v.id}
            style={v.id === targetId ? VIDEO_CARD_SELECTED_STYLE : VIDEO_CARD_STYLE}
            onClick={() => setTargetId(v.id)}
            data-testid={`candidate-card-${v.id}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <input
                type="radio"
                name={`target-${group.groupKey}`}
                checked={targetId === v.id}
                onChange={() => setTargetId(v.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`选择 ${v.title} 为合并目标`}
              />
              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{v.title}</span>
              {v.id === group.recommendedTargetVideoId && (
                <span style={RECOMMENDED_BADGE_STYLE} aria-label="推荐合并目标">推荐</span>
              )}
            </div>
            <div style={SECONDARY_TEXT}>{v.sourceCount} 个源</div>
            <div style={{ ...SECONDARY_TEXT, fontSize: '11px' }}>
              {v.sourceSiteKeys.join(' · ') || '—'}
            </div>
            <div style={{ ...SECONDARY_TEXT, fontSize: '11px' }}>{v.createdAt.slice(0, 10)}</div>
          </div>
        ))}
      </div>

      {/* 影响预览 */}
      {sourceVideos.length > 0 && (
        <div style={IMPACT_PREVIEW_STYLE} data-testid="impact-preview">
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
            影响预览：{sourceVideos.length} 个源视频将合并到 {targetVideo?.title ?? '—'}
          </span>
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
            {sourceVideos.map((v) => (
              <li key={v.id}>
                {v.title}（{v.sourceCount} 个源{v.sourceSiteKeys.length > 0 ? `，${v.sourceSiteKeys.join('、')}` : ''}）
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        {/* CHG-VIR-9-C：identity 来源候选可人工拒绝（confirm = 执行合并透传 candidateId）*/}
        {onReject && (
          <AdminButton size="sm" variant="danger" onClick={onReject} data-testid="candidate-reject">
            拒绝候选
          </AdminButton>
        )}
        <AdminButton size="sm" variant="primary" onClick={() => onMerge(targetId)}>
          执行合并（{group.videos.length - 1} → target）
        </AdminButton>
      </div>
    </div>
  )
}
