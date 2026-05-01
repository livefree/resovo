'use client'
/* eslint-disable no-console */

import React, { useState } from 'react'
import { DualSignal } from '@resovo/admin-ui'
import { MOCK_STAGING_VIDEOS } from './mock-data'

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 12,
}

const BTN_SM_PRIMARY: React.CSSProperties = {
  ...BTN_SM,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  borderColor: 'var(--accent-default)',
}

const BTN_SM_DANGER: React.CSSProperties = {
  ...BTN_SM,
  color: 'var(--state-error-fg)',
  borderColor: 'var(--state-error-border)',
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

const BTN_XS_PRIMARY: React.CSSProperties = {
  ...BTN_XS,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  borderColor: 'var(--accent-default)',
}

const CHECK_ITEM: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  background: 'var(--bg-surface-raised)',
  borderRadius: 4,
  marginBottom: 4,
  fontSize: 12,
}

export function StagingTabContent(): React.ReactElement {
  const [activeIdx, setActiveIdx] = useState(0)
  const v = MOCK_STAGING_VIDEOS[activeIdx] ?? MOCK_STAGING_VIDEOS[0]!

  const checks = [
    { label: '审核状态', value: '已通过', ok: true },
    { label: '有效线路 ≥ 2', value: `${v.lines} 条`, ok: v.lines >= 2 },
    { label: '封面 P0', value: v.badges.includes('封面失效') ? '失效' : '可达', ok: !v.badges.includes('封面失效') },
    { label: '豆瓣匹配', value: v.badges.some(b => b.includes('豆')) ? '未匹配' : '已匹配', ok: !v.badges.some(b => b.includes('豆')) },
    { label: '探测/播放信号', value: v.probe === 'ok' ? '全部正常' : '存在异常', ok: v.probe === 'ok' },
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
          <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{MOCK_STAGING_VIDEOS.length} 条待发布</span>
          <span style={{ flex: 1 }} />
          <button style={BTN_XS_PRIMARY} onClick={() => console.log('publish all')}>↑ 全部发布</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {MOCK_STAGING_VIDEOS.map((it, i) => (
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
                }}
              >
                封{it.thumb}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: i === activeIdx ? 'var(--accent-default)' : 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{it.type} · {it.year} · {it.sources} 源</div>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--state-success-bg)', color: 'var(--state-success-fg)', display: 'inline-block', marginTop: 4 }}>
                  已通过审核
                </span>
              </div>
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
          <span style={{ fontSize: 12, fontWeight: 600 }}>发布预检</span>
          <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{v.title}</span>
          <span style={{ flex: 1 }} />
          <button style={BTN_SM_DANGER} onClick={() => console.log('回退审核', v.id)}>✕ 退回审核</button>
          <button style={BTN_SM_PRIMARY} onClick={() => console.log('发布', v.id)}>↑ 发布上架</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 14 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>发布就绪检查</div>
            {checks.map(c => (
              <div key={c.label} style={CHECK_ITEM}>
                <span style={{ color: c.ok ? 'var(--state-success-fg)' : 'var(--state-warning-fg)' }}>
                  {c.ok ? '✓' : '⚠'}
                </span>
                <span style={{ flex: 1 }}>{c.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: c.ok ? 'var(--state-success-fg)' : 'var(--state-warning-fg)' }}>
                  {c.value}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
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
              }}
            >
              封{v.thumb}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg-default)' }}>{v.title}</h3>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>{v.type} · {v.year} · {v.country} · {v.episodes} 集 · ⭐ {v.score}</div>
              <div style={{ marginTop: 6 }}>
                <DualSignal probe={v.probe} render={v.render} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-surface-raised)', borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>发布设置</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: '可见性', opts: ['公开', '仅内部', '隐藏'] },
                { label: '发布时间', opts: ['立即', '定时'] },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-muted)', width: 60 }}>{row.label}</span>
                  <div style={{ display: 'flex', gap: 1 }}>
                    {row.opts.map((opt, i) => (
                      <span
                        key={opt}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          background: i === 0 ? 'var(--accent-default)' : 'var(--bg-surface-elevated)',
                          color: i === 0 ? 'var(--fg-on-accent)' : 'var(--fg-muted)',
                          border: '1px solid var(--border-default)',
                          borderRadius: i === 0 ? '4px 0 0 4px' : row.opts.length - 1 === i ? '0 4px 4px 0' : 0,
                        }}
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
