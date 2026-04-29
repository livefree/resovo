/**
 * loading-state.tsx — LoadingState 加载中原语
 * 真源：ADR-103 §4.9（CHG-SN-2-18）
 *
 * variant='spinner'：居中转圈（CSS 动画）
 * variant='skeleton'：骨架行（DataTable body 内消费）
 */
import React from 'react'

export interface LoadingStateProps {
  readonly variant?: 'spinner' | 'skeleton'
  readonly skeletonRows?: number
  readonly label?: React.ReactNode
  readonly className?: string
}

const SPINNER_WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  gap: '12px',
}

const SPINNER_STYLE: React.CSSProperties = {
  width: '28px',
  height: '28px',
  border: '3px solid var(--border-subtle)',
  borderTopColor: 'var(--accent-primary)',
  borderRadius: '50%',
  animation: 'admin-ui-spin 0.7s linear infinite',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--fg-muted)',
}

const SKELETON_WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '12px 16px',
}

function skeletonRowStyle(widthPct: number): React.CSSProperties {
  return {
    height: '14px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-surface-hover)',
    width: `${widthPct}%`,
    animation: 'admin-ui-pulse 1.5s ease-in-out infinite',
  }
}

const WIDTHS = [85, 70, 90, 60, 75]

export function LoadingState({ variant = 'spinner', skeletonRows = 5, label, className }: LoadingStateProps): React.ReactElement {
  if (variant === 'skeleton') {
    return (
      <div style={SKELETON_WRAP_STYLE} className={className} data-loading-state data-variant="skeleton" aria-busy="true">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <div
            key={i}
            style={skeletonRowStyle(WIDTHS[i % WIDTHS.length] ?? 80)}
            data-skeleton-row
          />
        ))}
      </div>
    )
  }

  return (
    <div style={SPINNER_WRAP_STYLE} className={className} data-loading-state data-variant="spinner" aria-busy="true">
      <div style={SPINNER_STYLE} data-spinner />
      {label && <span style={LABEL_STYLE}>{label}</span>}
    </div>
  )
}
