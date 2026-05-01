'use client'

import React from 'react'
import type { MockVideo } from './mock-data'

interface DecisionCardProps {
  readonly v: MockVideo
}

const STYLES = {
  ok: {
    background: 'var(--state-success-bg)',
    border: '1px solid var(--state-success-border)',
    color: 'var(--state-success-fg)',
  },
  warn: {
    background: 'var(--state-warning-bg)',
    border: '1px solid var(--state-warning-border)',
    color: 'var(--state-warning-fg)',
  },
  danger: {
    background: 'var(--state-error-bg)',
    border: '1px solid var(--state-error-border)',
    color: 'var(--state-error-fg)',
  },
} as const

const BASE_CARD: React.CSSProperties = {
  borderRadius: 'var(--radius-3)',
  padding: '10px 14px',
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 12,
  fontWeight: 600,
}

export function DecisionCard({ v }: DecisionCardProps): React.ReactElement {
  const isDead = v.probe === 'dead' && v.render === 'dead'
  const isConflict = !isDead && (v.probe !== v.render || v.badges.length > 0)

  if (isDead) {
    return (
      <div style={{ ...BASE_CARD, ...STYLES.danger }} data-decision-card="danger">
        <span style={{ fontSize: 16 }}>✕</span>
        <span>全线路失效——建议拒绝</span>
      </div>
    )
  }

  if (isConflict) {
    return (
      <div style={{ ...BASE_CARD, ...STYLES.warn }} data-decision-card="warn">
        <span style={{ fontSize: 16 }}>⚠</span>
        <span>信号冲突或存在待处理问题，建议仔细核查后决策</span>
      </div>
    )
  }

  return (
    <div style={{ ...BASE_CARD, ...STYLES.ok }} data-decision-card="ok">
      <span style={{ fontSize: 16 }}>✓</span>
      <span>信号健康，可通过</span>
    </div>
  )
}
