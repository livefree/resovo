/**
 * drawer.tsx — Drawer 通用业务原语
 * 真源：ADR-103 §4.6（CHG-SN-2-16）
 *
 * z-index：var(--z-modal) = 1000（业务 L1）< Shell 抽屉 1100（ADR-103a §4.3）
 * placement: 'left' | 'right' | 'bottom' | 'top'
 * 默认 left/right width=480px；top/bottom height=50vh
 */
import React, { useState, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from './use-overlay'

export interface DrawerProps {
  readonly open: boolean
  readonly placement: 'left' | 'right' | 'bottom' | 'top'
  readonly onClose: () => void
  readonly title?: React.ReactNode
  readonly width?: number | string
  readonly height?: number | string
  readonly closeOnEscape?: boolean
  readonly closeOnBackdropClick?: boolean
  readonly children: React.ReactNode
  readonly 'data-testid'?: string
}

const BACKDROP_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--bg-overlay)',
  zIndex: 'var(--z-modal)' as React.CSSProperties['zIndex'],
  display: 'flex',
}

function drawerStyle(placement: DrawerProps['placement'], width?: number | string, height?: number | string): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'fixed',
    background: 'var(--bg-surface-elevated)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }
  if (placement === 'left') return { ...base, left: 0, top: 0, bottom: 0, width: width ?? 480 }
  if (placement === 'right') return { ...base, right: 0, top: 0, bottom: 0, width: width ?? 480 }
  if (placement === 'top') return { ...base, left: 0, right: 0, top: 0, height: height ?? '50vh' }
  return { ...base, left: 0, right: 0, bottom: 0, height: height ?? '50vh' }
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

export function Drawer({
  open,
  placement,
  onClose,
  title,
  width,
  height,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  children,
  'data-testid': testId,
}: DrawerProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const { containerRef, backdropProps } = useOverlay({ open, onClose, closeOnEscape, closeOnBackdropClick })

  const titleId = useId()

  if (!open || !mounted) return null

  return createPortal(
    <div
      role="presentation"
      style={BACKDROP_STYLE}
      {...backdropProps}
      data-drawer-backdrop
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={drawerStyle(placement, width, height)}
        data-testid={testId}
        data-drawer
        data-placement={placement}
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
    </div>,
    document.body,
  )
}
