'use client'

import React, { useState } from 'react'

interface Line {
  id: string
  name: string
  alias: string
  host: string
  probe: 'ok' | 'partial' | 'dead'
  render: 'ok' | 'partial' | 'dead'
  enabled: boolean
  episodes: number
}

const MOCK_LINES: readonly Line[] = [
  { id: 'l1', name: '线路 1', alias: '高清线', host: 'lzcaiji.com', probe: 'ok', render: 'ok', enabled: true, episodes: 8 },
  { id: 'l2', name: '线路 2', alias: '', host: 'yzzy.cdn', probe: 'dead', render: 'ok', enabled: true, episodes: 5 },
  { id: 'l3', name: '线路 3', alias: '备用', host: 'hhzy', probe: 'dead', render: 'dead', enabled: false, episodes: 3 },
  { id: 'l4', name: '线路 4', alias: '', host: '360zy', probe: 'ok', render: 'ok', enabled: true, episodes: 8 },
]

const SIGNAL_COLOR: Record<'ok' | 'partial' | 'dead', string> = {
  ok: 'var(--state-success-fg)',
  partial: 'var(--state-warning-fg)',
  dead: 'var(--state-error-fg)',
}
const SIGNAL_LABEL: Record<'ok' | 'partial' | 'dead', string> = {
  ok: '可达', partial: '部分', dead: '失效',
}

const PILL: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px',
  fontSize: '11px', fontWeight: 500, borderRadius: 'var(--radius-full)',
  background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)',
}
const DOT: React.CSSProperties = { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 }

export function TabLines(): React.ReactElement {
  const [lines, setLines] = useState<Line[]>([...MOCK_LINES])
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const toggle = (id: string) =>
    setLines((ls) => ls.map((l) => l.id === id ? { ...l, enabled: !l.enabled } : l))

  const onDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setLines((prev) => {
      const next = [...prev]
      const [item] = next.splice(dragIdx, 1)
      next.splice(idx, 0, item)
      return next
    })
    setDragIdx(idx)
  }
  const onDragEnd = () => setDragIdx(null)
  const enabled = lines.filter((l) => l.enabled).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>线路列表</span>
        <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{enabled}/{lines.length} 启用</span>
      </div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '24px 1fr 80px 72px 60px 48px',
          padding: '6px 12px', background: 'var(--bg-inset)',
          fontSize: '10px', fontWeight: 600, color: 'var(--fg-muted)',
          letterSpacing: '.5px', textTransform: 'uppercase',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span/>
          <span>线路</span>
          <span>探测</span>
          <span>播放</span>
          <span>集数</span>
          <span>操作</span>
        </div>
        {lines.map((line, idx) => (
          <div
            key={line.id}
            draggable
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDragEnd={onDragEnd}
            style={{
              display: 'grid', gridTemplateColumns: '24px 1fr 80px 72px 60px 48px',
              padding: '8px 12px', alignItems: 'center',
              borderBottom: idx < lines.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              opacity: line.enabled ? 1 : 0.45,
              background: dragIdx === idx ? 'var(--accent-muted)' : 'transparent',
              transition: 'background .1s',
            }}
          >
            <span style={{ cursor: 'grab', color: 'var(--fg-muted)', fontSize: '13px', userSelect: 'none' }}>⠿</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{line.name}{line.alias ? ` · ${line.alias}` : ''}</div>
              <div style={{ fontSize: '10px', color: 'var(--fg-muted)', fontFamily: 'monospace' }}>{line.host}</div>
            </div>
            <span style={PILL}>
              <span style={{ ...DOT, background: SIGNAL_COLOR[line.probe] }} />
              {SIGNAL_LABEL[line.probe]}
            </span>
            <span style={PILL}>
              <span style={{ ...DOT, background: SIGNAL_COLOR[line.render] }} />
              {SIGNAL_LABEL[line.render]}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{line.episodes} 集</span>
            <button
              type="button"
              style={{
                padding: '2px 8px', fontSize: '11px', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)',
                cursor: 'pointer',
              }}
              onClick={() => toggle(line.id)}
              title={line.enabled ? '隐藏' : '显示'}
            >
              {line.enabled ? '隐' : '显'}
            </button>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '8px' }}>
        拖拽 ⠿ 调整播放优先级，排前的线路默认优先播放。
      </p>
    </div>
  )
}
