'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { DualSignal, LineHealthDrawer } from '@resovo/admin-ui'
import type { SourceHealthEvent } from '@resovo/types'
import type { ContentSourceRow } from '@/lib/moderation/api'
import * as api from '@/lib/moderation/api'
import { ApiClientError } from '@/lib/api-client'
import { M } from '@/i18n/messages/zh-CN/moderation'

// ── Styles ────────────────────────────────────────────────────────

const BTN_XS: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xxs)',
}

const BTN_XS_DANGER: React.CSSProperties = {
  ...BTN_XS,
  borderColor: 'var(--state-error-border)',
  color: 'var(--state-error-fg)',
}

const LINE_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 4,
  background: 'var(--bg-surface-raised)',
  fontSize: 'var(--font-size-xxs)',
}

// ── Health drawer state ───────────────────────────────────────────

interface HealthDrawerState {
  open: boolean
  sourceId: string | null
  title: string
  probeState: string
  renderState: string
  events: SourceHealthEvent[]
  loading: boolean
  error: string | null
  page: number
  total: number
}

const DRAWER_CLOSED: HealthDrawerState = {
  open: false, sourceId: null, title: '', probeState: 'unknown', renderState: 'unknown',
  events: [], loading: false, error: null, page: 1, total: 0,
}

// ── LineRow sub-component ─────────────────────────────────────────

interface LineRowProps {
  line: ContentSourceRow
  toggling: boolean
  onToggle: (id: string, current: boolean) => void
  onHealth: (line: ContentSourceRow) => void
}

function LineRow({ line, toggling, onToggle, onHealth }: LineRowProps): React.ReactElement {
  const probeState = api.toDisplayState(line.probe_status)
  const renderState = api.toDisplayState(line.render_status)

  return (
    <div style={LINE_ROW} data-line-row={line.id}>
      <button
        role="switch"
        aria-checked={line.is_active}
        aria-label={line.is_active ? M.aria.lineDisable : M.aria.lineEnable}
        disabled={toggling}
        onClick={() => onToggle(line.id, line.is_active)}
        style={{
          width: 28, height: 16, borderRadius: 999,
          background: line.is_active ? 'var(--accent-default)' : 'var(--bg-surface-sunken)',
          border: '1px solid var(--border-default)',
          cursor: toggling ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          position: 'relative',
          padding: 0,
          opacity: toggling ? 0.6 : 1,
        }}
      >
        <span style={{
          position: 'absolute', top: 2,
          left: line.is_active ? 14 : 2,
          width: 10, height: 10,
          borderRadius: '50%',
          background: 'var(--fg-on-accent)',
          transition: 'left .1s',
        }} />
      </button>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg-muted)' }}>
        {line.source_name}
      </span>
      <DualSignal probe={probeState} render={renderState} />
      {line.latency_ms != null && (
        <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)', flexShrink: 0 }}>{line.latency_ms}ms</span>
      )}
      <button style={{ ...BTN_XS, fontSize: 'var(--font-size-2xs)' }} onClick={() => onHealth(line)} aria-label={M.aria.lineEvidence}>证据</button>
    </div>
  )
}

// ── LinesPanel ────────────────────────────────────────────────────

export function LinesPanel({ videoId }: { videoId: string }): React.ReactElement {
  const [lines, setLines] = useState<ContentSourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<HealthDrawerState>(DRAWER_CLOSED)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.fetchVideoSources(videoId)
      .then(setLines)
      .catch(() => setError(M.errors.loadFailed))
      .finally(() => setLoading(false))
  }, [videoId])

  const openHealth = useCallback(async (line: ContentSourceRow) => {
    const title = `${line.source_name} · EP${line.episode_number ?? M.lines.fullEpisode}`
    setDrawer({ open: true, sourceId: line.id, title, probeState: api.toDisplayState(line.probe_status), renderState: api.toDisplayState(line.render_status), events: [], loading: true, error: null, page: 1, total: 0 })
    try {
      const res = await api.fetchLineHealth(videoId, line.id, 1)
      setDrawer(d => ({ ...d, events: res.data as SourceHealthEvent[], loading: false, total: res.pagination.total, page: 1 }))
    } catch {
      setDrawer(d => ({ ...d, loading: false, error: M.lines.loadFailed }))
    }
  }, [videoId])

  const handleHealthPage = useCallback(async (page: number) => {
    if (!drawer.sourceId) return
    setDrawer(d => ({ ...d, loading: true }))
    try {
      const res = await api.fetchLineHealth(videoId, drawer.sourceId, page)
      setDrawer(d => ({ ...d, events: res.data as SourceHealthEvent[], loading: false, page }))
    } catch {
      setDrawer(d => ({ ...d, loading: false, error: M.lines.loadFailed }))
    }
  }, [videoId, drawer.sourceId])

  const handleToggle = useCallback(async (id: string, currentActive: boolean) => {
    const target = lines.find(l => l.id === id)
    if (!target) return
    setTogglingIds(s => new Set(s).add(id))
    setActionError(null)
    try {
      // CHG-SN-5-PRE-01-C：透传 updated_at 启用乐观锁
      const result = await api.toggleSource(videoId, id, !currentActive, target.updated_at)
      // 用 server 返回的最新 updated_at 覆盖本地 token，下一次 toggle 用新版本号
      setLines(prev => prev.map(l => l.id === id ? { ...l, is_active: result.is_active, updated_at: result.updated_at } : l))
    } catch (e: unknown) {
      // 409 REVIEW_RACE：另一个审核员已改过 → 拉新数据 + 用户友好提示
      if (e instanceof ApiClientError && (e.code === 'REVIEW_RACE' || e.status === 409)) {
        setActionError(M.lines.toggleRace)
        // 强制重载，让 UI 显示最新真实状态；重载失败显式回退到 loadFailed 提示，不吞异常
        api.fetchVideoSources(videoId)
          .then(setLines)
          .catch(() => setActionError(M.lines.loadFailed))
      } else {
        setActionError(M.lines.toggleFailed)
      }
    } finally {
      setTogglingIds(s => { const next = new Set(s); next.delete(id); return next })
    }
  }, [videoId, lines])

  const handleDisableDead = useCallback(async () => {
    setActionError(null)
    try {
      const res = await api.disableDeadSources(videoId)
      if (res.disabled > 0) {
        setLines(prev => prev.map(l =>
          (l.probe_status === 'dead' && l.render_status === 'dead') ? { ...l, is_active: false } : l
        ))
      }
    } catch {
      setActionError(M.lines.disableDeadFailed)
    }
  }, [videoId])

  const handleRefetch = useCallback(async () => {
    setActionError(null)
    try {
      await api.refetchSources(videoId)
    } catch {
      setActionError(M.lines.refetchFailed)
    }
  }, [videoId])

  const enabledCount = lines.filter(l => l.is_active).length

  if (loading) {
    return <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', padding: '8px 0' }}>加载线路…</div>
  }

  if (error) {
    return <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--state-error-fg)', padding: '8px 0' }}>{error}</div>
  }

  return (
    <div data-lines-panel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>线路</span>
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>{enabledCount}/{lines.length} 启用</span>
        <span style={{ flex: 1 }} />
        <button style={BTN_XS} onClick={handleRefetch} aria-label={M.aria.lineRefetch}>↻ 重新抓取</button>
      </div>

      {actionError && (
        <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--state-error-fg)', marginBottom: 6, padding: '4px 8px', background: 'var(--state-error-bg)', borderRadius: 4 }}>
          {actionError}
        </div>
      )}

      {lines.length === 0 ? (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', padding: '8px 0' }}>暂无线路</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {lines.map(line => (
            <LineRow
              key={line.id}
              line={line}
              toggling={togglingIds.has(line.id)}
              onToggle={handleToggle}
              onHealth={openHealth}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <span style={{ flex: 1 }} />
        <button style={BTN_XS_DANGER} onClick={handleDisableDead} aria-label={M.aria.lineDisableDead}>禁用全失效</button>
      </div>

      <LineHealthDrawer
        open={drawer.open}
        onClose={() => setDrawer(DRAWER_CLOSED)}
        title={drawer.title}
        probeState={drawer.probeState as Parameters<typeof LineHealthDrawer>[0]['probeState']}
        renderState={drawer.renderState as Parameters<typeof LineHealthDrawer>[0]['renderState']}
        events={drawer.events}
        loading={drawer.loading}
        error={drawer.error ? { message: drawer.error, onRetry: () => drawer.sourceId && void handleHealthPage(drawer.page) } : null}
        pagination={drawer.total > 20 ? { page: drawer.page, total: drawer.total, limit: 20, onPageChange: handleHealthPage } : undefined}
      />
    </div>
  )
}
