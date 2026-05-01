'use client'

/**
 * modal.tsx — Modal 通用业务原语（居中遮罩弹窗）
 * 真源：ADR-103 §4.6（CHG-SN-2-16）
 *
 * z-index：var(--z-modal) = 1000（业务 L1）< Shell 抽屉 1100（ADR-103a §4.3）
 * size: 'sm'=400px / 'md'=560px / 'lg'=800px
 */
import React, { useState, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from './use-overlay'
import { OverlayBackdrop } from './overlay-backdrop'

export interface ModalProps {
  readonly open: boolean
  readonly size?: 'sm' | 'md' | 'lg'
  readonly onClose: () => void
  readonly title?: React.ReactNode
  readonly closeOnEscape?: boolean
  readonly closeOnBackdropClick?: boolean
  readonly children: React.ReactNode
  readonly 'data-testid'?: string
}

const SIZE_MAP = { sm: 400, md: 560, lg: 800 } as const

const MODAL_LAYOUT_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
}

function modalStyle(size: 'sm' | 'md' | 'lg'): React.CSSProperties {
  return {
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-xl)',
    width: '100%',
    maxWidth: SIZE_MAP[size],
    maxHeight: 'calc(100vh - 80px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const CLOSE_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: '18px',
}

const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '20px',
}

export function Modal({
  open,
  size = 'md',
  onClose,
  title,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  children,
  'data-testid': testId,
}: ModalProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const titleId = useId()

  const { containerRef, backdropProps } = useOverlay({ open, onClose, closeOnEscape, closeOnBackdropClick })

  if (!open || !mounted) return null

  return createPortal(
    <OverlayBackdrop
      role="presentation"
      zIndex={'var(--z-modal)' as React.CSSProperties['zIndex']}
      ariaHidden={false}
      data-modal-backdrop
      onClick={backdropProps.onClick}
      style={MODAL_LAYOUT_STYLE}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={modalStyle(size)}
        data-testid={testId}
        data-modal
        data-size={size}
      >
        {title && (
          <div style={HEADER_STYLE}>
            <span id={titleId} style={TITLE_STYLE}>{title}</span>
            <button
              type="button"
              style={CLOSE_BTN_STYLE}
              onClick={onClose}
              aria-label="关闭"
              data-close-btn
            >
              ×
            </button>
          </div>
        )}
        <div style={BODY_STYLE}>{children}</div>
      </div>
    </OverlayBackdrop>,
    document.body,
  )
}
