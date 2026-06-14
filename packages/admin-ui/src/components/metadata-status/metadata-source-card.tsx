'use client'

/**
 * metadata-source-card.tsx — 面板内单来源卡 MetadataSourceCard（ADR-201 / META-33-B）
 *
 * 真源：metadata-status.types.ts（arch-reviewer §5 契约）。MetadataStatusPanel 四来源同级展示，
 * 复用 MetadataProviderIcon + 真源字段（externalId 外链 / matchMethod / confidence / state）。
 * candidate/problem 态附 per-card 动作按钮 → onAction(action, provider)（DEV-33-3 仅 MetadataNextAction）。
 *
 * 固定 data attribute：data-metadata-source-card + data-provider + data-state
 */
import React from 'react'
import type { MetadataNextAction, MetadataProviderState } from '@resovo/types'
import { SOURCE_HREF_BUILDERS, SOURCE_LABEL } from '../enrichment-badge/enrichment-logos'
import { AdminButton } from '../admin-button'
import { MetadataProviderIcon } from './metadata-provider-icon'
import { MATCH_METHOD_LABEL, NEXT_ACTION_LABEL, PROVIDER_STATE_LABEL } from './metadata-status-labels'
import type { MetadataSourceCardProps } from './metadata-status.types'

const CARD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-surface)',
}

const NAME_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--fg-default)' }
const META_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }
const LINK_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--accent-default)' }

/** 来源卡级动作：candidate→确认候选 / problem→复核冲突；其余无操作。 */
function cardAction(state: MetadataProviderState): MetadataNextAction | null {
  if (state === 'candidate') return 'confirm_candidate'
  if (state === 'problem') return 'review_conflict'
  return null
}

export function MetadataSourceCard({ status, onAction, testId }: MetadataSourceCardProps): React.ReactElement {
  const { provider, state, externalId, label, matchMethod, confidence } = status
  const href = externalId ? SOURCE_HREF_BUILDERS[provider](externalId) : undefined
  const linked = !!href && state !== 'missing' && state !== 'not_applicable'
  const idText = label ?? externalId
  const methodText = matchMethod ? (MATCH_METHOD_LABEL[matchMethod] ?? matchMethod) : null
  const action = cardAction(state)

  const metaParts: string[] = []
  if (methodText) metaParts.push(methodText)
  if (confidence != null) metaParts.push(`置信度 ${Math.round(confidence * 100)}%`)

  return (
    <div data-metadata-source-card data-provider={provider} data-state={state} data-testid={testId} style={CARD_STYLE}>
      <MetadataProviderIcon provider={provider} state={state} size="md" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
        <span style={NAME_STYLE}>
          {SOURCE_LABEL[provider]} <span style={META_STYLE}>· {PROVIDER_STATE_LABEL[state]}</span>
        </span>
        <span style={META_STYLE}>
          {linked && idText ? (
            <a href={href} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>{idText}</a>
          ) : idText ? (
            idText
          ) : null}
          {metaParts.length > 0 && (idText ? ` · ${metaParts.join(' · ')}` : metaParts.join(' · '))}
        </span>
      </div>
      {action && onAction && (
        <AdminButton
          variant={state === 'problem' ? 'danger' : 'secondary'}
          size="sm"
          onClick={() => onAction(action, provider)}
          data-testid={testId ? `${testId}-action` : undefined}
        >
          {NEXT_ACTION_LABEL[action]}
        </AdminButton>
      )}
    </div>
  )
}
