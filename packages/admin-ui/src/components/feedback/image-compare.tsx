'use client'

/**
 * image-compare.tsx — ImageCompare 共享组件实装（IMGH-P2-2A / SEQ-20260619-02）
 *
 * 「当前图 vs 候选新图」并排对比 + 确认替换闸门。契约与设计依据见 image-compare.types.ts 头部
 * （arch-reviewer claude-opus-4-8 agentId a9732b79ad7128d4d 设计）。
 *
 * 哑受控区块（非 overlay；内嵌 Drawer 替换区）：onConfirm 仅回传候选尺寸，不调 API。
 * 候选探活 + 最小尺寸校验通过才允许确认。窄屏 flex-wrap 纯 CSS 纵向堆叠。颜色零硬编码（design-tokens）。
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Pill } from '../cell/pill'
import type { PillVariant } from '../cell/pill.types'
import type { ImageStatus, ImageNaturalSize } from './image-lightbox.types'
import {
  DEFAULT_MIN_DIMENSION,
  type ImageCompareProps,
  type ImageCompareSide,
  type ImageCompareValidation,
} from './image-compare.types'

// status → Pill 映射（与 ImageLightbox 一致，复用稳定语义）
const STATUS_TO_PILL: Record<ImageStatus, PillVariant> = {
  ok: 'ok',
  broken: 'danger',
  missing: 'danger',
  pending_review: 'warn',
  low_quality: 'info',
}
const STATUS_LABEL: Record<ImageStatus, string> = {
  ok: '可用',
  broken: '破损',
  missing: '缺失',
  pending_review: '待复核',
  low_quality: '低质量',
}

function devWarn(msg: string): void {
  if (process.env.NODE_ENV !== 'production') console.warn(`[ImageCompare] ${msg}`)
}

type LoadState = 'loading' | 'loaded' | 'error' | 'empty'

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}
/** 自然尺寸 → 简化比例标注，如 200×300 → '2:3'；无尺寸 → fallback */
function formatAspect(size: ImageNaturalSize | null, fallback: string): string {
  if (!size || size.width <= 0 || size.height <= 0) return fallback
  const g = gcd(size.width, size.height) || 1
  return `${size.width / g}:${size.height / g}`
}

// ── 样式（全 token，零硬编码颜色） ────────────────────────────────

const ROOT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}
const PAIR_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',          // 窄屏自动纵向堆叠
  alignItems: 'stretch',
  gap: '8px',
}
const SIDE_STYLE: React.CSSProperties = {
  flex: '1 1 240px',         // min-basis 240px → 容器窄于 ~520px 时换行堆叠
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px',
  background: 'var(--bg-surface)',
}
const ARROW_STYLE: React.CSSProperties = {
  flex: '0 0 auto',
  alignSelf: 'center',
  fontSize: 'var(--font-size-lg)',
  color: 'var(--fg-muted)',
}
const SIDE_HEAD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
}
const SIDE_LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}
const IMAGE_AREA_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '120px',
  maxHeight: '40vh',
  background: 'var(--bg-surface-sunken)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
}
const IMG_STYLE: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: '40vh',
  objectFit: 'contain',
}
const FALLBACK_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '24px',
}
const FALLBACK_ICON_STYLE: React.CSSProperties = { fontSize: '28px', opacity: 0.5, color: 'var(--fg-muted)' }
const FALLBACK_TEXT_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }
const META_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}
const REACH_OK_STYLE: React.CSSProperties = { color: 'var(--state-success-fg)' }
const REACH_BAD_STYLE: React.CSSProperties = { color: 'var(--state-error-fg)' }
const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
}
const HINT_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--state-warning-fg)',
  marginRight: 'auto',
  alignSelf: 'center',
}
const BTN_BASE: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-sm)',
  padding: '4px 12px',
  cursor: 'pointer',
}
const CANCEL_BTN_STYLE: React.CSSProperties = {
  ...BTN_BASE,
  background: 'transparent',
  color: 'var(--fg-default)',
}
const CONFIRM_BTN_STYLE: React.CSSProperties = {
  ...BTN_BASE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  borderColor: 'var(--accent-default)',
}
const CONFIRM_BTN_DISABLED_STYLE: React.CSSProperties = {
  ...BTN_BASE,
  background: 'var(--bg-surface-sunken)',
  color: 'var(--fg-disabled)',
  cursor: 'not-allowed',
}

// ── 单侧 ──────────────────────────────────────────────────────────

function CompareSide({
  side,
  defaultLabel,
  loadState,
  size,
  dimensionFallbackText,
  reachLabel,
  testidPrefix,
  onLoad,
  onError,
}: {
  readonly side: ImageCompareSide
  readonly defaultLabel: string
  readonly loadState: LoadState
  readonly size: ImageNaturalSize | null
  readonly dimensionFallbackText: string
  readonly reachLabel?: { readonly ok: boolean }
  readonly testidPrefix: string
  readonly onLoad: (size: ImageNaturalSize) => void
  readonly onError: () => void
}): React.ReactElement {
  const showImg = (loadState === 'loading' || loadState === 'loaded') && !!side.url
  const dimText = loadState === 'loaded' && size ? `${size.width} × ${size.height}` : dimensionFallbackText
  const aspectText = formatAspect(loadState === 'loaded' ? size : null, dimensionFallbackText)
  return (
    <div style={SIDE_STYLE} data-compare-side={testidPrefix}>
      <div style={SIDE_HEAD_STYLE}>
        <span style={SIDE_LABEL_STYLE}>{side.label ?? defaultLabel}</span>
        {side.status && <Pill variant={STATUS_TO_PILL[side.status]}>{STATUS_LABEL[side.status]}</Pill>}
      </div>
      <div style={IMAGE_AREA_STYLE}>
        {showImg ? (
          <img
            src={side.url ?? undefined}
            alt={side.alt ?? ''}
            onLoad={(e) => onLoad({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            onError={onError}
            style={IMG_STYLE}
            data-compare-img={testidPrefix}
          />
        ) : (
          <div role="img" aria-label={side.alt ?? '图片不可用'} style={FALLBACK_STYLE} data-compare-fallback={testidPrefix}>
            <span style={FALLBACK_ICON_STYLE} aria-hidden>⊘</span>
            <span style={FALLBACK_TEXT_STYLE}>{loadState === 'empty' ? '待选图' : '图片加载失败'}</span>
          </div>
        )}
      </div>
      <div style={META_ROW_STYLE}>
        <span data-compare-dim={testidPrefix}>尺寸 {dimText}</span>
        <span data-compare-aspect={testidPrefix}>比例 {aspectText}</span>
        {reachLabel && (
          <span
            style={reachLabel.ok ? REACH_OK_STYLE : REACH_BAD_STYLE}
            data-compare-reach={testidPrefix}
          >
            {reachLabel.ok ? '✓ 可达' : '✗ 不可达'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function ImageCompare({
  open,
  current,
  candidate,
  onConfirm,
  onCancel,
  minWidth = DEFAULT_MIN_DIMENSION,
  minHeight = DEFAULT_MIN_DIMENSION,
  onCandidateValidated,
  confirmLabel = '确认替换',
  cancelLabel = '取消',
  metaSlot,
  dimensionFallbackText = '—',
  testId,
}: ImageCompareProps): React.ReactElement | null {
  const [currentLoad, setCurrentLoad] = useState<LoadState>(current.url ? 'loading' : 'empty')
  const [currentSize, setCurrentSize] = useState<ImageNaturalSize | null>(null)
  const [candidateLoad, setCandidateLoad] = useState<LoadState>(candidate.url ? 'loading' : 'empty')
  const [candidateSize, setCandidateSize] = useState<ImageNaturalSize | null>(null)

  // url 变化 → 重置对应侧
  useEffect(() => {
    setCurrentLoad(current.url ? 'loading' : 'empty')
    setCurrentSize(null)
  }, [current.url])
  useEffect(() => {
    setCandidateLoad(candidate.url ? 'loading' : 'empty')
    setCandidateSize(null)
  }, [candidate.url])

  // a11y dev warn
  useEffect(() => {
    if (current.url && !current.alt) devWarn('current.url 非空但缺 alt')
    if (candidate.url && !candidate.alt) devWarn('candidate.url 非空但缺 alt')
  }, [current.url, current.alt, candidate.url, candidate.alt])

  const validation = useMemo<ImageCompareValidation>(() => {
    const reachable = candidateLoad === 'loaded' && candidateSize != null
    const meetsMinDimension =
      reachable && candidateSize!.width >= minWidth && candidateSize!.height >= minHeight
    return { reachable, meetsMinDimension, size: reachable ? candidateSize : null }
  }, [candidateLoad, candidateSize, minWidth, minHeight])

  // 校验态变化回传消费方
  useEffect(() => {
    onCandidateValidated?.(validation)
  }, [validation, onCandidateValidated])

  const handleConfirm = useCallback(() => {
    if (candidate.url == null || !validation.reachable || !validation.meetsMinDimension || validation.size == null) {
      return
    }
    onConfirm({ candidateUrl: candidate.url, candidateSize: validation.size })
  }, [candidate.url, validation, onConfirm])

  if (!open) return null

  const canConfirm = candidate.url != null && validation.reachable && validation.meetsMinDimension
  // 候选已加载但尺寸不达标 → 给运营明确提示（无死按钮 §17.5）
  const dimHint =
    candidate.url != null && validation.reachable && !validation.meetsMinDimension
      ? `候选尺寸过小（< ${minWidth}×${minHeight}），不建议替换`
      : candidate.url != null && candidateLoad === 'error'
        ? '候选图不可达，无法替换'
        : null

  return (
    <div style={ROOT_STYLE} data-testid={testId} data-image-compare>
      {metaSlot ?? (
        <div style={PAIR_STYLE}>
          <CompareSide
            side={current}
            defaultLabel="当前"
            loadState={currentLoad}
            size={currentSize}
            dimensionFallbackText={dimensionFallbackText}
            testidPrefix="current"
            onLoad={(s) => { setCurrentSize(s); setCurrentLoad('loaded') }}
            onError={() => setCurrentLoad('error')}
          />
          <span style={ARROW_STYLE} aria-hidden>→</span>
          <CompareSide
            side={candidate}
            defaultLabel="候选"
            loadState={candidateLoad}
            size={candidateSize}
            dimensionFallbackText={dimensionFallbackText}
            reachLabel={candidate.url != null ? { ok: validation.reachable } : undefined}
            testidPrefix="candidate"
            onLoad={(s) => { setCandidateSize(s); setCandidateLoad('loaded') }}
            onError={() => setCandidateLoad('error')}
          />
        </div>
      )}

      <div style={ACTIONS_STYLE}>
        {dimHint && <span style={HINT_STYLE} data-compare-hint>{dimHint}</span>}
        <button type="button" onClick={onCancel} style={CANCEL_BTN_STYLE} data-compare-cancel>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          aria-disabled={!canConfirm}
          style={canConfirm ? CONFIRM_BTN_STYLE : CONFIRM_BTN_DISABLED_STYLE}
          data-compare-confirm
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
