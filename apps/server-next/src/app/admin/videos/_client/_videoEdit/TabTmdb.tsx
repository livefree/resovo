'use client'

/**
 * TabTmdb.tsx — 视频编辑抽屉「TMDB 来源关系」区（ADR-202 §视频编辑 / META-39-B）
 *
 * 对齐 TabDouban 范式：mediaType 切换 + 搜索框 + 候选列表 + fields 多选 + 确认/拒绝。
 * 消费 tmdb-search/confirm/reject 端点（use-tmdb hook）。
 * confirm fields=选中字段（默认全选）；空选 = 仅绑定 ID（D-202-5）。冲突 reason → 友好文案。
 * tv 首版不选 season（落 show candidate，仍绑定+应用字段+cache）；season 精确绑定留 follow-up。
 */

import React, { useState } from 'react'
import { VE } from '@/i18n/messages/zh-CN/videos-edit'
import { useTmdbTab } from '@/lib/videos/use-tmdb'
import type { TmdbCandidate, TmdbMediaType } from '@/lib/videos/use-tmdb'
import type { VideoAdminDetail } from '@/lib/videos'

const TMDB_APPLIABLE_FIELDS = ['title', 'title_original', 'original_language', 'description', 'genres', 'rating', 'cover_url'] as const
type TmdbField = typeof TMDB_APPLIABLE_FIELDS[number]

const SECTION_TITLE: React.CSSProperties = { fontSize: 'var(--font-size-sm-tight)', fontWeight: 600, color: 'var(--fg-default)', marginBottom: '10px' }
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }
const INPUT: React.CSSProperties = { flex: 1, minWidth: '160px', padding: '6px 10px', fontSize: 'var(--font-size-xs)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--fg-default)' }
const BTN: React.CSSProperties = { padding: '6px 12px', fontSize: 'var(--font-size-xs)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-default)', cursor: 'pointer' }
// 覆盖用完整 border shorthand（勿用 borderColor）：BTN 用 border shorthand，叠加 borderColor 会在
// SEG_ON↔BTN 切换时触发「移除 borderColor 但 border 仍在」的 React 警告（verify-style-shorthand-conflict 同源）。
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'var(--accent-default)', color: 'var(--accent-fg)', border: '1px solid var(--accent-default)' }
const SEG_ON: React.CSSProperties = { ...BTN, background: 'var(--accent-subtle)', border: '1px solid var(--accent-default)', color: 'var(--accent-default)' }
const ERROR_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-2xs)', color: 'var(--state-error-fg)', marginTop: '4px' }
const HINT_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)', marginTop: '4px' }

function CandidateRow({ item, busy, onConfirm, onReject }: {
  item: TmdbCandidate
  busy: boolean
  onConfirm: (tmdbId: number) => void
  onReject: (tmdbId: number) => void
}): React.ReactElement {
  const m = VE.tmdb
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{item.title}</div>
        <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>
          {item.originalTitle} · {m.candidateMeta(item.year, item.originalLanguage)}
        </div>
      </div>
      <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)', fontFamily: 'monospace' }}>ID {item.tmdbId}</span>
      <button type="button" style={BTN_PRIMARY} disabled={busy} onClick={() => onConfirm(item.tmdbId)}>{m.actions.confirm}</button>
      <button type="button" style={BTN} disabled={busy} onClick={() => onReject(item.tmdbId)}>{m.actions.reject}</button>
    </div>
  )
}

export interface TabTmdbProps {
  readonly videoId: string
  readonly video: VideoAdminDetail
  readonly onRefresh: () => void
}

export function TabTmdb({ videoId, video, onRefresh }: TabTmdbProps): React.ReactElement {
  const m = VE.tmdb
  const [mediaType, setMediaType] = useState<TmdbMediaType>(video.type === 'movie' ? 'movie' : 'tv')
  const [keyword, setKeyword] = useState('')
  const [year, setYear] = useState('')
  const [selectedFields, setSelectedFields] = useState<Set<TmdbField>>(new Set(TMDB_APPLIABLE_FIELDS))
  const [state, actions] = useTmdbTab(videoId, onRefresh)

  const handleSearch = async () => {
    const yr = Number(year.trim())
    await actions.search(keyword.trim(), mediaType, year.trim() && Number.isFinite(yr) ? yr : undefined)
  }
  const toggleField = (f: TmdbField) => setSelectedFields((prev) => {
    const next = new Set(prev)
    if (next.has(f)) next.delete(f); else next.add(f)
    return next
  })

  const errors = m.errors as Record<string, string>
  const errorText = state.actionError ? errors[state.actionError] ?? state.actionError : null
  const hasResults = state.searchResults.length > 0

  return (
    <div data-testid="data-video-tab-tmdb">
      <div style={SECTION_TITLE}>{m.sectionTitle}</div>

      {/* mediaType 切换 + 搜索 */}
      <div style={ROW}>
        <button type="button" style={mediaType === 'movie' ? SEG_ON : BTN} onClick={() => setMediaType('movie')} data-testid="tmdb-mediatype-movie">{m.mediaType.movie}</button>
        <button type="button" style={mediaType === 'tv' ? SEG_ON : BTN} onClick={() => setMediaType('tv')} data-testid="tmdb-mediatype-tv">{m.mediaType.tv}</button>
        <input style={INPUT} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={m.searchPlaceholder} data-testid="tmdb-search-input" />
        <input style={{ ...INPUT, flex: '0 0 90px', minWidth: '90px' }} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} placeholder={m.yearPlaceholder} inputMode="numeric" data-testid="tmdb-year-input" />
        <button type="button" style={BTN_PRIMARY} disabled={state.searching} onClick={handleSearch} data-testid="tmdb-search-btn">
          {state.searching ? '…' : hasResults ? m.actions.reSearch : m.actions.search}
        </button>
      </div>
      {state.searchError && <div style={ERROR_STYLE}>{state.searchError}</div>}

      {/* fields 多选 + 覆盖提示 */}
      {hasResults && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)', marginBottom: '6px' }}>{m.fieldsLabel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
            {TMDB_APPLIABLE_FIELDS.map((f) => (
              <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-2xs)', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedFields.has(f)} onChange={() => toggleField(f)} data-testid={`tmdb-field-${f}`} />
                {m.fieldLabels[f]}
              </label>
            ))}
          </div>
          <div style={HINT_STYLE}>{m.overwriteHint}</div>
        </div>
      )}

      {/* 候选列表 */}
      {hasResults && (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }} data-testid="tmdb-candidates">
          {state.searchResults.map((item) => (
            <CandidateRow
              key={item.tmdbId}
              item={item}
              busy={state.confirming || state.rejecting}
              onConfirm={(tmdbId) => void actions.confirm(tmdbId, mediaType, [...selectedFields])}
              onReject={(tmdbId) => void actions.reject(tmdbId)}
            />
          ))}
        </div>
      )}

      {errorText && <div style={ERROR_STYLE} data-testid="tmdb-action-error">{errorText}</div>}
    </div>
  )
}
