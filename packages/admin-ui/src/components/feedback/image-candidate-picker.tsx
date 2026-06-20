'use client'

/**
 * image-candidate-picker.tsx — ImageCandidatePicker 共享组件实装（IMGH-P2-2B / SEQ-20260619-02）
 *
 * 多源补图候选缩略选图器。契约与设计依据见 image-candidate-picker.types.ts 头部
 * （arch-reviewer claude-opus-4-8 agentId a9732b79ad7128d4d 设计）。
 *
 * 哑受控：候选数组由消费方传入，选中态受控（selectedKey + onSelect），不调 API。
 * 空/加载/错误态复用 state 原语；confidence 视觉仅由 isWinner 决定（🟢/🟡，不硬编码阈值）。
 * 颜色零硬编码（design-tokens）+ 零图标库（dot=span / 来源图标经 renderSourcePill 注入）+ Edge 兼容。
 */

import React from 'react'
import { Pill } from '../cell/pill'
import { EmptyState, LoadingState, ErrorState } from '../state'
import type {
  ImageCandidatePickerProps,
  ImageCandidateOption,
} from './image-candidate-picker.types'

// ── 样式（全 token，零硬编码颜色） ────────────────────────────────

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: '8px',
}
const CARD_BASE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '6px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
}
const CARD_SELECTED: React.CSSProperties = {
  ...CARD_BASE,
  borderColor: 'var(--accent-default)',
  boxShadow: '0 0 0 1px var(--accent-default)',
}
const THUMB_AREA_STYLE: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '2 / 3',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-surface-sunken)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
}
const THUMB_IMG_STYLE: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'cover',
  width: '100%',
  height: '100%',
}
const THUMB_FALLBACK_STYLE: React.CSSProperties = {
  fontSize: '24px',
  color: 'var(--fg-muted)',
  opacity: 0.5,
}
const APPLIED_BADGE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '4px',
  right: '4px',
  fontSize: 'var(--font-size-xs)',
  padding: '1px 6px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
}
const META_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4px',
}
const CONF_DOT_STYLE: React.CSSProperties = {
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  flexShrink: 0,
}

function ConfidenceDot({
  isWinner,
  labels,
}: {
  readonly isWinner: boolean
  readonly labels?: { readonly high: string; readonly low: string }
}): React.ReactElement {
  const color = isWinner ? 'var(--state-success-fg)' : 'var(--state-warning-fg)'
  const label = isWinner ? (labels?.high ?? '高置信') : (labels?.low ?? '待确认')
  return (
    <span
      style={{ ...CONF_DOT_STYLE, background: color }}
      role="img"
      aria-label={label}
      title={label}
      data-candidate-confidence={isWinner ? 'high' : 'low'}
    />
  )
}

// ── 单候选卡 ──────────────────────────────────────────────────────

function CandidateCard({
  option,
  selected,
  appliedLabel,
  confidenceLabels,
  renderSourcePill,
  onSelect,
}: {
  readonly option: ImageCandidateOption
  readonly selected: boolean
  readonly appliedLabel: React.ReactNode
  readonly confidenceLabels?: { readonly high: string; readonly low: string }
  readonly renderSourcePill?: (o: ImageCandidateOption) => React.ReactNode
  readonly onSelect: (o: ImageCandidateOption) => void
}): React.ReactElement {
  const [errored, setErrored] = React.useState(false)
  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      aria-pressed={selected}
      style={selected ? CARD_SELECTED : CARD_BASE}
      data-candidate-card={option.key}
      data-selected={selected ? 'true' : undefined}
    >
      <div style={THUMB_AREA_STYLE}>
        {errored ? (
          <span style={THUMB_FALLBACK_STYLE} aria-label="缩略不可用" role="img" data-candidate-thumb-fallback>⊘</span>
        ) : (
          <img
            src={option.url}
            alt=""
            onError={() => setErrored(true)}
            style={THUMB_IMG_STYLE}
            data-candidate-thumb={option.key}
          />
        )}
        {option.applied && (
          <span style={APPLIED_BADGE_STYLE} data-candidate-applied>{appliedLabel}</span>
        )}
      </div>
      <div style={META_ROW_STYLE}>
        {renderSourcePill
          ? renderSourcePill(option)
          : <Pill variant="neutral">{option.sourceLabel ?? option.source}</Pill>}
        <ConfidenceDot isWinner={option.isWinner} labels={confidenceLabels} />
      </div>
    </button>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function ImageCandidatePicker({
  candidates,
  selectedKey,
  onSelect,
  loading = false,
  error,
  loadMoreSlot,
  renderSourcePill,
  emptyTitle,
  emptyDescription,
  confidenceLabels,
  appliedLabel = '已应用',
  testId,
}: ImageCandidatePickerProps): React.ReactElement {
  let body: React.ReactNode
  if (error) {
    body = <ErrorState error={new Error(error.message)} onRetry={error.onRetry} />
  } else if (loading) {
    body = <LoadingState variant="skeleton" />
  } else if (candidates.length === 0) {
    body = <EmptyState title={emptyTitle ?? '暂无候选'} description={emptyDescription ?? '该字段当前无外部源补图候选'} />
  } else {
    body = (
      <div style={GRID_STYLE} data-candidate-grid>
        {candidates.map((option) => (
          <CandidateCard
            key={option.key}
            option={option}
            selected={option.key === selectedKey}
            appliedLabel={appliedLabel}
            confidenceLabels={confidenceLabels}
            renderSourcePill={renderSourcePill}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  return (
    <div data-testid={testId} data-image-candidate-picker>
      {body}
      {loadMoreSlot && <div data-candidate-load-more>{loadMoreSlot}</div>}
    </div>
  )
}
