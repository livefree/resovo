'use client'

import React from 'react'
import { DualSignal, Thumb } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'

interface ModListRowProps {
  readonly it: VideoQueueRow
  readonly active: boolean
  readonly onClick: () => void
  /** CHG-SN-8-GAPS-MOD-BATCH：批量模式开关；on 时显 checkbox 替代单击直跳 */
  readonly selectionMode?: boolean
  /** 选中状态（仅 selectionMode=true 时消费） */
  readonly selected?: boolean
  /** checkbox toggle 回调（selectionMode=true 时必填） */
  readonly onToggleSelect?: () => void
}

const ROW_BASE: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: 'var(--list-row-padding-y) var(--list-row-padding-x)',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer',
}

const THUMB_FALLBACK_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

export function ModListRow({
  it,
  active,
  onClick,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: ModListRowProps): React.ReactElement {
  const handleRowClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect()
    } else {
      onClick()
    }
  }
  return (
    <div
      role="option"
      aria-selected={selectionMode ? selected : active}
      onClick={handleRowClick}
      style={{
        ...ROW_BASE,
        background: selectionMode
          ? (selected ? 'var(--state-success-bg, var(--state-ok-soft))' : 'transparent')
          : (active ? 'var(--admin-accent-soft)' : 'transparent'),
        borderLeft: `2px solid ${selectionMode ? (selected ? 'var(--state-success-fg)' : 'transparent') : (active ? 'var(--accent-default)' : 'transparent')}`,
      }}
      data-mod-list-row
      data-video-id={it.id}
      data-batch-selected={selectionMode && selected ? '' : undefined}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.()}
          onClick={(e) => e.stopPropagation()}
          style={{ alignSelf: 'center', cursor: 'pointer' }}
          data-testid={`mod-list-checkbox-${it.id}`}
          aria-label={`选择 ${it.title}`}
        />
      )}
      <Thumb
        src={it.coverUrl}
        size="poster-sm"
        decorative={false}
        alt={it.title}
        fallback={<span style={THUMB_FALLBACK_STYLE}>{it.type}</span>}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--font-size-sm-tight)',
            fontWeight: 600,
            color: active ? 'var(--accent-default)' : 'var(--fg-default)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {it.title}
        </div>
        <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)', marginTop: 2 }}>
          {it.type} · {it.year ?? '—'}
        </div>
        <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <DualSignal probe={it.probe} render={it.render} />
          {it.badges.length > 0 && (
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--state-warning-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.badges[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
