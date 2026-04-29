/**
 * empty-state.tsx — EmptyState 空状态原语
 * 真源：ADR-103 §4.9（CHG-SN-2-18）
 */
import React from 'react'

export interface EmptyStateProps {
  readonly title?: React.ReactNode
  readonly description?: React.ReactNode
  readonly illustration?: React.ReactNode
  readonly action?: { readonly label: React.ReactNode; readonly onClick: () => void }
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

const ILLUSTRATION_STYLE: React.CSSProperties = {
  fontSize: '40px',
  lineHeight: 1,
  color: 'var(--fg-subtle)',
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  margin: 0,
}

const DESC_STYLE: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--fg-muted)',
  margin: 0,
  maxWidth: '320px',
}

const ACTION_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 16px',
  fontSize: '13px',
  fontWeight: 500,
  background: 'var(--accent-primary)',
  color: 'var(--fg-on-accent)',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  marginTop: '4px',
}

export function EmptyState({ title, description, illustration, action, className }: EmptyStateProps): React.ReactElement {
  return (
    <div style={WRAP_STYLE} className={className} data-empty-state>
      {illustration && (
        <div style={ILLUSTRATION_STYLE} aria-hidden="true" data-empty-illustration>
          {illustration}
        </div>
      )}
      {title && <p style={TITLE_STYLE} data-empty-title>{title}</p>}
      {description && <p style={DESC_STYLE} data-empty-description>{description}</p>}
      {action && (
        <button type="button" style={ACTION_STYLE} onClick={action.onClick} data-empty-action>
          {action.label}
        </button>
      )}
    </div>
  )
}
