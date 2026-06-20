'use client'

/**
 * image-lightbox.tsx — ImageLightbox 共享组件实装（IMGH-P1-3 / SEQ-20260619-01）
 *
 * 包壳 admin-ui useOverlay + OverlayBackdrop（继承 focus trap / Esc / scroll lock / token 遮罩）；
 * 不包壳 Modal（size 约束不匹配全屏看图）。契约与设计依据见 image-lightbox.types.ts 头部。
 *
 * 颜色零硬编码（design-tokens）；破损态用 --state-error-*（--state-danger-bg 不存在，arch-reviewer 纠正）。
 */

import React, { useState, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from '../overlay/use-overlay'
import { OverlayBackdrop } from '../overlay/overlay-backdrop'
import { Pill } from '../cell/pill'
import type { PillVariant } from '../cell/pill.types'
import type {
  ImageLightboxProps,
  ImageStatus,
  ImageNaturalSize,
} from './image-lightbox.types'

// ── status → Pill 映射（arch-reviewer 裁决） ──────────────────────

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
  if (process.env.NODE_ENV !== 'production') console.warn(`[ImageLightbox] ${msg}`)
}

type LoadState = 'loading' | 'loaded' | 'error' | 'empty'

// ── 样式（全 token，零硬编码颜色） ────────────────────────────────

const LAYOUT_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px',
}

const DIALOG_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  maxWidth: 'min(92vw, 1100px)',
  maxHeight: '90vh',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '16px',
  overflow: 'auto',
}

const CLOSE_BTN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  width: '28px',
  height: '28px',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-sunken)',
  color: 'var(--fg-default)',
  fontSize: '18px',
  lineHeight: '1',
  cursor: 'pointer',
}

const IMAGE_AREA_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '180px',
  maxHeight: '60vh',
  background: 'var(--bg-surface-sunken)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
}

const IMG_STYLE: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: '60vh',
  objectFit: 'contain',
}

const FALLBACK_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '40px',
  color: 'var(--state-error-fg)',
}

const FALLBACK_ICON_STYLE: React.CSSProperties = {
  fontSize: '40px',
  opacity: 0.5,
}

const FALLBACK_TEXT_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const META_PANEL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const META_TITLE_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const META_LIST_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '4px 12px',
  margin: 0,
}

const META_DT_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const META_DD_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  display: 'flex',
  alignItems: 'center',
}

const URL_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 8px',
  background: 'var(--bg-surface-sunken)',
  borderRadius: 'var(--radius-sm)',
}

const URL_TEXT_STYLE: React.CSSProperties = {
  flex: 1,
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const COPY_BTN_STYLE: React.CSSProperties = {
  flexShrink: 0,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--accent-default)',
  fontSize: 'var(--font-size-xs)',
  padding: '2px 8px',
  cursor: 'pointer',
}

const SR_ONLY_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
}

// ── 元信息行 ──────────────────────────────────────────────────────

function MetaRow({
  label,
  value,
  testid,
}: {
  readonly label: string
  readonly value: React.ReactNode
  readonly testid: string
}): React.ReactElement {
  return (
    <>
      <dt style={META_DT_STYLE}>{label}</dt>
      <dd style={META_DD_STYLE} data-testid={testid}>{value}</dd>
    </>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function ImageLightbox({
  open,
  onClose,
  src,
  alt,
  title,
  meta,
  metaSlot,
  statusSlot,
  onCopyUrl,
  onNaturalSize,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  dimensionFallbackText = '—',
  testId,
}: ImageLightboxProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [loadState, setLoadState] = useState<LoadState>(src ? 'loading' : 'empty')
  const [naturalSize, setNaturalSize] = useState<ImageNaturalSize | null>(null)
  const [copied, setCopied] = useState(false)

  const titleId = useId()
  const { containerRef, backdropProps } = useOverlay({ open, onClose, closeOnEscape, closeOnBackdropClick })

  // src 变化 / 重新打开 → 重置图片态
  useEffect(() => {
    setLoadState(src ? 'loading' : 'empty')
    setNaturalSize(null)
    setCopied(false)
  }, [src, open])

  // 互斥 / a11y dev warn
  useEffect(() => {
    if (meta && metaSlot) devWarn('meta 与 metaSlot 同传 → metaSlot 优先')
    if (meta?.status && statusSlot) devWarn('meta.status 与 statusSlot 同传 → statusSlot 优先')
    if (src && !alt) devWarn('src 非空但缺 alt（信息性图建议提供 alt）')
  }, [meta, metaSlot, statusSlot, src, alt])

  // 复制成功 2s 后自动清除反馈
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const handleImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      const size: ImageNaturalSize = { width: img.naturalWidth, height: img.naturalHeight }
      setNaturalSize(size)
      setLoadState('loaded')
      onNaturalSize?.(size)
    },
    [onNaturalSize],
  )

  const handleImgError = useCallback(() => setLoadState('error'), [])

  const handleCopy = useCallback(async () => {
    if (!src) return
    if (onCopyUrl) {
      onCopyUrl(src)
      setCopied(true)
      return
    }
    try {
      await navigator.clipboard.writeText(src)
      setCopied(true)
    } catch {
      devWarn('clipboard 不可用（非安全上下文？）复制降级')
    }
  }, [src, onCopyUrl])

  if (!open || !mounted) return null

  const dimText =
    loadState === 'loaded' && naturalSize
      ? `${naturalSize.width} × ${naturalSize.height}`
      : dimensionFallbackText
  const ariaLabel = title || alt || '图片预览'
  const showImg = (loadState === 'loading' || loadState === 'loaded') && !!src

  return createPortal(
    <OverlayBackdrop
      role="presentation"
      zIndex={'var(--z-modal)' as React.CSSProperties['zIndex']}
      backdropTone="dim"
      ariaHidden={false}
      onClick={backdropProps.onClick}
      style={LAYOUT_STYLE}
      data-overlay-backdrop="image-lightbox"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={DIALOG_STYLE}
        data-testid={testId}
        data-image-lightbox
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          style={CLOSE_BTN_STYLE}
          data-close-btn
        >
          ×
        </button>

        {/* 图片区 */}
        <div style={IMAGE_AREA_STYLE}>
          {showImg ? (
            <img
              src={src}
              alt={alt ?? ''}
              onLoad={handleImgLoad}
              onError={handleImgError}
              style={IMG_STYLE}
              data-lightbox-img
            />
          ) : (
            <div role="img" aria-label={alt ?? '图片不可用'} style={FALLBACK_STYLE} data-lightbox-fallback>
              <span style={FALLBACK_ICON_STYLE} aria-hidden>⊘</span>
              <span style={FALLBACK_TEXT_STYLE}>
                {loadState === 'empty' ? '无图片 URL' : '图片加载失败'}
              </span>
            </div>
          )}
        </div>

        {/* 元信息面板 */}
        {metaSlot ?? (
          <div style={META_PANEL_STYLE} data-lightbox-meta>
            {title && <div id={titleId} style={META_TITLE_STYLE}>{title}</div>}
            <dl style={META_LIST_STYLE}>
              <MetaRow label="尺寸" value={dimText} testid="lightbox-meta-dimension" />
              {meta?.source && <MetaRow label="来源" value={meta.source} testid="lightbox-meta-source" />}
              <MetaRow
                label="状态"
                testid="lightbox-meta-status"
                value={
                  statusSlot ??
                  (meta?.status
                    ? <Pill variant={STATUS_TO_PILL[meta.status]}>{STATUS_LABEL[meta.status]}</Pill>
                    : '—')
                }
              />
              {(meta?.brokenDomain || meta?.occurrenceCount != null) && (
                <MetaRow
                  label="破损"
                  testid="lightbox-meta-broken"
                  value={`${meta.brokenDomain ?? '—'}${meta.occurrenceCount != null ? ` · ${meta.occurrenceCount} 次` : ''}`}
                />
              )}
            </dl>
            {src && (
              <div style={URL_ROW_STYLE}>
                <span style={URL_TEXT_STYLE} data-lightbox-url title={src}>{src}</span>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  style={COPY_BTN_STYLE}
                  data-copy-btn
                  aria-label="复制 URL"
                >
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            )}
            <span aria-live="polite" style={SR_ONLY_STYLE}>{copied ? 'URL 已复制' : ''}</span>
          </div>
        )}
      </div>
    </OverlayBackdrop>,
    document.body,
  )
}
