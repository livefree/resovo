'use client'
/* eslint-disable no-console */

import React, { useState } from 'react'
import { DualSignal } from '@resovo/admin-ui'
import { MOCK_REJECTED_VIDEOS } from './mock-data'

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 12,
}

const BTN_SM_DANGER: React.CSSProperties = {
  ...BTN_SM,
  color: 'var(--state-error-fg)',
  borderColor: 'var(--state-error-border)',
}

function historyBg(c: string): string {
  switch (c) {
    case 'ok': return 'var(--state-success-fg)'
    case 'warn': return 'var(--state-warning-fg)'
    case 'danger': return 'var(--state-error-fg)'
    default: return 'var(--state-info-fg)'
  }
}

const BTN_XS: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 11,
}

export function RejectedTabContent(): React.ReactElement {
  const [activeIdx, setActiveIdx] = useState(0)
  const v = MOCK_REJECTED_VIDEOS[activeIdx] ?? MOCK_REJECTED_VIDEOS[0]!

  const history = [
    { t: v.rejectedAt, who: v.rejectedBy, e: '拒绝', detail: v.rejectReason, c: 'danger' },
    { t: '1 天前', who: '系统', e: '采集入库', detail: '自动入库', c: 'info' },
    { t: '2 天前', who: '系统', e: '全站采集', detail: '来源站点匹配', c: 'info' },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
      {/* Left list */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            flexShrink: 0,
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{MOCK_REJECTED_VIDEOS.length} 条已拒绝</span>
          <span style={{ flex: 1 }} />
          <button style={{ ...BTN_XS, color: 'var(--state-error-fg)' }} onClick={() => console.log('批量删除')}>✕ 批量删除</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {MOCK_REJECTED_VIDEOS.map((it, i) => (
            <div
              key={it.id}
              onClick={() => setActiveIdx(i)}
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                background: i === activeIdx ? 'var(--admin-accent-soft)' : 'transparent',
                borderLeft: `2px solid ${i === activeIdx ? 'var(--accent-default)' : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 62,
                  borderRadius: 4,
                  background: 'var(--bg-surface-raised)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: 'var(--fg-muted)',
                  opacity: 0.6,
                }}
              >
                封{it.thumb}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: i === activeIdx ? 'var(--accent-default)' : 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{it.type} · {it.year}</div>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--state-error-bg)', color: 'var(--state-error-fg)', display: 'inline-block', marginTop: 4 }}>
                  已拒绝
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--fg-muted)', flexShrink: 0 }}>{it.rejectedAt}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Center */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            flexShrink: 0,
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--state-error-fg)' }}>已拒绝</span>
          <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{v.title}</span>
          <span style={{ flex: 1 }} />
          <button style={BTN_SM} onClick={() => console.log('重新审核', v.id)}>↻ 重新审核</button>
          <button style={BTN_SM_DANGER} onClick={() => console.log('永久删除', v.id)}>✕ 永久删除</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 14 }}>
          {/* Rejection banner */}
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--state-error-bg)',
              border: '1px solid var(--state-error-border)',
              borderRadius: 6,
              marginBottom: 14,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ color: 'var(--state-error-fg)', fontSize: 18, marginTop: 2 }}>✕</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--state-error-fg)' }}>拒绝原因</div>
              <div style={{ color: 'var(--fg-muted)', marginTop: 4, fontSize: 12 }}>{v.rejectReason}</div>
              <div style={{ color: 'var(--fg-subtle)', marginTop: 4, fontSize: 11 }}>操作人：{v.rejectedBy} · {v.rejectedAt}</div>
            </div>
          </div>

          {/* Video info */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <div
              style={{
                width: 80,
                height: 120,
                borderRadius: 6,
                background: 'var(--bg-surface-raised)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: 'var(--fg-muted)',
                opacity: 0.7,
              }}
            >
              封{v.thumb}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg-muted)' }}>{v.title}</h3>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>{v.type} · {v.year} · {v.country} · {v.episodes} 集</div>
              <div style={{ marginTop: 6 }}>
                <DualSignal probe={v.probe} render={v.render} />
              </div>
            </div>
          </div>

          {/* History timeline */}
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>操作历史</div>
          <div style={{ position: 'relative', paddingLeft: 18 }}>
            <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 1, background: 'var(--border-default)' }} />
            {history.map((h, i) => (
              <div key={i} style={{ position: 'relative', paddingBottom: 14 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: -17,
                    top: 4,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: historyBg(h.c),
                    border: '2px solid var(--bg-surface-elevated)',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{h.e}</span>
                  <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>· {h.who}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{h.t}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{h.detail}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-surface-raised)', borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>可执行操作</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <button style={BTN_SM} onClick={() => console.log('重新审核')}>↻ 重新审核</button>
              <button style={BTN_SM} onClick={() => console.log('补源后重审')}>⚡ 补源后重审</button>
              <button style={BTN_SM_DANGER} onClick={() => console.log('永久删除')}>✕ 永久删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
