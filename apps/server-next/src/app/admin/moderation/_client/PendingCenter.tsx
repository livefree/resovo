'use client'
/* eslint-disable no-console */

import React, { useState } from 'react'
import { VisChip } from '@resovo/admin-ui'
import { DecisionCard } from './DecisionCard'
import { EpisodeSelector } from './EpisodeSelector'
import { LinesPanel } from './LinesPanel'
import type { MockVideo } from './mock-data'

interface PendingCenterProps {
  readonly v: MockVideo
}

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg2)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 12,
}

const SECTION: React.CSSProperties = {
  padding: 12,
  background: 'var(--bg3)',
  borderRadius: 6,
  marginBottom: 14,
}

export function PendingCenter({ v }: PendingCenterProps): React.ReactElement {
  const [currentEp, setCurrentEp] = useState(1)

  return (
    <>
      <DecisionCard v={v} />

      {/* Video player placeholder */}
      <div
        style={{
          background: 'var(--player-full-bg)',
          borderRadius: 6,
          aspectRatio: '16/9',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--player-full-progress-track)',
            border: '1px solid var(--player-full-buffer-fill)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span style={{ color: 'white', fontSize: 18 }}>▶</span>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 10,
            right: 10,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: 'white',
              background: 'var(--player-mini-overlay)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            线路 1 / {v.lines} · EP{currentEp}
          </span>
          <span style={{ flex: 1 }} />
          <span
            style={{
              fontSize: 10,
              color: 'white',
              background: 'var(--player-full-overlay)',
              border: '1px solid var(--player-full-progress-track)',
              padding: '2px 5px',
              borderRadius: 3,
              fontFamily: 'monospace',
            }}
          >
            space
          </span>
        </div>
      </div>

      {/* Video info */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        <div
          style={{
            width: 100,
            height: 150,
            borderRadius: 6,
            background: 'var(--bg3)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'var(--fg-muted)',
          }}
        >
          封{v.thumb}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--fg-default)' }}>{v.title}</h2>
            <span style={{ color: 'var(--fg-muted)', fontSize: 13 }}>{v.year}</span>
            <VisChip visibility={v.visibility} review={v.review} />
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--fg-muted)' }}>
            {v.type} · {v.episodes} 集 · {v.country} · ⭐ {v.score} · ID <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.id}</code>
          </div>
          {v.badges.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {v.badges.map(b => (
                <span
                  key={b}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'var(--state-warning-bg)',
                    color: 'var(--state-warning-fg)',
                    border: '1px solid var(--state-warning-border)',
                  }}
                >
                  {b}
                </span>
              ))}
              {v.staffNote && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'var(--state-info-bg)',
                    color: 'var(--state-info-fg)',
                    border: '1px solid var(--state-info-border)',
                  }}
                >
                  备注: {v.staffNote}
                </span>
              )}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button style={BTN_SM} onClick={() => console.log('edit', v.id)}>✎ 编辑视频</button>
            <button style={BTN_SM} onClick={() => console.log('cover', v.id)}>🖼 修封面</button>
            <button style={BTN_SM} onClick={() => console.log('split', v.id)}>⊕ 拆分</button>
            <button style={BTN_SM} onClick={() => window.open(`/video/${v.id}`, '_blank')}>↗ 前台</button>
          </div>
        </div>
      </div>

      {/* Episode selector */}
      {v.episodes > 1 && (
        <div style={SECTION}>
          <EpisodeSelector total={v.episodes} current={currentEp} onSelect={setCurrentEp} />
        </div>
      )}

      {/* Lines panel */}
      <div style={SECTION}>
        <LinesPanel videoId={v.id} />
      </div>
    </>
  )
}
