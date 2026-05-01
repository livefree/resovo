'use client'

import React from 'react'
import type { FormState, VideoType, VideoStatus } from './types'

const VIDEO_TYPE_OPTIONS: ReadonlyArray<{ value: VideoType; label: string }> = [
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
]

const INPUT: React.CSSProperties = {
  width: '100%', padding: '6px 8px',
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--bg-surface)', color: 'var(--fg-default)',
  boxSizing: 'border-box',
}
const TEXTAREA: React.CSSProperties = { ...INPUT, minHeight: '72px', resize: 'vertical' }
const SELECT: React.CSSProperties = { ...INPUT }
const LABEL: React.CSSProperties = { fontSize: '12px', fontWeight: 500, color: 'var(--fg-muted)', marginBottom: '3px' }
const FIELD: React.CSSProperties = { display: 'flex', flexDirection: 'column' }
const ROW: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }
const SKIPPED: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
  background: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)',
}
const ERROR: React.CSSProperties = {
  ...SKIPPED,
  background: 'var(--state-error-bg)', color: 'var(--state-error-fg)',
}

export interface TabBasicInfoProps {
  form: Pick<FormState, 'title' | 'titleEn' | 'type' | 'year' | 'country' | 'description' |
    'genres' | 'episodeCount' | 'status' | 'rating' | 'director' | 'cast' | 'writers' | 'doubanId'>
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  skippedFields: string[]
  submitError: Error | undefined
}

export function TabBasicInfo({ form, set, skippedFields, submitError }: TabBasicInfoProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {skippedFields.length > 0 && (
        <div style={SKIPPED} role="alert">以下字段因锁定未保存：{skippedFields.join('、')}</div>
      )}
      {submitError && (
        <div style={ERROR} role="alert">{submitError.message}</div>
      )}
      <div style={ROW}>
        <div style={FIELD}>
          <label style={LABEL}>标题 *</label>
          <input style={INPUT} value={form.title} maxLength={200} required
            onChange={(e) => set('title', e.target.value)} data-testid="edit-title" />
        </div>
        <div style={FIELD}>
          <label style={LABEL}>英文标题</label>
          <input style={INPUT} value={form.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
        </div>
      </div>
      <div style={ROW}>
        <div style={FIELD}>
          <label style={LABEL}>类型</label>
          <select style={SELECT} value={form.type} onChange={(e) => set('type', e.target.value as VideoType)}>
            {VIDEO_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={FIELD}>
          <label style={LABEL}>年份</label>
          <input style={INPUT} type="number" value={form.year} onChange={(e) => set('year', e.target.value)} />
        </div>
      </div>
      <div style={ROW}>
        <div style={FIELD}>
          <label style={LABEL}>地区</label>
          <input style={INPUT} value={form.country} maxLength={10} onChange={(e) => set('country', e.target.value)} />
        </div>
        <div style={FIELD}>
          <label style={LABEL}>集数</label>
          <input style={INPUT} type="number" value={form.episodeCount} onChange={(e) => set('episodeCount', e.target.value)} />
        </div>
      </div>
      <div style={FIELD}>
        <label style={LABEL}>简介</label>
        <textarea style={TEXTAREA} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div style={FIELD}>
        <label style={LABEL}>题材（逗号分隔）</label>
        <input style={INPUT} value={form.genres} onChange={(e) => set('genres', e.target.value)} />
      </div>
      <div style={ROW}>
        <div style={FIELD}>
          <label style={LABEL}>连载状态</label>
          <select style={SELECT} value={form.status} onChange={(e) => set('status', e.target.value as VideoStatus | '')}>
            <option value="">—</option>
            <option value="ongoing">连载中</option>
            <option value="completed">已完结</option>
          </select>
        </div>
        <div style={FIELD}>
          <label style={LABEL}>评分</label>
          <input style={INPUT} type="number" step="0.1" min="0" max="10" value={form.rating}
            onChange={(e) => set('rating', e.target.value)} />
        </div>
      </div>
      <div style={FIELD}>
        <label style={LABEL}>导演（逗号分隔）</label>
        <input style={INPUT} value={form.director} onChange={(e) => set('director', e.target.value)} />
      </div>
      <div style={FIELD}>
        <label style={LABEL}>演员（逗号分隔）</label>
        <input style={INPUT} value={form.cast} onChange={(e) => set('cast', e.target.value)} />
      </div>
      <div style={FIELD}>
        <label style={LABEL}>编剧（逗号分隔）</label>
        <input style={INPUT} value={form.writers} onChange={(e) => set('writers', e.target.value)} />
      </div>
      <div style={FIELD}>
        <label style={LABEL}>豆瓣 ID</label>
        <input style={INPUT} value={form.doubanId} onChange={(e) => set('doubanId', e.target.value)} />
      </div>
    </div>
  )
}
