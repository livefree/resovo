'use client'

import React from 'react'
import { DualSignal } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'

interface ModListRowProps {
  readonly it: VideoQueueRow
  readonly active: boolean
  readonly onClick: () => void
}

const ROW_BASE: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '10px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer',
}

const THUMB_STYLE: React.CSSProperties = {
  width: 44,
  height: 62,
  borderRadius: 4,
  objectFit: 'cover',
  flexShrink: 0,
  background: 'var(--bg-surface-raised)',
}

export function ModListRow({ it, active, onClick }: ModListRowProps): React.ReactElement {
  return (
    <div
      role="option"
      aria-selected={active}
      onClick={onClick}
      style={{
        ...ROW_BASE,
        background: active ? 'var(--admin-accent-soft)' : 'transparent',
        borderLeft: `2px solid ${active ? 'var(--accent-default)' : 'transparent'}`,
      }}
      data-mod-list-row
      data-video-id={it.id}
    >
      {it.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={it.coverUrl} alt={it.title} style={THUMB_STYLE} />
      ) : (
        <div style={{ ...THUMB_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--fg-muted)' }}>
          {it.type}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: active ? 'var(--accent-default)' : 'var(--fg-default)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {it.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
          {it.type} · {it.year ?? '—'}
        </div>
        <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <DualSignal probe={it.probe} render={it.render} />
          {it.badges.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--state-warning-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.badges[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
