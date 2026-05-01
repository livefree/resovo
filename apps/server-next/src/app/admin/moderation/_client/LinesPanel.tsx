'use client'
/* eslint-disable no-console */

import React, { useState } from 'react'
import { DualSignal } from '@resovo/admin-ui'
import type { MockLine } from './mock-data'
import { MOCK_LINES } from './mock-data'

const BTN_XS: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 11,
}

const BTN_XS_DANGER: React.CSSProperties = {
  ...BTN_XS,
  borderColor: 'var(--state-error-border)',
  color: 'var(--state-error-fg)',
}

const LINE_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 4,
  background: 'var(--bg-surface-raised)',
  fontSize: 11,
}

function LineRow({ line, onToggle }: { line: MockLine; onToggle: (id: string) => void }): React.ReactElement {
  return (
    <div style={LINE_ROW} data-line-row={line.id}>
      <span
        role="switch"
        aria-checked={line.enabled}
        onClick={() => onToggle(line.id)}
        style={{
          width: 28,
          height: 16,
          borderRadius: 999,
          background: line.enabled ? 'var(--accent-default)' : 'var(--bg-surface-sunken)',
          border: '1px solid var(--border-default)',
          cursor: 'pointer',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2,
          left: line.enabled ? 14 : 2,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'var(--fg-on-accent)',
          transition: 'left .1s',
        }} />
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg-muted)' }}>
        {line.site}
      </span>
      <DualSignal probe={line.probe} render={line.render} />
      {line.latency != null && (
        <span style={{ fontSize: 10, color: 'var(--fg-muted)', flexShrink: 0 }}>{line.latency}ms</span>
      )}
    </div>
  )
}

export function LinesPanel({ videoId: _videoId }: { videoId: string }): React.ReactElement {
  const [lines, setLines] = useState<MockLine[]>([...MOCK_LINES])

  const toggleLine = (id: string) => {
    setLines(ls => ls.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l))
  }

  const enabledCount = lines.filter(l => l.enabled).length

  return (
    <div data-lines-panel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>线路</span>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{enabledCount}/{lines.length} 启用</span>
        <span style={{ flex: 1 }} />
        <button style={BTN_XS} onClick={() => console.log('重测全部')}>↻ 重测全部</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {lines.map(line => (
          <LineRow key={line.id} line={line} onToggle={toggleLine} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button style={BTN_XS} onClick={() => console.log('证据')}>证据</button>
        <span style={{ flex: 1 }} />
        <button style={BTN_XS_DANGER} onClick={() => console.log('删除全失效')}>✕ 删除全失效</button>
      </div>
    </div>
  )
}
