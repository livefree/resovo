'use client'

/**
 * lines-panel.tsx — LinesPanel 共享复合组件实装（FIX-B Stage B）
 *
 * 真源：lines-panel.types.ts（arch-reviewer Opus PASS 契约）
 *
 * 消费方：
 *   1. 审核台 PendingCenter → compact + selectedKey/onLineSelect（FIX-D AdminPlayer 桥接）
 *   2. VideoEditDrawer TabLines → regular + 无选中态
 *
 * WAI-ARIA：section[aria-label] > header > div[role=table] > LineRow[role=rowgroup] > EpisodeRow[role=row]
 * 颜色：仅消费 packages/design-tokens CSS 变量，零硬编码
 */
import React, { useState } from 'react'
import type { LinesPanelProps, LineAggregate, EpisodeMini, LinesPanelDensity } from './lines-panel.types'
import { DualSignal } from '../../cell/dual-signal'
import { SignalChip } from '../../cell/signal-chip'

// ── 密度间距 ─────────────────────────────────────────────────────────────────

function linePad(d: LinesPanelDensity): string {
  if (d === 'compact') return '4px 8px'
  if (d === 'comfortable') return '10px 12px'
  return '6px 10px'
}

function episodePad(d: LinesPanelDensity): string {
  if (d === 'compact') return '3px 8px 3px 28px'
  if (d === 'comfortable') return '8px 12px 8px 36px'
  return '5px 10px 5px 32px'
}

// ── 共享按钮样式 ─────────────────────────────────────────────────────────────

const GHOST_BTN: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  padding: '1px 6px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const ICON_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-secondary)',
  padding: '0 2px',
  flexShrink: 0,
  lineHeight: 1,
}

function toggleBtnStyle(active: boolean, spinning: boolean): React.CSSProperties {
  return {
    ...GHOST_BTN,
    background: active ? 'var(--state-success-bg)' : 'var(--bg-surface-raised)',
    color: active ? 'var(--state-success-fg)' : 'var(--fg-muted)',
    cursor: spinning ? 'wait' : 'pointer',
    opacity: spinning ? 0.6 : 1,
  }
}

// ── EpisodeRow ───────────────────────────────────────────────────────────────

interface EpisodeRowProps {
  readonly ep: EpisodeMini
  readonly lineKey: string
  readonly density: LinesPanelDensity
  readonly toggling?: ReadonlySet<string>
  readonly probingEpisodeIds?: ReadonlySet<string>
  readonly renderCheckingEpisodeIds?: ReadonlySet<string>
  readonly onToggle: LinesPanelProps['onToggleEpisode']
  readonly onHealthOpen: LinesPanelProps['onHealthOpen']
  readonly onProbeEpisode?: LinesPanelProps['onProbeEpisode']
  readonly onRenderCheckEpisode?: LinesPanelProps['onRenderCheckEpisode']
}

function EpisodeRow({
  ep, lineKey, density,
  toggling, probingEpisodeIds, renderCheckingEpisodeIds,
  onToggle, onHealthOpen, onProbeEpisode, onRenderCheckEpisode,
}: EpisodeRowProps) {
  const spinning = toggling?.has(ep.id) ?? false
  // I2 防 race：probe/render-check 按钮在 toggle 进行时也 disabled（防 toggle+probe 并发污染 audit / video_sources 状态）
  const probing = probingEpisodeIds?.has(ep.id) ?? false
  const rendering = renderCheckingEpisodeIds?.has(ep.id) ?? false
  return (
    <div
      role="row"
      data-episode-row
      data-episode-id={ep.id}
      data-active={ep.isActive}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: episodePad(density),
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface-row)',
      }}
    >
      <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)', minWidth: 32, flexShrink: 0 }}>
        {ep.episodeNumber != null ? `EP${ep.episodeNumber}` : '—'}
      </span>
      <SignalChip state={ep.probe} variant="probe" />
      <SignalChip state={ep.render} variant="render" />
      {ep.latencyMs != null && (
        <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)', flexShrink: 0 }}>
          {ep.latencyMs}ms
        </span>
      )}
      <span style={{ flex: 1 }} />
      <button
        type="button"
        aria-pressed={ep.isActive}
        aria-label={`${ep.isActive ? '停用' : '启用'}第 ${ep.episodeNumber ?? '?'} 集`}
        disabled={spinning}
        onClick={() => onToggle({ lineKey, episodeId: ep.id, nextActive: !ep.isActive, updatedAt: ep.updatedAt })}
        style={toggleBtnStyle(ep.isActive, spinning)}
      >
        {spinning ? '…' : ep.isActive ? '启用' : '停用'}
      </button>
      <button
        type="button"
        aria-label={`第 ${ep.episodeNumber ?? '?'} 集健康报告`}
        onClick={() => onHealthOpen({ lineKey, episodeId: ep.id })}
        style={GHOST_BTN}
      >
        健康
      </button>
      {onProbeEpisode && (
        <button
          type="button"
          aria-label={`探测第 ${ep.episodeNumber ?? '?'} 集线路状态`}
          disabled={probing || spinning}
          onClick={() => void onProbeEpisode({ lineKey, episodeId: ep.id })}
          style={GHOST_BTN}
        >
          {probing ? '探测…' : '探测'}
        </button>
      )}
      {onRenderCheckEpisode && (
        <button
          type="button"
          aria-label={`试播第 ${ep.episodeNumber ?? '?'} 集渲染检测`}
          disabled={rendering || spinning}
          onClick={() => void onRenderCheckEpisode({ lineKey, episodeId: ep.id })}
          style={GHOST_BTN}
        >
          {rendering ? '试播…' : '试播'}
        </button>
      )}
    </div>
  )
}

// ── LineRow ──────────────────────────────────────────────────────────────────

interface LineRowProps {
  readonly line: LineAggregate
  readonly density: LinesPanelDensity
  readonly isExpanded: boolean
  readonly isSelected: boolean
  readonly selectable: boolean
  readonly toggling?: ReadonlySet<string>
  readonly probingEpisodeIds?: ReadonlySet<string>
  readonly renderCheckingEpisodeIds?: ReadonlySet<string>
  readonly onToggle: LinesPanelProps['onToggleEpisode']
  readonly onToggleLine?: LinesPanelProps['onToggleLine']
  readonly onHealthOpen: LinesPanelProps['onHealthOpen']
  readonly onProbeEpisode?: LinesPanelProps['onProbeEpisode']
  readonly onRenderCheckEpisode?: LinesPanelProps['onRenderCheckEpisode']
  readonly onSelect?: (line: LineAggregate) => void
  readonly onExpand: (key: string) => void
}

function LineRow({
  line, density, isExpanded, isSelected, selectable,
  toggling, probingEpisodeIds, renderCheckingEpisodeIds,
  onToggle, onToggleLine, onHealthOpen, onProbeEpisode, onRenderCheckEpisode,
  onSelect, onExpand,
}: LineRowProps) {
  const selectedBg: React.CSSProperties = isSelected
    ? { background: 'var(--admin-accent-soft)', outline: '1.5px solid var(--admin-accent-on-soft)', outlineOffset: '-1px' }
    : {}

  return (
    <div role="rowgroup" data-line-row data-line-key={line.key} data-selected={isSelected || undefined}>
      <div
        role="row"
        tabIndex={selectable ? 0 : undefined}
        aria-selected={selectable ? isSelected : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: linePad(density),
          background: 'var(--bg-surface)',
          cursor: selectable ? 'pointer' : 'default',
          userSelect: 'none',
          ...selectedBg,
        }}
        onClick={selectable && onSelect ? () => onSelect(line) : undefined}
        onKeyDown={selectable && onSelect
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(line) } }
          : undefined
        }
      >
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? '折叠' : '展开'} ${line.lineName}`}
          onClick={e => { e.stopPropagation(); onExpand(line.key) }}
          style={ICON_BTN}
        >
          {isExpanded ? '▾' : '▸'}
        </button>

        <DualSignal probe={line.probeAggregate} render={line.renderAggregate} />

        <span style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {line.lineName}
          </span>
          {line.hostname && (
            <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
              {line.hostname}
            </span>
          )}
        </span>

        <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {line.activeCount}/{line.totalEpisodes}集
        </span>
        {line.latencyMedianMs != null && (
          <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            ≈{line.latencyMedianMs}ms
          </span>
        )}
        {line.qualityHighest && (
          <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)', flexShrink: 0 }}>
            {line.qualityHighest}
          </span>
        )}
        {onToggleLine && (
          <button
            type="button"
            aria-label={`${line.activeCount > 0 ? '停用' : '启用'}整条线路 ${line.lineName}`}
            onClick={e => { e.stopPropagation(); void onToggleLine({ lineKey: line.key, nextActive: line.activeCount === 0 }) }}
            style={GHOST_BTN}
          >
            {line.activeCount > 0 ? '停用线路' : '启用线路'}
          </button>
        )}
      </div>

      {isExpanded && (
        <div data-episodes aria-label={`${line.lineName} 集列表`}>
          {line.episodes.map(ep => (
            <EpisodeRow
              key={ep.id}
              ep={ep}
              lineKey={line.key}
              density={density}
              toggling={toggling}
              probingEpisodeIds={probingEpisodeIds}
              renderCheckingEpisodeIds={renderCheckingEpisodeIds}
              onToggle={onToggle}
              onHealthOpen={onHealthOpen}
              onProbeEpisode={onProbeEpisode}
              onRenderCheckEpisode={onRenderCheckEpisode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── LinesPanel ───────────────────────────────────────────────────────────────

export function LinesPanel({
  lines,
  density = 'regular',
  onToggleEpisode,
  onToggleLine,
  onDisableDead,
  onRefetch,
  onHealthOpen,
  onProbeEpisode,
  onRenderCheckEpisode,
  selectedKey,
  onLineSelect,
  toggling,
  probingEpisodeIds,
  renderCheckingEpisodeIds,
  loading,
  error,
  onErrorRetry,
  actionError,
  emptyText = '暂无线路数据',
  testId,
  'aria-label': ariaLabel = '视频线路列表',
}: LinesPanelProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectable = selectedKey !== undefined && onLineSelect !== undefined

  function handleSelect(line: LineAggregate) {
    if (!onLineSelect) return
    const firstActiveUrl = line.episodes.find(e => e.isActive)?.sourceUrl ?? null
    onLineSelect({ lineKey: line.key, line, firstActiveUrl })
  }

  return (
    <section
      data-lines-panel
      data-testid={testId}
      aria-label={ariaLabel}
      style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', flex: 1 }}>视频线路</span>
        <button type="button" onClick={() => void onDisableDead()} style={GHOST_BTN} aria-label="清除失效线路">
          清除失效
        </button>
        <button type="button" onClick={() => void onRefetch()} style={GHOST_BTN} aria-label="刷新线路数据">
          刷新
        </button>
      </div>

      {actionError && (
        <div role="alert" style={{ padding: '5px 10px', background: 'var(--state-error-bg)', color: 'var(--state-error-fg)', fontSize: 'var(--font-size-xs)', flexShrink: 0 }}>
          {actionError}
        </div>
      )}

      {loading && (
        <div aria-live="polite" aria-busy style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm)' }}>
          加载中…
        </div>
      )}
      {!loading && error && (
        <div role="alert" style={{ padding: '12px 10px', color: 'var(--state-error-fg)', fontSize: 'var(--font-size-sm)' }}>
          {error}
          {onErrorRetry && (
            <button type="button" onClick={() => void onErrorRetry()} style={{ ...GHOST_BTN, marginLeft: 8 }}>
              重试
            </button>
          )}
        </div>
      )}
      {!loading && !error && lines.length === 0 && (
        <div style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm)' }}>
          {emptyText}
        </div>
      )}

      {!loading && !error && lines.length > 0 && (
        <div role="table" aria-label={ariaLabel} style={{ overflowY: 'auto' }}>
          {lines.map(line => (
            <LineRow
              key={line.key}
              line={line}
              density={density}
              isExpanded={expanded.has(line.key)}
              isSelected={selectable ? selectedKey === line.key : false}
              selectable={selectable}
              toggling={toggling}
              probingEpisodeIds={probingEpisodeIds}
              renderCheckingEpisodeIds={renderCheckingEpisodeIds}
              onToggle={onToggleEpisode}
              onToggleLine={onToggleLine}
              onHealthOpen={onHealthOpen}
              onProbeEpisode={onProbeEpisode}
              onRenderCheckEpisode={onRenderCheckEpisode}
              onSelect={selectable ? handleSelect : undefined}
              onExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </section>
  )
}
