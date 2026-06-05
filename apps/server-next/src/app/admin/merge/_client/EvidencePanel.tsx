'use client'

/**
 * EvidencePanel.tsx — 合并候选「多证据身份评分」展示面板（CHG-VIR-7 Phase 2a / ADR-105a）
 *
 * 从 MergeClient 抽出（避免既有超限文件继续膨胀 / 边界清晰）。
 * 消费 CandidateGroup.identity（GroupIdentityScore）：为何可合并（blockingReasons）/
 * 为何拦截（strongNegativeReasons veto）/ 逐对明细（pairs，相似度取最弱链接）。
 */

import type { CSSProperties } from 'react'
import { AdminButton } from '@resovo/admin-ui'
import type { GroupIdentityScore } from '@resovo/types'
import { EVIDENCE_LABELS } from '@/lib/identity/evidence-labels'

// ── 样式（颜色零硬编码，全用 state/border CSS 变量）──────────────────

const MUTED_SM: CSSProperties = { fontSize: '11px', color: 'var(--fg-muted)' }

const BLOCK_BANNER_STYLE: CSSProperties = {
  padding: '6px 10px',
  borderRadius: '6px',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  background: 'var(--state-danger-bg)',
  color: 'var(--state-danger-fg)',
  border: '1px solid var(--state-danger-border)',
}

const CHIP_POSITIVE: CSSProperties = {
  display: 'inline-block',
  padding: '1px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
}

const CHIP_NEGATIVE: CSSProperties = {
  display: 'inline-block',
  padding: '1px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  marginRight: '4px',
  background: 'var(--state-danger-bg)',
  color: 'var(--state-danger-fg)',
  border: '1px solid var(--state-danger-border)',
}

// EVIDENCE_LABELS 真源已沉淀至 @/lib/identity/evidence-labels（CHG-VIR-9-C：TabSimilar 加入消费）

export interface EvidencePanelProps {
  identity: GroupIdentityScore
  /**
   * CHG-VIR-9-D / D-105a-18：折叠组逐 pair 拒绝（pair.candidateId 存在时渲染行内按钮，
   * 调 per-candidate reject 端点；不提供"拒绝整组"——非原子且分量内 pair 证据异质）。
   */
  onRejectPair?: (candidateId: string, label: string) => void
}

export function EvidencePanel({ identity, onRejectPair }: EvidencePanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="evidence-panel">
      {identity.autoMergeBlocked && identity.strongNegativeReasons.length > 0 && (
        <div style={BLOCK_BANNER_STYLE} data-testid="evidence-block-banner">
          为何拦截：{identity.strongNegativeReasons.map((t) => EVIDENCE_LABELS[t]).join('、')}（强负硬否决，需人工 override）
        </div>
      )}
      {identity.blockingReasons.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={MUTED_SM}>为何可合并：</span>
          {identity.blockingReasons.map((t) => (
            <span key={t} style={CHIP_POSITIVE}>{EVIDENCE_LABELS[t]}</span>
          ))}
        </div>
      )}
      <details>
        <summary style={{ ...MUTED_SM, cursor: 'pointer' }}>
          逐对证据明细（{identity.pairs.length} 对 · 相似度取最弱链接）
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          {identity.pairs.map((p) => {
            const pairLabel = `${p.leftVideoId.slice(0, 8)} ↔ ${p.rightVideoId.slice(0, 8)}`
            return (
              <div
                key={`${p.leftVideoId}-${p.rightVideoId}`}
                style={{ ...MUTED_SM, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
              >
                <span style={{ fontWeight: 600 }}>{pairLabel}</span>
                <span>相似度 {(p.identityScore * 100).toFixed(1)}%</span>
                {p.strongNegativeReasons.length > 0 && (
                  <span>
                    {p.strongNegativeReasons.map((t) => (
                      <span key={t} style={CHIP_NEGATIVE}>{EVIDENCE_LABELS[t]}</span>
                    ))}
                  </span>
                )}
                {/* CHG-VIR-9-D：逐 pair 拒绝（per-candidate 端点 / 折叠组操作锚点） */}
                {onRejectPair && p.candidateId && (
                  <AdminButton
                    size="sm"
                    variant="danger"
                    onClick={() => onRejectPair(p.candidateId!, pairLabel)}
                    data-testid={`pair-reject-${p.candidateId}`}
                  >
                    拒绝此对
                  </AdminButton>
                )}
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}
