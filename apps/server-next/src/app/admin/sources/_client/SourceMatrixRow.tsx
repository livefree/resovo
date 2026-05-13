'use client'

import { useState, type CSSProperties } from 'react'
import Image from 'next/image'
import type { VideoGroupRow, LineMatrixRow, SignalStatus } from '@/lib/sources/types'
import { getVideoMatrix } from '@/lib/sources/api'

// ── 信号色映射 ────────────────────────────────────────────────────

const SIGNAL_COLOR: Record<SignalStatus, string> = {
  ok:      'var(--state-success-bg)',
  partial: 'var(--state-warning-bg)',
  dead:    'var(--state-error-bg)',
  pending: 'var(--bg-surface-elevated)',
}

const SIGNAL_BORDER: Record<SignalStatus, string> = {
  ok:      'var(--state-success-border)',
  partial: 'var(--state-warning-border)',
  dead:    'var(--state-error-border)',
  pending: 'var(--border-subtle)',
}

const SIGNAL_LABEL: Record<SignalStatus, string> = {
  ok: '✓', partial: '!', dead: '✕', pending: '…',
}

// ── 样式常量 ─────────────────────────────────────────────────────

const ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px minmax(200px, 1fr) 80px 90px 100px 100px 80px 100px',
  alignItems: 'center',
  gap: '0',
  height: '52px',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer',
  background: 'var(--bg-surface)',
  transition: 'background 0.1s',
}

const CELL_STYLE: CSSProperties = {
  padding: '0 12px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
}

const EXPAND_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px repeat(8, 1fr) 80px',
  gap: '4px',
  alignItems: 'center',
}

// ── 单集色块 ──────────────────────────────────────────────────────

interface EpisodeCellProps {
  probeStatus: SignalStatus
  renderStatus: SignalStatus
  episodeNumber: number
  isActive: boolean
}

function EpisodeCellBlock({ probeStatus, renderStatus, episodeNumber, isActive }: EpisodeCellProps) {
  const combined: SignalStatus = !isActive ? 'dead'
    : probeStatus === 'ok' && renderStatus === 'ok' ? 'ok'
    : probeStatus === 'dead' || renderStatus === 'dead' ? 'dead'
    : probeStatus === 'partial' || renderStatus === 'partial' ? 'partial'
    : 'pending'

  return (
    <div
      title={`E${episodeNumber} 探测:${probeStatus} 播放:${renderStatus}`}
      style={{
        height: '28px',
        borderRadius: '4px',
        background: SIGNAL_COLOR[combined],
        border: `1px solid ${SIGNAL_BORDER[combined]}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        color: 'var(--fg-muted)',
        fontWeight: 600,
      }}
    >
      {SIGNAL_LABEL[combined]}
    </div>
  )
}

// ── 聚合 pill ─────────────────────────────────────────────────────

const PILL_VARIANT: Record<SignalStatus, string> = {
  ok:      'ok',
  partial: 'warn',
  dead:    'danger',
  pending: 'default',
}

const PILL_LABEL: Record<SignalStatus, string> = {
  ok:      '全部可达',
  partial: '部分',
  dead:    '全失效',
  pending: '未测',
}

export function SignalPill({ status }: { status: SignalStatus }) {
  const variant = PILL_VARIANT[status]
  const label = PILL_LABEL[status]
  const color = status === 'ok' ? 'var(--state-success-fg)'
    : status === 'partial' ? 'var(--state-warning-fg)'
    : status === 'dead' ? 'var(--state-error-fg)'
    : 'var(--fg-muted)'
  const bg = status === 'ok' ? 'var(--state-success-bg)'
    : status === 'partial' ? 'var(--state-warning-bg)'
    : status === 'dead' ? 'var(--state-error-bg)'
    : 'var(--bg-surface-elevated)'
  const border = status === 'ok' ? 'var(--state-success-border)'
    : status === 'partial' ? 'var(--state-warning-border)'
    : status === 'dead' ? 'var(--state-error-border)'
    : 'var(--border-subtle)'

  return (
    <span
      data-variant={variant}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 500,
        color,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      {label}
    </span>
  )
}

// ── 展开区：线路矩阵 ──────────────────────────────────────────────

interface MatrixExpandProps {
  videoId: string
}

export function MatrixExpand({ videoId }: MatrixExpandProps) {
  const [lines, setLines] = useState<LineMatrixRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!lines && !loading && !error) {
    setLoading(true)
    getVideoMatrix(videoId)
      .then((data) => { setLines(data); setLoading(false) })
      .catch(() => { setError('加载失败'); setLoading(false) })
  }

  const EXPAND_STYLE: CSSProperties = {
    background: 'var(--bg-surface-elevated)',
    borderBottom: '1px solid var(--border-subtle)',
    padding: '12px 16px',
  }

  if (loading) {
    return (
      <div style={EXPAND_STYLE}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-muted)' }}>加载矩阵中…</div>
      </div>
    )
  }
  if (error || !lines) {
    return (
      <div style={EXPAND_STYLE}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--state-error-fg)' }}>{error ?? '未知错误'}</div>
      </div>
    )
  }
  if (lines.length === 0) {
    return (
      <div style={EXPAND_STYLE}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-muted)' }}>无线路数据</div>
      </div>
    )
  }

  const allEpisodes = Array.from(
    new Set(lines.flatMap((l) => l.episodes.map((e) => e.episodeNumber))),
  ).sort((a, b) => a - b).slice(0, 8)

  return (
    <div style={EXPAND_STYLE}>
      <div style={{ fontSize: '11px', color: 'var(--fg-muted)', marginBottom: '10px' }}>
        线路矩阵 — 行：线路 / 列：集 · 颜色：探测 ✕ 播放 双信号
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* 表头 */}
        <div style={EXPAND_GRID_STYLE}>
          <div style={{ fontSize: '11px', color: 'var(--fg-muted)', fontWeight: 600 }}>线路</div>
          {allEpisodes.map((ep) => (
            <div key={ep} style={{ fontSize: '11px', color: 'var(--fg-muted)', textAlign: 'center' }}>
              E{ep}
            </div>
          ))}
          {allEpisodes.length < 8 && <div />}
          <div />
        </div>
        {/* 线路行 */}
        {lines.map((line) => (
          <div key={`${line.sourceSiteKey}::${line.sourceName}`} style={EXPAND_GRID_STYLE}>
            <div
              title={`${line.sourceSiteKey} / ${line.sourceName}`}
              style={{
                fontSize: '12px',
                color: 'var(--fg-default)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {line.displayName ?? line.sourceName}
            </div>
            {allEpisodes.map((ep) => {
              const cell = line.episodes.find((e) => e.episodeNumber === ep)
              return cell ? (
                <EpisodeCellBlock
                  key={ep}
                  episodeNumber={ep}
                  probeStatus={cell.probeStatus}
                  renderStatus={cell.renderStatus}
                  isActive={cell.isActive}
                />
              ) : (
                <div
                  key={ep}
                  style={{
                    height: '28px',
                    borderRadius: '4px',
                    background: 'var(--bg-surface)',
                    border: '1px dashed var(--border-subtle)',
                  }}
                />
              )
            })}
            {allEpisodes.length < 8 && <div />}
            <div />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          type="button"
          style={{
            padding: '3px 10px',
            fontSize: '11px',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
            background: 'var(--bg-surface)',
            color: 'var(--fg-default)',
            cursor: 'pointer',
          }}
        >
          复制线路
        </button>
        <button
          type="button"
          style={{
            padding: '3px 10px',
            fontSize: '11px',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
            background: 'var(--bg-surface)',
            color: 'var(--fg-default)',
            cursor: 'pointer',
          }}
        >
          重验全部
        </button>
        <button
          type="button"
          style={{
            padding: '3px 10px',
            fontSize: '11px',
            border: '1px solid var(--state-error-border)',
            borderRadius: '4px',
            background: 'var(--bg-surface)',
            color: 'var(--state-error-fg)',
            cursor: 'pointer',
          }}
        >
          删除全失效
        </button>
      </div>
    </div>
  )
}

// ── 主组件：单行 ──────────────────────────────────────────────────

interface SourceMatrixRowProps {
  row: VideoGroupRow
  selected: boolean
  onSelect: (id: string, checked: boolean) => void
}

export function SourceMatrixRow({ row, selected, onSelect }: SourceMatrixRowProps) {
  const [expanded, setExpanded] = useState(false)

  function handleRowClick() {
    setExpanded((v) => !v)
  }

  function handleCheckChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    onSelect(row.videoId, e.target.checked)
  }

  return (
    <>
      <div
        role="row"
        style={{
          ...ROW_STYLE,
          background: selected ? 'var(--accent-soft, color-mix(in oklch, var(--accent-default) 10%, transparent))' : 'var(--bg-surface)',
        }}
        onClick={handleRowClick}
      >
        {/* 复选框 */}
        <div style={{ ...CELL_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={handleCheckChange}
            onClick={(e) => e.stopPropagation()}
            aria-label={`选择 ${row.title}`}
          />
        </div>
        {/* 视频信息 */}
        <div style={{ ...CELL_STYLE, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '14px',
              color: 'var(--fg-muted)',
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            ›
          </span>
          {row.coverUrl && (
            <Image
              src={row.coverUrl}
              alt=""
              width={32}
              height={44}
              sizes="32px"
              style={{ objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--fg-default)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '1px' }}>
              {row.type} · {row.year ?? '—'}
            </div>
          </div>
        </div>
        {/* 线路数 */}
        <div style={CELL_STYLE}>
          <strong>{row.lineCount}</strong>{' '}
          <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>条</span>
        </div>
        {/* 集·源数 */}
        <div style={CELL_STYLE}>
          <strong>{row.sourceCount}</strong>{' '}
          <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>个</span>
        </div>
        {/* 探测状态 */}
        <div style={CELL_STYLE}>
          <SignalPill status={row.probeStatus} />
        </div>
        {/* 播放状态 */}
        <div style={CELL_STYLE}>
          <SignalPill status={row.renderStatus} />
        </div>
        {/* 更新时间 */}
        <div style={{ ...CELL_STYLE, fontSize: '11px', color: 'var(--fg-muted)' }}>
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('zh-CN') : '—'}
        </div>
        {/* 操作 */}
        <div style={{ ...CELL_STYLE, display: 'flex', gap: '4px' }}>
          <button
            type="button"
            title="重验"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '24px', height: '24px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ↻
          </button>
          <button
            type="button"
            title="快速操作"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '24px', height: '24px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ⚡
          </button>
          <button
            type="button"
            title="更多"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '24px', height: '24px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ⋯
          </button>
        </div>
      </div>
      {expanded && <MatrixExpand videoId={row.videoId} />}
    </>
  )
}
