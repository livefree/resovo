'use client'

/**
 * picker-result-row.tsx — VideoPicker 列表单行（Thumb + 标题 + 元信息）
 *
 * 真源：M-SN-SHARED-04-A / video-picker.types.ts
 */

import { type CSSProperties, type MouseEvent } from 'react'
import { Thumb } from '../cell/thumb'
import type { PickerVideoItem } from './video-picker.types'

export interface PickerResultRowProps {
  readonly item: PickerVideoItem
  readonly active: boolean
  readonly selected: boolean
  readonly multiple: boolean
  readonly onActivate: () => void
  readonly onToggle: () => void
  readonly 'data-testid'?: string
}

const ROW_BASE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px 1fr auto',
  gap: '10px',
  alignItems: 'center',
  padding: '8px 12px',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
}

const TITLE_BLOCK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
}

const TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const META_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
}

const TYPE_PILL_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 12px)',
  fontSize: '11px',
  background: 'var(--bg-subtle, var(--bg-surface))',
  color: 'var(--fg-default)',
}

function rowStyle(active: boolean, selected: boolean): CSSProperties {
  if (selected) {
    return {
      ...ROW_BASE,
      background: 'var(--state-success-bg, var(--state-ok-soft))',
      border: '1px solid var(--state-success-border, transparent)',
    }
  }
  if (active) {
    return { ...ROW_BASE, background: 'var(--bg-subtle, var(--bg-surface))' }
  }
  return ROW_BASE
}

export function PickerResultRow({
  item,
  active,
  selected,
  multiple,
  onActivate,
  onToggle,
  ...rest
}: PickerResultRowProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onActivate()
    onToggle()
  }
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={handleClick}
      onMouseEnter={onActivate}
      style={rowStyle(active, selected)}
      data-testid={rest['data-testid']}
      data-active={active ? '' : undefined}
      data-selected={selected ? '' : undefined}
    >
      <Thumb src={item.coverUrl} size="poster-sm" alt={item.title} decorative />
      <span style={TITLE_BLOCK}>
        <span style={TITLE_STYLE}>{item.title}</span>
        <span style={META_STYLE}>
          {item.shortId} · {item.year ?? '—'}
        </span>
      </span>
      <span style={TYPE_PILL_STYLE}>{item.type}</span>
      {multiple && selected && (
        <span aria-hidden style={{ fontSize: '12px', color: 'var(--state-success-fg, var(--state-ok))' }}>✓</span>
      )}
    </button>
  )
}
