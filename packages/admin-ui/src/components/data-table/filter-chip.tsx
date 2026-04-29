'use client'

/**
 * filter-chip.tsx — FilterChip + FilterChipBar
 * 真源：ADR-103 §4.4 FilterChip / FilterChipBar（CHG-SN-2-14）
 *
 * 职责：单个筛选条件的 Chip（`{label}: {value}` + ✕ 清除）；
 * FilterChipBar 容器水平排列多 chip；不内置 filter form / popover。
 */
import React from 'react'

export interface FilterChipProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onClear: () => void
}

export interface FilterChipBarProps {
  readonly items: readonly FilterChipProps[]
  readonly onClearAll?: () => void
}

const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--accent-subtle)',
  color: 'var(--fg-default)',
  fontSize: '12px',
  lineHeight: '20px',
  border: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
}

const CLEAR_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  padding: 0,
  border: 0,
  borderRadius: '50%',
  background: 'transparent',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: '11px',
  lineHeight: 1,
}

const BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '6px',
}

const CLEAR_ALL_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  border: 0,
  borderRadius: 'var(--radius-full)',
  background: 'transparent',
  color: 'var(--fg-muted)',
  fontSize: '12px',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
}

export function FilterChip({ id, label, value, onClear }: FilterChipProps): React.ReactElement {
  return (
    <span
      key={id}
      data-filter-chip
      data-filter-id={id}
      style={CHIP_STYLE}
      role="group"
      aria-label={`筛选条件 ${label}: ${value}`}
    >
      <span style={{ color: 'var(--fg-muted)' }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
      <button
        type="button"
        data-filter-chip-clear
        style={CLEAR_BTN_STYLE}
        onClick={onClear}
        aria-label={`清除筛选 ${label}`}
      >
        ×
      </button>
    </span>
  )
}

export function FilterChipBar({ items, onClearAll }: FilterChipBarProps): React.ReactElement | null {
  if (items.length === 0) return null
  return (
    <div data-filter-chip-bar style={BAR_STYLE} role="group" aria-label="已激活筛选条件">
      {items.map((item) => (
        <FilterChip key={item.id} {...item} />
      ))}
      {onClearAll && (
        <button
          type="button"
          data-filter-chip-clear-all
          style={CLEAR_ALL_BTN_STYLE}
          onClick={onClearAll}
          aria-label="清除全部筛选条件"
        >
          清除全部
        </button>
      )}
    </div>
  )
}
