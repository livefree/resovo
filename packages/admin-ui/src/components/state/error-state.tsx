/**
 * error-state.tsx — ErrorState 错误状态原语
 * 真源：ADR-103 §4.9（CHG-SN-2-18）
 */
import React from 'react'

export interface ErrorStateProps {
  readonly error: Error
  readonly title?: React.ReactNode
  readonly onRetry?: () => void
  readonly className?: string
}

const WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  gap: '12px',
  textAlign: 'center',
}

const ICON_STYLE: React.CSSProperties = {
  fontSize: '36px',
  lineHeight: 1,
  color: 'var(--state-error)',
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  margin: 0,
}

const MESSAGE_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--fg-muted)',
  margin: 0,
  maxWidth: '360px',
  wordBreak: 'break-word',
}

const RETRY_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 14px',
  fontSize: '13px',
  fontWeight: 500,
  background: 'transparent',
  color: 'var(--accent-primary)',
  border: '1px solid var(--accent-primary)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  marginTop: '4px',
}

export function ErrorState({ error, title, onRetry, className }: ErrorStateProps): React.ReactElement {
  return (
    <div style={WRAP_STYLE} className={className} data-error-state>
      <div style={ICON_STYLE} aria-hidden="true">⚠</div>
      <p style={TITLE_STYLE} data-error-title>{title ?? '加载失败'}</p>
      <p style={MESSAGE_STYLE} data-error-message>{error.message}</p>
      {onRetry && (
        <button type="button" style={RETRY_STYLE} onClick={onRetry} data-retry-btn>
          重试
        </button>
      )}
    </div>
  )
}
