'use client'

import React from 'react'
import { DualSignal } from '@resovo/admin-ui'
import type { MockVideo } from './mock-data'

interface ModListRowProps {
  readonly it: MockVideo
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
  background: 'var(--bg3)',
}

export function ModListRow({ it, active, onClick }: ModListRowProps): React.ReactElement {
  return (
    <div
      role="option"
      aria-selected={active}
      onClick={onClick}
      style={{
        ...ROW_BASE,
        background: active ? 'var(--accent-soft)' : 'transparent',
        borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
      }}
      data-mod-list-row
      data-video-id={it.id}
    >
      <div
        style={{
          ...THUMB_STYLE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: 'var(--fg-muted)',
        }}
      >
        封{it.thumb}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: active ? 'var(--accent)' : 'var(--fg-default)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {it.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
          {it.type} · {it.year} · {it.sources} 源
        </div>
        <div style={{ marginTop: 4 }}>
          <DualSignal probe={it.probe} render={it.render} />
        </div>
      </div>
    </div>
  )
}
