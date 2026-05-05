'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Thumb } from '@resovo/admin-ui'
import type { RejectedVideoRow } from '@/lib/moderation/api'
import * as api from '@/lib/moderation/api'
import { M } from '@/i18n/messages/zh-CN/moderation'

// ── Styles ────────────────────────────────────────────────────────

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
}

// ── Main component ────────────────────────────────────────────────

export function RejectedTabContent(): React.ReactElement {
  const [videos, setVideos] = useState<RejectedVideoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reopening, setReopening] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.fetchRejectedVideos()
      .then(res => setVideos(res.data as RejectedVideoRow[]))
      .catch(() => setError(M.rejected.errors.loadFailed))
      .finally(() => setLoading(false))
  }, [])

  const v = videos[activeIdx] ?? null

  const handleReopen = useCallback(async () => {
    if (!v) return
    setReopening(v.id)
    setActionError(null)
    try {
      await api.reopenVideo(v.id)
      setVideos(prev => prev.filter(item => item.id !== v.id))
      setActiveIdx(i => Math.max(0, Math.min(i, videos.length - 2)))
    } catch {
      setActionError(M.rejected.errors.reopenFailed)
    } finally {
      setReopening(null)
    }
  }, [v, videos.length])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>{M.rejected.loading}</div>
  }

  if (error) {
    return <div style={{ padding: 16, color: 'var(--state-error-fg)', fontSize: 'var(--font-size-sm-tight)' }}>{error}</div>
  }

  return (
    <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
      {/* Left list */}
      <div style={{ width: 280, flexShrink: 0, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--toolbar-padding-y) var(--toolbar-padding-x)', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>{M.rejected.listHeader(videos.length)}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {videos.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>{M.rejected.empty}</div>
          ) : (
            videos.map((it, i) => (
              <div key={it.id} onClick={() => setActiveIdx(i)} style={{ display: 'flex', gap: 10, padding: 'var(--list-row-padding-y) var(--list-row-padding-x)', borderBottom: '1px solid var(--border-subtle)', background: i === activeIdx ? 'var(--admin-accent-soft)' : 'transparent', borderLeft: `2px solid ${i === activeIdx ? 'var(--accent-default)' : 'transparent'}`, cursor: 'pointer', opacity: 0.85 }}>
                <Thumb
                  src={it.cover_url}
                  size="poster-sm"
                  decorative={false}
                  alt={it.title}
                  fallback={<span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>{it.type}</span>}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-size-sm-tight)', fontWeight: 600, color: i === activeIdx ? 'var(--accent-default)' : 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                  <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)', marginTop: 2 }}>{it.type} · {it.year ?? '—'}</div>
                  <span style={{ fontSize: 'var(--font-size-2xs)', padding: '1px 6px', borderRadius: 999, background: 'var(--state-error-bg)', color: 'var(--state-error-fg)', display: 'inline-block', marginTop: 4 }}>已拒绝</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center detail */}
      <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {v ? (
          <>
            <div style={{ padding: 'var(--toolbar-padding-y) var(--toolbar-padding-x)', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--state-error-fg)' }}>{M.rejected.title}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>{v.title}</span>
              <span style={{ flex: 1 }} />
              <button
                style={{ ...BTN_SM, opacity: reopening !== null ? 0.6 : 1 }}
                onClick={handleReopen}
                disabled={reopening !== null}
                aria-label={M.aria.rejectedReopen}
              >
                {M.rejected.reopen}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 14 }}>
              {actionError && (
                <div style={{ marginBottom: 12, padding: '8px var(--toolbar-padding-x)', background: 'var(--state-error-bg)', border: '1px solid var(--state-error-border)', borderRadius: 6, fontSize: 'var(--font-size-xs)', color: 'var(--state-error-fg)' }}>
                  {actionError}
                </div>
              )}

              {/* Rejection info */}
              <div style={{ padding: '10px 14px', background: 'var(--state-error-bg)', border: '1px solid var(--state-error-border)', borderRadius: 6, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--state-error-fg)', fontSize: 'var(--font-size-lg)', marginTop: 2 }}>✕</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--state-error-fg)' }}>拒绝标签</div>
                  <div style={{ color: 'var(--fg-muted)', marginTop: 4, fontSize: 'var(--font-size-xs)' }}>
                    {v.review_label_key ?? M.rejected.noLabel}
                  </div>
                  <div style={{ color: 'var(--fg-subtle)', marginTop: 4, fontSize: 'var(--font-size-xxs)' }}>
                    更新时间：{v.updated_at ?? v.created_at}
                  </div>
                </div>
              </div>

              {/* Video info */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                <Thumb
                  src={v.cover_url}
                  size="poster-lg"
                  decorative={false}
                  alt={v.title}
                  fallback={<span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>{v.type}</span>}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--fg-muted)' }}>{v.title}</h3>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginTop: 4 }}>{v.type} · {v.year ?? '—'}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginTop: 4 }}>
                    visibility: {v.visibility_status} · source_check: {v.source_check_status ?? '—'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)', marginTop: 4 }}>
                    ID: <code style={{ fontFamily: 'monospace' }}>{v.id}</code>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ marginTop: 14, padding: 'var(--section-gap)', background: 'var(--bg-surface-raised)', borderRadius: 6 }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 8 }}>可执行操作</div>
                <button style={{ ...BTN_SM, opacity: reopening !== null ? 0.6 : 1 }} onClick={handleReopen} disabled={reopening !== null} aria-label={M.aria.rejectedReopen}>
                  ↻ {M.rejected.reopen}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
            {M.rejected.empty}
          </div>
        )}
      </div>
    </div>
  )
}
