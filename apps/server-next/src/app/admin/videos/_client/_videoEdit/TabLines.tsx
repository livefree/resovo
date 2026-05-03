'use client'

import React from 'react'
import { LoadingState, ErrorState, BarSignal, DualSignal, LineHealthDrawer } from '@resovo/admin-ui'
import { VE } from '@/i18n/messages/zh-CN/videos-edit'
import { useVideoSources, toDisplayState } from '@/lib/videos/use-sources'
import type { VideoSource } from '@/lib/videos/use-sources'

function getApiCode(e: unknown): string | null {
  if (e !== null && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') {
    return (e as { code: string }).code
  }
  return null
}

// ── styles ──────────────────────────────────────────────────────────

const TABLE_WRAP: React.CSSProperties = {
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
}
const TABLE_HEAD: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '24px 1fr 80px 72px 60px 48px',
  padding: '6px 12px', background: 'var(--bg-inset)',
  fontSize: '10px', fontWeight: 600, color: 'var(--fg-muted)',
  letterSpacing: '.5px', textTransform: 'uppercase',
  borderBottom: '1px solid var(--border-subtle)',
}
const BTN_XS: React.CSSProperties = {
  padding: '2px 8px', fontSize: '11px', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)',
  cursor: 'pointer',
}
const BTN_DANGER: React.CSSProperties = {
  ...BTN_XS, borderColor: 'var(--state-error-border)', color: 'var(--state-error-fg)',
}

// ── props ────────────────────────────────────────────────────────────

export interface TabLinesProps {
  readonly videoId: string
}

// ── sub-component ──────────────────────────────────────────────────

function SourceRow({
  source, idx, total, pending, onToggle, onHealth,
}: {
  source: VideoSource
  idx: number
  total: number
  pending: boolean
  onToggle: (id: string, active: boolean) => void
  onHealth: (id: string) => void
}): React.ReactElement {
  const m = VE.lines
  const probeState = toDisplayState(source.probe_status)
  const renderState = toDisplayState(source.render_status)
  const siteName = source.source_site_key ?? source.site_key ?? source.source_name
  const qualityTag = source.quality_detected ? ` ${m.qualityDetected(source.quality_detected)}` : ''
  const latencyTag = source.latency_ms != null ? ` ${m.latencyMs(source.latency_ms)}` : ''

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '24px 1fr 80px 72px 60px 48px',
        padding: '8px 12px', alignItems: 'center',
        borderBottom: idx < total - 1 ? '1px solid var(--border-subtle)' : 'none',
        opacity: source.is_active ? 1 : 0.45, transition: 'opacity .1s',
      }}
    >
      <span style={{ color: 'var(--fg-muted)', fontSize: '13px', userSelect: 'none' }}>⠿</span>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {siteName}{qualityTag}{latencyTag}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--fg-muted)', fontFamily: 'monospace' }}>
          {source.source_url.slice(0, 40)}{source.source_url.length > 40 ? '…' : ''}
        </div>
      </div>
      <DualSignal probe={probeState} render="unknown" />
      <DualSignal probe="unknown" render={renderState} />
      <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{m.episodes(source.episode_number)}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          type="button" style={BTN_XS} disabled={pending}
          onClick={() => onToggle(source.id, !source.is_active)}
          title={source.is_active ? m.toggle.disable : m.toggle.enable}
          aria-label={source.is_active ? m.toggle.disable : m.toggle.enable}
        >
          {source.is_active ? m.toggle.disable : m.toggle.enable}
        </button>
        <button
          type="button" style={BTN_XS}
          onClick={() => onHealth(source.id)}
          aria-label={m.actions.viewHealth}
        >
          {m.actions.viewHealth}
        </button>
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────

export function TabLines({ videoId }: TabLinesProps): React.ReactElement {
  const [state, actions] = useVideoSources(videoId)
  const m = VE.lines

  const handleToggle = async (sourceId: string, isActive: boolean) => {
    try {
      await actions.toggle(sourceId, isActive)
    } catch (e: unknown) {
      const code = getApiCode(e)
      const msg = code === 'REVIEW_RACE' ? m.errors.reviewRace
        : code === 'STATE_INVALID' ? m.errors.stateInvalid
        : m.errors.toggleFailed
      alert(msg)
    }
  }

  const handleDisableDead = async () => {
    try { await actions.disableDead() } catch { alert(m.errors.disableDeadFailed) }
  }

  const handleRefetch = async () => {
    try { await actions.refetch() } catch { alert(m.errors.refetchFailed) }
  }

  const healthSource = state.health
  const healthSrc = state.healthSourceId
    ? state.sources.find((s) => s.id === state.healthSourceId)
    : null
  const healthTitle = healthSrc
    ? m.healthDrawer.title(healthSrc.source_site_key ?? healthSrc.site_key ?? healthSrc.source_name, m.episodes(healthSrc.episode_number))
    : ''

  if (state.loading && state.sources.length === 0) return <LoadingState variant="spinner" />
  if (state.error && state.sources.length === 0) return (
    <ErrorState error={state.error} title={m.errors.loadFailed} onRetry={actions.reload} />
  )

  const enabled = state.sources.filter((s) => s.is_active).length
  const okProbe = state.sources.filter((s) => s.probe_status === 'ok').length
  const okRender = state.sources.filter((s) => s.render_status === 'ok').length
  const total = state.sources.length
  const aggProbe = total === 0 ? 'unknown' : okProbe === total ? 'ok' : okProbe === 0 ? 'dead' : 'partial'
  const aggRender = total === 0 ? 'unknown' : okRender === total ? 'ok' : okRender === 0 ? 'dead' : 'partial'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <BarSignal
          probeState={aggProbe}
          renderState={aggRender}
          size="sm"
          ariaLabel={m.barSignalAriaLabel(aggProbe, aggRender)}
        />
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.title}</span>
        <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{m.enabledCount(enabled, total)}</span>
        <span style={{ flex: 1 }} />
        <button type="button" style={BTN_XS} disabled={state.refetchPending} onClick={handleRefetch}>
          {state.refetchPending ? '…' : m.actions.refetch}
        </button>
        <button type="button" style={BTN_DANGER} disabled={state.bulkPending} onClick={handleDisableDead}>
          {state.bulkPending ? '…' : m.actions.disableDead}
        </button>
      </div>

      {state.sources.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>暂无线路数据。</p>
      ) : (
        <div style={TABLE_WRAP}>
          <div style={TABLE_HEAD} aria-hidden="true">
            <span /><span>{m.colLine}</span><span>{m.colProbe}</span>
            <span>{m.colRender}</span><span>{m.colEpisodes}</span><span>{m.colAction}</span>
          </div>
          {state.sources.map((src, idx) => (
            <SourceRow
              key={src.id}
              source={src}
              idx={idx}
              total={state.sources.length}
              pending={state.togglePending.has(src.id)}
              onToggle={handleToggle}
              onHealth={actions.openHealth}
            />
          ))}
        </div>
      )}

      <p style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '8px' }}>{m.hints.dragHint}</p>

      <LineHealthDrawer
        open={state.healthSourceId !== null}
        onClose={actions.closeHealth}
        title={healthTitle}
        probeState={healthSrc ? toDisplayState(healthSrc.probe_status) : 'unknown'}
        renderState={healthSrc ? toDisplayState(healthSrc.render_status) : 'unknown'}
        events={healthSource?.data ?? []}
        loading={state.healthLoading}
        emptyText={m.healthDrawer.empty}
        loadingText={m.healthDrawer.loading}
        pagination={healthSource ? {
          page: state.healthPage,
          total: healthSource.pagination.total,
          limit: healthSource.pagination.limit,
          onPageChange: actions.loadHealthPage,
        } : undefined}
        testId="data-line-health-drawer"
      />
    </div>
  )
}
