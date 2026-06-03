'use client'

/**
 * EvidencePanel.tsx — 合并候选「多证据身份评分」展示面板（CHG-VIR-7 Phase 2a / ADR-105a）
 *
 * 从 MergeClient 抽出（避免既有超限文件继续膨胀 / 边界清晰）。
 * 消费 CandidateGroup.identity（GroupIdentityScore）：为何可合并（blockingReasons）/
 * 为何拦截（strongNegativeReasons veto）/ 逐对明细（pairs，身份分取最弱链接）。
 */

import type { CSSProperties } from 'react'
import type { EvidenceType, GroupIdentityScore } from '@resovo/types'

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

/** EvidenceType → 中文标签（UI「为何可合并 / 为何拦截」）。 */
export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  external_exact_id_match: '外部 exact ID 命中',
  external_alias_match: '外部别名命中',
  same_site_canonical_id: '同源站 canonical ID 一致',
  source_fingerprint_high_overlap: '源站指纹高重叠',
  core_title_key_equal: '核心标题一致',
  year_equal_or_off_by_one: '年份一致或差 1',
  type_compatible: '类型兼容',
  episode_structure_close: '集数结构接近',
  metadata_close: '元数据接近',
  external_id_conflict: '外部 ID 冲突',
  season_mismatch: '季号不一致',
  year_far_no_exact: '年份相差大且无 exact',
  type_incompatible: '类型不兼容',
  episode_pattern_conflict: '集数模式冲突',
  ordinal_conflict: '序号/部数冲突',
  release_marker_mismatch: '发布形态不一致（剧场版/OVA/SP）',
  release_marker_weak_signal: '发布形态弱信号（一方含剧场版/OVA/SP）',
}

export function EvidencePanel({ identity }: { identity: GroupIdentityScore }) {
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
          逐对证据明细（{identity.pairs.length} 对 · 身份分取最弱链接）
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          {identity.pairs.map((p) => (
            <div key={`${p.leftVideoId}-${p.rightVideoId}`} style={MUTED_SM}>
              <span style={{ fontWeight: 600 }}>
                {p.leftVideoId.slice(0, 8)} ↔ {p.rightVideoId.slice(0, 8)}
              </span>{' '}
              身份分 {(p.identityScore * 100).toFixed(1)}%
              {p.strongNegativeReasons.length > 0 && (
                <span style={{ marginLeft: '6px' }}>
                  {p.strongNegativeReasons.map((t) => (
                    <span key={t} style={CHIP_NEGATIVE}>{EVIDENCE_LABELS[t]}</span>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
