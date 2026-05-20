'use client'

/**
 * BrokenSamplesGrid.tsx — 破损样本瀑布格（CHG-SN-7-MISC-IMAGE-2）
 *
 * 设计：reference.md §5.8「右侧 破损样本（grid，2:3 ratio placeholder、
 *       danger dashed border、底部错误信息 overlay）」
 *
 * 数据来源：ImageHealthClient 传入 missingRows，client-side 过滤 posterStatus=broken。
 * 无新端点，UI 纯前端改动。
 */
import type { CSSProperties } from 'react'
import type { MissingVideoRow } from '@/lib/image-health/api'

// ── 样式常量 ──────────────────────────────────────────────────────

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
  gap: '8px',
}

const CARD_STYLE: CSSProperties = {
  position: 'relative',
  aspectRatio: '2 / 3',
  border: '2px dashed var(--state-danger-fg)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  background: 'var(--bg-surface-sunken)',
}

const PLACEHOLDER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  color: 'var(--state-danger-fg)',
  opacity: 0.4,
}

const OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'var(--state-danger-bg)',
  padding: '3px 4px',
  fontSize: '9px',
  lineHeight: '1.2',
  color: 'var(--state-danger-fg)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const EMPTY_STYLE: CSSProperties = {
  padding: '24px 0',
  textAlign: 'center',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
}

const HEADER_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginBottom: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const COUNT_BADGE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--state-danger-fg)',
  background: 'var(--state-danger-bg)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-pill)',
  fontWeight: 600,
}

// ── 最多渲染 n 个破损样本 ─────────────────────────────────────────
const MAX_SAMPLES = 24

// ── 子组件 ────────────────────────────────────────────────────────

function BrokenPosterCard({ row }: { row: MissingVideoRow }) {
  const overlayText = row.brokenDomain ?? row.posterStatus
  return (
    <div style={CARD_STYLE} data-broken-sample title={row.title}>
      <div style={PLACEHOLDER_STYLE} aria-hidden>✕</div>
      <div style={OVERLAY_STYLE} data-broken-overlay>
        {overlayText}
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export interface BrokenSamplesGridProps {
  readonly rows: readonly MissingVideoRow[]
}

export function BrokenSamplesGrid({ rows }: BrokenSamplesGridProps) {
  const broken = rows.filter((r) => r.posterStatus === 'broken').slice(0, MAX_SAMPLES)

  return (
    <div data-broken-samples-grid>
      <div style={HEADER_STYLE}>
        <span>近期破损样本</span>
        {broken.length > 0 && (
          <span style={COUNT_BADGE_STYLE} data-broken-count>
            {broken.length}
          </span>
        )}
      </div>
      {broken.length === 0 ? (
        <div style={EMPTY_STYLE}>暂无破损样本</div>
      ) : (
        <div style={GRID_STYLE} data-broken-grid>
          {broken.map((row) => (
            <BrokenPosterCard key={row.videoId} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}
