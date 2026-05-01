'use client'

import React from 'react'

interface DoubanField {
  field: string
  local: string
  douban: string
  synced: boolean
}

const MOCK_FIELDS: readonly DoubanField[] = [
  { field: '标题', local: '本地标题', douban: '豆瓣标题', synced: true },
  { field: '年份', local: '2023', douban: '2023', synced: true },
  { field: '评分', local: '7.5', douban: '7.6', synced: false },
  { field: '简介', local: '本地简介…', douban: '豆瓣简介…', synced: false },
  { field: '演员', local: '演员 A', douban: '演员 A, 演员 B', synced: false },
  { field: '导演', local: '导演 A', douban: '导演 A', synced: true },
]

const OK_PILL: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 7px',
  fontSize: '10px', borderRadius: 'var(--radius-full)',
  background: 'var(--state-success-bg)', color: 'var(--state-success-fg)',
}
const DIFF_BTN: React.CSSProperties = {
  padding: '2px 8px', fontSize: '11px', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)',
  cursor: 'pointer',
}
const INPUT: React.CSSProperties = {
  flex: 1, padding: '6px 8px', border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)', fontSize: '13px', background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
}
const ACTION_BTN: React.CSSProperties = {
  padding: '6px 12px', fontSize: '12px', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)',
  cursor: 'pointer',
}
const PRIMARY_BTN: React.CSSProperties = {
  ...ACTION_BTN, background: 'var(--accent-default)', color: 'var(--fg-on-accent)',
  border: '1px solid var(--accent-default)', fontWeight: 500,
}

export function TabDouban(): React.ReactElement {
  return (
    <div>
      {/* 匹配状态 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>豆瓣匹配</div>
        <div style={{
          display: 'flex', gap: '12px', padding: '12px', alignItems: 'center',
          background: 'var(--bg-inset)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            width: '48px', height: '72px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)', flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>视频标题</div>
            <div style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '2px' }}>
              豆瓣 ID <code>26277285</code> · 置信度{' '}
              <span style={{ color: 'var(--state-success-fg)', fontWeight: 600 }}>92%</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button type="button" style={PRIMARY_BTN}>确认匹配</button>
            <button type="button" style={ACTION_BTN}>重新搜索</button>
          </div>
        </div>
      </div>

      {/* 字段差异对比 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>豆瓣导入字段</span>
          <button type="button" style={ACTION_BTN}>全部拉取覆盖</button>
        </div>
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '72px 1fr 1fr 72px',
            padding: '6px 12px', background: 'var(--bg-inset)',
            fontSize: '10px', fontWeight: 600, color: 'var(--fg-muted)',
            letterSpacing: '.5px', textTransform: 'uppercase',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span>字段</span><span>本地</span><span>豆瓣</span><span/>
          </div>
          {MOCK_FIELDS.map((r, i) => (
            <div key={r.field} style={{
              display: 'grid', gridTemplateColumns: '72px 1fr 1fr 72px',
              padding: '8px 12px', alignItems: 'center', fontSize: '12px',
              borderBottom: i < MOCK_FIELDS.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <span style={{ color: 'var(--fg-muted)', fontWeight: 600, fontSize: '11px' }}>{r.field}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>{r.local}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--state-info-fg)', paddingRight: '8px' }}>{r.douban}</span>
              {r.synced
                ? <span style={OK_PILL}>一致</span>
                : <button type="button" style={DIFF_BTN}>用豆瓣</button>
              }
            </div>
          ))}
        </div>
      </div>

      {/* 手动指定 */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>
          手动指定豆瓣 ID
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input style={INPUT} placeholder="输入豆瓣 ID（如 26277285）" />
          <button type="button" style={ACTION_BTN}>查找</button>
        </div>
      </div>
    </div>
  )
}
