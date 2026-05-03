'use client'

import React, { useState } from 'react'
import { LoadingState, ErrorState } from '@resovo/admin-ui'
import { VE } from '@/i18n/messages/zh-CN/videos-edit'
import { useDoubanTab } from '@/lib/videos/use-douban'
import type { DoubanSuggestItem } from '@/lib/videos/use-douban'
import type { DoubanStatus, ReviewStatus } from '@resovo/types'

// ── styles ──────────────────────────────────────────────────────────

const CHIP_BASE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '1px 7px',
  fontSize: '11px', borderRadius: 'var(--radius-full)', fontWeight: 500,
}
const STATUS_CHIP: Record<DoubanStatus, React.CSSProperties> = {
  pending:   { ...CHIP_BASE, background: 'var(--bg-surface)', color: 'var(--fg-muted)', border: '1px solid var(--border-subtle)' },
  candidate: { ...CHIP_BASE, background: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)' },
  matched:   { ...CHIP_BASE, background: 'var(--state-success-bg)', color: 'var(--state-success-fg)' },
  unmatched: { ...CHIP_BASE, background: 'var(--state-error-bg)', color: 'var(--state-error-fg)' },
}
const ACTION_BTN: React.CSSProperties = {
  padding: '6px 12px', fontSize: '12px', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)', cursor: 'pointer',
}
const PRIMARY_BTN: React.CSSProperties = {
  ...ACTION_BTN, background: 'var(--accent-default)', color: 'var(--fg-on-accent)',
  border: '1px solid var(--accent-default)', fontWeight: 500,
}
const INPUT_ROW: React.CSSProperties = {
  flex: 1, padding: '6px 8px', fontSize: '13px',
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)', color: 'var(--fg-default)',
}
const DIFF_BTN: React.CSSProperties = {
  padding: '2px 8px', fontSize: '11px', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)', cursor: 'pointer',
}
const OK_PILL: React.CSSProperties = {
  display: 'inline-flex', padding: '1px 7px', fontSize: '10px',
  borderRadius: 'var(--radius-full)', background: 'var(--state-success-bg)', color: 'var(--state-success-fg)',
}

// ── props ────────────────────────────────────────────────────────────

export interface TabDoubanProps {
  readonly videoId: string
  readonly doubanStatus?: DoubanStatus
  readonly doubanId?: string | null
  readonly reviewStatus?: ReviewStatus
  readonly onRefresh: () => void
}

// ── sub-components ──────────────────────────────────────────────────

function CandidateRow({
  item, confirming, onConfirm,
}: {
  item: DoubanSuggestItem
  confirming: boolean
  onConfirm: (id: string) => void
}): React.ReactElement {
  const m = VE.douban
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
      borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600 }}>{item.title}</div>
        <div style={{ fontSize: '10px', color: 'var(--fg-muted)' }}>{item.year}{item.sub_title ? ` · ${item.sub_title}` : ''}</div>
      </div>
      <span style={{ fontSize: '10px', color: 'var(--fg-muted)', fontFamily: 'monospace' }}>ID {item.id}</span>
      <button type="button" style={ACTION_BTN} disabled={confirming} onClick={() => onConfirm(item.id)}>
        {confirming ? '…' : m.actions.selectCandidate}
      </button>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────

export function TabDouban({
  videoId, doubanStatus, doubanId, reviewStatus, onRefresh,
}: TabDoubanProps): React.ReactElement {
  const m = VE.douban
  const [keyword, setKeyword] = useState(doubanId ?? '')
  const [showSearch, setShowSearch] = useState(false)

  const isPending = reviewStatus === 'pending_review'

  const [state, actions] = useDoubanTab(videoId, doubanStatus, () => { onRefresh(); setShowSearch(false) })

  const handleSearch = async () => {
    if (!keyword.trim()) return
    setShowSearch(true)
    await actions.search(keyword.trim())
  }

  const currentStatus = doubanStatus ?? 'pending'
  const statusLabel = m.statusLabel[currentStatus]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 匹配状态 */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>{m.matchStatus}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={STATUS_CHIP[currentStatus]}>{statusLabel}</span>
          {doubanId && (
            <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>豆瓣 ID <code>{doubanId}</code></span>
          )}
          <span style={{ flex: 1 }} />
          {!isPending && (
            <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{m.notPendingNote}</span>
          )}
        </div>
      </div>

      {/* 候选匹配（状态为 candidate 或已加载）*/}
      {(doubanStatus === 'candidate' || doubanStatus === 'matched') && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>{m.candidateSection}</div>
          {state.candidateLoading && <LoadingState variant="spinner" />}
          {state.candidateError && (
            <ErrorState error={state.candidateError} title={m.errors.loadCandidateFailed} onRetry={actions.loadCandidate} />
          )}
          {state.candidate && (
            <div style={{ background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
                    豆瓣 ID <code>{state.candidate.externalId}</code>
                  </span>
                  {state.candidate.confidence != null && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--state-success-fg)', fontWeight: 600 }}>
                      {m.confidenceLabel(Math.round(state.candidate.confidence * 100))}
                    </span>
                  )}
                </div>
                {isPending && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" style={PRIMARY_BTN} disabled={state.confirming || state.ignoring} onClick={() => void actions.confirm(state.candidate!.externalId)}>
                      {state.confirming ? '…' : m.actions.confirm}
                    </button>
                    <button type="button" style={ACTION_BTN} disabled={state.confirming || state.ignoring} onClick={() => void actions.ignore()}>
                      {state.ignoring ? '…' : m.actions.ignore}
                    </button>
                  </div>
                )}
              </div>
              {/* 字段差异 */}
              {state.candidate.diffs.length > 0 && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 72px', padding: '5px 12px', background: 'var(--bg-surface-raised)', fontSize: '10px', fontWeight: 600, color: 'var(--fg-muted)', letterSpacing: '.5px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span>{m.columns.field}</span><span>{m.columns.local}</span><span>{m.columns.douban}</span><span />
                  </div>
                  {state.candidate.diffs.map((d, i) => (
                    <div key={d.field} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 72px', padding: '7px 12px', alignItems: 'center', fontSize: '12px', borderBottom: i < state.candidate!.diffs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <span style={{ color: 'var(--fg-muted)', fontWeight: 600, fontSize: '11px' }}>{d.label}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>{d.current ?? '—'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--state-info-fg)', paddingRight: '8px' }}>{d.proposed ?? '—'}</span>
                      {d.changed ? <button type="button" style={DIFF_BTN}>{m.useDouban}</button> : <span style={OK_PILL}>{m.synced}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {state.actionError && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--state-error-fg)' }}>{state.actionError}</div>
          )}
        </div>
      )}

      {/* 搜索结果列表 */}
      {showSearch && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>{m.candidateSection}</div>
          {state.searching && <LoadingState variant="spinner" />}
          {state.searchError && (
            <div style={{ fontSize: '12px', color: 'var(--state-error-fg)', marginBottom: '8px' }}>{state.searchError}</div>
          )}
          {!state.searching && state.searchResults.length > 0 && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {state.searchResults.map((item) => (
                <CandidateRow key={item.id} item={item} confirming={state.confirming} onConfirm={(id) => void actions.confirm(id)} />
              ))}
            </div>
          )}
          {!state.searching && state.searchResults.length === 0 && !state.searchError && (
            <p style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>无搜索结果。</p>
          )}
        </div>
      )}

      {/* 手动搜索 */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>
          {m.searchSection}
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            style={INPUT_ROW}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={m.doubanIdPlaceholder}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
          />
          <button type="button" style={ACTION_BTN} disabled={state.searching || !keyword.trim()} onClick={() => void handleSearch()}>
            {state.searching ? '…' : m.actions.search}
          </button>
          {showSearch && (
            <button type="button" style={ACTION_BTN} onClick={() => { setShowSearch(false); actions.clearSearchResults() }}>
              {m.actions.cancelSearch}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
