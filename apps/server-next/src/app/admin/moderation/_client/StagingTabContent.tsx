'use client'

import React, { useState, useEffect, useCallback } from 'react'
import type { StagingApiRow } from '@/lib/moderation/api'
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
  fontSize: 12,
}

const BTN_SM_PRIMARY: React.CSSProperties = {
  ...BTN_SM, background: 'var(--accent-default)', color: 'var(--fg-on-accent)', borderColor: 'var(--accent-default)',
}

const BTN_SM_DANGER: React.CSSProperties = {
  ...BTN_SM, color: 'var(--state-error-fg)', borderColor: 'var(--state-error-border)',
}

const BTN_XS_PRIMARY: React.CSSProperties = {
  padding: '3px 8px', border: '1px solid var(--accent-default)', borderRadius: 'var(--radius-sm)',
  background: 'var(--accent-default)', color: 'var(--fg-on-accent)', cursor: 'pointer', fontSize: 11,
}

const CHECK_ITEM: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
  background: 'var(--bg-surface-raised)', borderRadius: 4, marginBottom: 4, fontSize: 12,
}

// ── ReadinessLabel ────────────────────────────────────────────────

function ReadinessKey({ val }: { val: string }): string {
  const map: Record<string, string> = {
    review_status: M.staging.readiness.reviewStatus,
    lines_min: M.staging.readiness.linesMin,
    cover: M.staging.readiness.cover,
    douban: M.staging.readiness.douban,
    signal: M.staging.readiness.signal,
  }
  return map[val] ?? val
}

// ── Main component ────────────────────────────────────────────────

export function StagingTabContent(): React.ReactElement {
  const [videos, setVideos] = useState<StagingApiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.fetchStagingQueue()
      .then(res => setVideos(res.data as StagingApiRow[]))
      .catch(() => setError(M.staging.errors.loadFailed))
      .finally(() => setLoading(false))
  }, [])

  const v = videos[activeIdx] ?? null

  const handlePublish = useCallback(async () => {
    if (!v) return
    setActioning('publish')
    setActionError(null)
    try {
      await api.publishVideo(v.id)
      setVideos(prev => prev.filter(item => item.id !== v.id))
      setActiveIdx(i => Math.max(0, Math.min(i, videos.length - 2)))
    } catch {
      setActionError(M.staging.errors.publishFailed)
    } finally {
      setActioning(null)
    }
  }, [v, videos.length])

  const handleBatchPublish = useCallback(async () => {
    setActioning('batch')
    setActionError(null)
    try {
      const res = await api.batchPublishVideos()
      if (res.published > 0) {
        const res2 = await api.fetchStagingQueue()
        setVideos(res2.data as StagingApiRow[])
        setActiveIdx(0)
      }
    } catch {
      setActionError(M.staging.errors.batchPublishFailed)
    } finally {
      setActioning(null)
    }
  }, [])

  const handleRevert = useCallback(async () => {
    if (!v) return
    setActioning('revert')
    setActionError(null)
    try {
      await api.revertStagingVideo(v.id)
      setVideos(prev => prev.filter(item => item.id !== v.id))
      setActiveIdx(i => Math.max(0, Math.min(i, videos.length - 2)))
    } catch {
      setActionError(M.staging.errors.revertFailed)
    } finally {
      setActioning(null)
    }
  }, [v, videos.length])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fg-muted)', fontSize: 13 }}>{M.staging.loading}</div>
  }

  if (error) {
    return <div style={{ padding: 16, color: 'var(--state-error-fg)', fontSize: 13 }}>{error}</div>
  }

  return (
    <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
      {/* Left list */}
      <div style={{ width: 280, flexShrink: 0, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{M.staging.listHeader(videos.length)}</span>
          <span style={{ flex: 1 }} />
          <button style={BTN_XS_PRIMARY} onClick={handleBatchPublish} disabled={actioning !== null || videos.length === 0} aria-label={M.aria.stagingBatchPublish}>
            {M.staging.publishAll}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {videos.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>{M.staging.empty}</div>
          ) : (
            videos.map((it, i) => (
              <div key={it.id} onClick={() => setActiveIdx(i)} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', background: i === activeIdx ? 'var(--admin-accent-soft)' : 'transparent', borderLeft: `2px solid ${i === activeIdx ? 'var(--accent-default)' : 'transparent'}`, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 62, borderRadius: 4, background: 'var(--bg-surface-raised)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--fg-muted)', overflow: 'hidden' }}>
                  {it.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.coverUrl} alt={it.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : it.type}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: i === activeIdx ? 'var(--accent-default)' : 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{it.type} · {it.year ?? '—'}</div>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--state-success-bg)', color: 'var(--state-success-fg)', display: 'inline-block', marginTop: 4 }}>
                    {M.staging.approved}
                  </span>
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
            <div style={{ padding: '10px 12px', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{M.staging.title}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{v.title}</span>
              <span style={{ flex: 1 }} />
              <button style={{ ...BTN_SM_DANGER, opacity: actioning !== null ? 0.6 : 1 }} onClick={handleRevert} disabled={actioning !== null} aria-label={M.aria.stagingRevert}>
                {M.staging.revert}
              </button>
              <button style={{ ...BTN_SM_PRIMARY, opacity: actioning !== null ? 0.6 : 1 }} onClick={handlePublish} disabled={actioning !== null} aria-label={M.aria.stagingPublishOne}>
                {M.staging.publishOne}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 14 }}>
              {actionError && (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--state-error-bg)', border: '1px solid var(--state-error-border)', borderRadius: 6, fontSize: 12, color: 'var(--state-error-fg)' }}>
                  {actionError}
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{M.staging.readinessChecks}</div>
                {v.readiness.map(c => (
                  <div key={c.key} style={CHECK_ITEM}>
                    <span style={{ color: c.ok ? 'var(--state-success-fg)' : 'var(--state-warning-fg)' }}>{c.ok ? '✓' : '⚠'}</span>
                    <span style={{ flex: 1 }}>{ReadinessKey({ val: c.key })}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: c.ok ? 'var(--state-success-fg)' : 'var(--state-warning-fg)' }}>{c.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 80, height: 120, borderRadius: 6, background: 'var(--bg-surface-raised)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--fg-muted)', overflow: 'hidden' }}>
                  {v.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.coverUrl} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : v.type}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg-default)' }}>{v.title}</h3>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>{v.type} · {v.year ?? '—'} · {v.activeSourceCount} 源</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>meta_score: {v.metaScore} · 豆瓣: {v.doubanStatus}</div>
                  {v.qualityHighest && (
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--state-success-bg)', color: 'var(--state-success-fg)' }}>
                        {v.qualityHighest}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
            {M.staging.empty}
          </div>
        )}
      </div>
    </div>
  )
}
