'use client'

import React from 'react'

interface ImgSlot {
  key: string
  label: string
  desc: string
  required: boolean
  ratio: string
}

const IMG_SLOTS: readonly ImgSlot[] = [
  { key: 'cover', label: '封面 (P0)', desc: '竖版海报 2:3', required: true, ratio: '2/3' },
  { key: 'banner', label: '横版 Banner', desc: '16:9 推荐位用', required: false, ratio: '16/9' },
  { key: 'bg', label: '背景大图', desc: '模糊背景用', required: false, ratio: '16/9' },
  { key: 'logo', label: '标题 Logo', desc: '片名 PNG 透明底', required: false, ratio: '3/1' },
  { key: 'still1', label: '剧照 1', desc: '可选', required: false, ratio: '16/9' },
  { key: 'still2', label: '剧照 2', desc: '可选', required: false, ratio: '16/9' },
]

const SLOT_BTN: React.CSSProperties = {
  flex: 1, padding: '4px 0', fontSize: '11px', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)',
  cursor: 'pointer',
}
const MISSING_PILL: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 6px',
  fontSize: '10px', borderRadius: 'var(--radius-full)',
  background: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)',
}

function SlotCard({ slot }: { slot: ImgSlot }): React.ReactElement {
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-inset)' }}>
      <div style={{
        aspectRatio: slot.ratio, background: 'var(--bg-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg-subtle)', fontSize: '11px',
      }}>
        暂无图片
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{slot.label}</span>
          {slot.required && <span style={{ fontSize: '9px', color: 'var(--state-error-fg)', fontWeight: 700 }}>必填</span>}
          <span style={{ flex: 1 }} />
          <span style={MISSING_PILL}>缺失</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--fg-muted)', marginBottom: '6px' }}>{slot.desc}</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button type="button" style={SLOT_BTN}>上传</button>
          <button type="button" style={SLOT_BTN}>URL</button>
        </div>
      </div>
    </div>
  )
}

export function TabImages(): React.ReactElement {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>图片素材</span>
        <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>0/6 已上传</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {IMG_SLOTS.map((slot) => <SlotCard key={slot.key} slot={slot} />)}
      </div>
    </div>
  )
}
