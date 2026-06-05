'use client'

/**
 * MergeComparePanel.tsx — N 列字段级对比矩阵（CHG-VIR-13-B2A / 设计 §4.2 + §10.4 + §11.2）
 *
 * 行 = 字段（封面 / 标题 / 类型·年份 / catalog / 状态 / 源构成 / 集数范围 / 外部 ID
 *     / 线路·播放预览〔CHG-VIR-15-UX-B〕），列 = 组内各 video（N→1 天然横向扩展）；
 * **target 选择 = 列头单选**（选中列整列绿色边框 / UX-B ④ 由背景改边框）。
 *
 * CHG-VIR-15-UX-B（用户裁定 ③④⑤）：
 *   - 列等宽（tableLayout fixed + colgroup 均分；N 大时 minWidth 撑出横向滚动）
 *   - 值全同的字段行 → 背景标示（--bg-subtle，快速看出哪些行一致/有差异）
 *   - 线路×集数按视频列嵌入（展开/收起；数据由消费方拉取注入）+ 每列内嵌
 *     AdminPlayer（点击 ▶En 在该列内播放，多列可同时播对比画面）
 *
 * 冲突标警（CSS 变量零硬编码）：type/year 不一致 → warn 行；外部 ID 同 provider 不同 id → danger。
 * 数据契约：VideoSummaryForMerge +7 optional（D-105-7）；字段缺失渲染「—」零崩溃。
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { VisChip, AdminButton } from '@resovo/admin-ui'
import type { VideoSummaryForMerge, LineMatrixRow } from '@resovo/types'
import { AdminPlayer } from '../../moderation/_client/AdminPlayer'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

const WRAP_STYLE: CSSProperties = {
  overflowX: 'auto',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
}

/** 字段名列固定宽（colgroup） */
const FIELD_COL_WIDTH = 110
/** 视频列等宽下限（N 大时撑出横向滚动） */
const VIDEO_COL_MIN_WIDTH = 200

/** 字段名首列 sticky（§10.4） */
const FIELD_CELL_STYLE: CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  background: 'var(--bg-surface)',
  padding: '6px 10px',
  textAlign: 'left',
  color: 'var(--fg-muted)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  borderRight: '1px solid var(--border-subtle)',
  borderBottom: '1px solid var(--border-subtle)',
}

const VIDEO_CELL_STYLE: CSSProperties = {
  padding: '6px 12px',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--border-subtle)',
  // UX-B ⑤ 等宽（tableLayout fixed）下长内容换行不撑列
  overflowWrap: 'break-word',
}

// UX-B ④：target 整列绿色**边框**（原绿色背景退役；背景通道让位相同值行标示）
const TARGET_SIDE_BORDER: CSSProperties = {
  borderLeft: '2px solid var(--state-success-border)',
  borderRight: '2px solid var(--state-success-border)',
}

const HEAD_CELL_STYLE: CSSProperties = {
  ...VIDEO_CELL_STYLE,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const HEAD_CELL_TARGET_STYLE: CSSProperties = {
  ...HEAD_CELL_STYLE,
  ...TARGET_SIDE_BORDER,
  borderTop: '2px solid var(--state-success-border)',
}

const RECOMMENDED_BADGE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  marginLeft: 6,
  borderRadius: 4,
  fontSize: '11px',
  fontWeight: 600,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
}

const WARN_TEXT: CSSProperties = { color: 'var(--state-warning-fg)', fontWeight: 600 }
const DANGER_TEXT: CSSProperties = { color: 'var(--state-danger-fg)', fontWeight: 600 }
const MUTED: CSSProperties = { color: 'var(--fg-muted)' }
const COVER_STYLE: CSSProperties = {
  width: 48,
  aspectRatio: '2 / 3',
  objectFit: 'cover',
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-subtle)',
}

/** ▶En 集按钮（线路行） */
const EP_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: 3,
  padding: '0 4px',
  cursor: 'pointer',
  color: 'var(--fg-default)',
  fontSize: '11px',
}

const EP_BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...EP_BUTTON_STYLE,
  border: '1px solid var(--state-success-border)',
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  fontWeight: 600,
}

// ── 冲突推导 ──────────────────────────────────────────────────────

interface ConflictFlags {
  readonly typeYear: boolean
  /** 同 provider 不同 external_id（强负同语义 / §4.2 警示区） */
  readonly externalId: boolean
}

function deriveConflicts(videos: readonly VideoSummaryForMerge[]): ConflictFlags {
  const types = new Set(videos.map((v) => v.type))
  const years = new Set(videos.map((v) => v.year).filter((y): y is number => y !== null))
  const byProvider = new Map<string, Set<string>>()
  for (const v of videos) {
    for (const ref of v.externalIds ?? []) {
      const set = byProvider.get(ref.provider) ?? new Set<string>()
      set.add(ref.externalId)
      byProvider.set(ref.provider, set)
    }
  }
  return {
    typeYear: types.size > 1 || years.size > 1,
    externalId: [...byProvider.values()].some((ids) => ids.size > 1),
  }
}

// ── 线路数据注入契约（CHG-VIR-15-UX-B ③；数据由消费方拉取） ─────────

export interface CompareLinesState {
  readonly status: 'idle' | 'loading' | 'error' | 'ready'
  /** videoId → 线路矩阵（ready 时有值） */
  readonly byVideo: ReadonlyMap<string, readonly LineMatrixRow[]>
  readonly error?: string
}

/** 列内播放目标（▶En 点击 → 该列内嵌播放器装载） */
interface InlinePlayTarget {
  readonly sourceId: string
  readonly sourceUrl: string
  readonly episodeNumber: number
  readonly lineLabel: string
}

// ── 组件 ──────────────────────────────────────────────────────────

export interface MergeComparePanelProps {
  readonly videos: readonly VideoSummaryForMerge[]
  /** 当前 target（列头单选受控值） */
  readonly targetId: string
  readonly onTargetChange: (id: string) => void
  /** 推荐 target（候选路径 recommendedTargetVideoId；列头加「推荐」badge） */
  readonly recommendedTargetId?: string
  /** UX-B ③：线路×集数行数据（注入时渲染「线路 · 播放」行；undefined = 不渲染该行） */
  readonly linesState?: CompareLinesState
  /** UX-B ③：展开（idle/error → load）/ 收起（ready → 清数据） */
  readonly onToggleLines?: () => void
}

interface FieldRow {
  readonly key: string
  readonly label: string
  readonly render: (v: VideoSummaryForMerge) => ReactNode
  /** UX-B ④：值提取（全列相同 → 行背景标示；null = 不参与相同性判定） */
  readonly valueKey?: (v: VideoSummaryForMerge) => string
  /** 行级冲突标警样式（命中冲突时整行字段名标色） */
  readonly conflict?: boolean
  readonly conflictTone?: 'warn' | 'danger'
}

export function MergeComparePanel({
  videos, targetId, onTargetChange, recommendedTargetId, linesState, onToggleLines,
}: MergeComparePanelProps) {
  const conflicts = useMemo(() => deriveConflicts(videos), [videos])

  // UX-B ③：列内嵌播放器（per-video；多列可同时播放对比画面）
  const [playByVideo, setPlayByVideo] = useState<ReadonlyMap<string, InlinePlayTarget>>(new Map())

  const rows = useMemo<readonly FieldRow[]>(() => [
    {
      key: 'cover',
      label: '封面',
      valueKey: (v) => v.coverUrl ?? '',
      render: (v) => v.coverUrl
        // eslint-disable-next-line @next/next/no-img-element -- 矩阵缩略图（外域封面 / 与 Thumb 同范式）
        ? <img src={v.coverUrl} alt={v.title} style={COVER_STYLE} loading="lazy" />
        : <span style={MUTED}>—</span>,
    },
    {
      key: 'title',
      label: '标题',
      valueKey: (v) => v.title,
      render: (v) => <span style={{ fontWeight: 500 }}>{v.title}</span>,
    },
    {
      key: 'type-year',
      label: '类型 / 年份',
      valueKey: (v) => `${v.type}|${v.year ?? ''}`,
      conflict: conflicts.typeYear,
      conflictTone: 'warn',
      render: (v) => (
        <span style={conflicts.typeYear ? WARN_TEXT : undefined}>
          {v.type} · {v.year ?? '—'}
        </span>
      ),
    },
    {
      key: 'catalog',
      label: 'catalog',
      valueKey: (v) => v.catalogId ?? '',
      render: (v) => v.catalogTitle
        ? <span title={v.catalogId}>{v.catalogTitle}</span>
        : <span style={MUTED}>—</span>,
    },
    {
      key: 'status',
      label: '状态',
      valueKey: (v) => `${v.reviewStatus ?? ''}|${v.visibilityStatus ?? ''}`,
      render: (v) => (v.reviewStatus && v.visibilityStatus)
        ? <VisChip visibility={v.visibilityStatus} review={v.reviewStatus} testId={`compare-vis-${v.id}`} />
        : <span style={MUTED}>—</span>,
    },
    {
      key: 'sources',
      label: '源构成',
      valueKey: (v) => `${v.sourceCount}|${[...v.sourceSiteKeys].sort().join(',')}`,
      render: (v) => (
        <span>
          {v.sourceCount} 源 · {v.sourceSiteKeys.length} 站
          {v.sourceSiteKeys.length > 0 && (
            <span style={{ ...MUTED, display: 'block', fontSize: '11px' }}>{v.sourceSiteKeys.join(' · ')}</span>
          )}
        </span>
      ),
    },
    {
      key: 'episodes',
      label: '集数范围',
      valueKey: (v) => v.episodeRange ? `${v.episodeRange.min ?? ''}-${v.episodeRange.max ?? ''}` : '',
      render: (v) => v.episodeRange && v.episodeRange.min !== null
        ? <span>E{v.episodeRange.min}–E{v.episodeRange.max}</span>
        : <span style={MUTED}>—</span>,
    },
    {
      key: 'external',
      label: '外部 ID',
      valueKey: (v) => (v.externalIds ?? []).map((r) => `${r.provider}:${r.externalId}`).sort().join('/'),
      conflict: conflicts.externalId,
      conflictTone: 'danger',
      render: (v) => (v.externalIds && v.externalIds.length > 0)
        ? (
          <span style={conflicts.externalId ? DANGER_TEXT : undefined}>
            {v.externalIds.map((r) => `${r.provider}:${r.externalId}`).join(' / ')}
          </span>
        )
        : <span style={MUTED}>—</span>,
    },
  ], [conflicts])

  // UX-B ④：值全同的行 → 背景标示（--bg-subtle；>1 列才有「相同」语义）
  const sameRowKeys = useMemo(() => {
    const set = new Set<string>()
    if (videos.length < 2) return set
    for (const row of rows) {
      if (!row.valueKey) continue
      const values = new Set(videos.map((v) => row.valueKey!(v)))
      if (values.size === 1) set.add(row.key)
    }
    return set
  }, [rows, videos])

  // UX-B ⑤：等宽（fixed + colgroup 均分；minWidth 撑出横向滚动）
  const tableStyle = useMemo<CSSProperties>(() => ({
    tableLayout: 'fixed',
    borderCollapse: 'separate',
    borderSpacing: 0,
    width: '100%',
    minWidth: FIELD_COL_WIDTH + videos.length * VIDEO_COL_MIN_WIDTH,
    fontSize: 'var(--font-size-sm)',
  }), [videos.length])

  const lastRowKey = linesState ? 'lines' : rows[rows.length - 1]?.key

  /** 视频列单元格样式合成（target 绿框 + 相同值行背景 + 末行底边收口） */
  const cellStyle = (videoId: string, rowKey: string): CSSProperties => ({
    ...VIDEO_CELL_STYLE,
    ...(sameRowKeys.has(rowKey) ? { background: 'var(--bg-subtle)' } : {}),
    ...(videoId === targetId ? TARGET_SIDE_BORDER : {}),
    ...(videoId === targetId && rowKey === lastRowKey
      ? { borderBottom: '2px solid var(--state-success-border)' }
      : {}),
  })

  return (
    <div style={WRAP_STYLE} data-testid="merge-compare-panel">
      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: FIELD_COL_WIDTH }} />
          {videos.map((v) => <col key={v.id} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={FIELD_CELL_STYLE} scope="col">字段</th>
            {videos.map((v) => (
              <th
                key={v.id}
                style={v.id === targetId ? HEAD_CELL_TARGET_STYLE : HEAD_CELL_STYLE}
                scope="col"
                onClick={() => onTargetChange(v.id)}
                data-testid={`compare-head-${v.id}`}
              >
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="compare-target"
                    checked={targetId === v.id}
                    onChange={() => onTargetChange(v.id)}
                    aria-label={`选择 ${v.title} 为合并目标`}
                  />
                  <span style={{ fontWeight: 600 }}>{v.title}</span>
                </label>
                {v.id === recommendedTargetId && (
                  <span style={RECOMMENDED_BADGE_STYLE} aria-label="推荐合并目标">推荐</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} data-testid={`compare-row-${row.key}`}>
              <th
                style={{
                  ...FIELD_CELL_STYLE,
                  ...(row.conflict ? (row.conflictTone === 'danger' ? DANGER_TEXT : WARN_TEXT) : {}),
                }}
                scope="row"
              >
                {row.conflict ? '⚠ ' : ''}{row.label}
              </th>
              {videos.map((v) => (
                <td key={v.id} style={cellStyle(v.id, row.key)}>
                  {row.render(v)}
                </td>
              ))}
            </tr>
          ))}

          {/* UX-B ③：线路 · 播放预览行（每视频列自己的线路 + 列内嵌播放器） */}
          {linesState && (
            <tr data-testid="compare-row-lines">
              <th style={FIELD_CELL_STYLE} scope="row">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <span>线路 · 播放</span>
                  {onToggleLines && (
                    <AdminButton
                      size="sm"
                      variant="default"
                      disabled={linesState.status === 'loading'}
                      onClick={onToggleLines}
                      data-testid="compare-lines-toggle"
                    >
                      {linesState.status === 'loading' ? '加载中…'
                        : linesState.status === 'ready' ? '▴ 收起'
                        : '▾ 展开'}
                    </AdminButton>
                  )}
                </div>
              </th>
              {videos.map((v) => {
                const lines = linesState.byVideo.get(v.id) ?? []
                const playing = playByVideo.get(v.id) ?? null
                return (
                  <td key={v.id} style={cellStyle(v.id, 'lines')} data-testid={`compare-lines-${v.id}`}>
                    {linesState.status === 'error' ? (
                      <span style={{ ...DANGER_TEXT, fontSize: '11px' }}>{linesState.error ?? '加载失败'}</span>
                    ) : linesState.status !== 'ready' ? (
                      <span style={MUTED}>—</span>
                    ) : lines.length === 0 ? (
                      <span style={MUTED}>无线路</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {lines.map((line) => (
                          <div key={`${line.sourceSiteKey}|${line.sourceName}`} style={{ fontSize: '11px' }}>
                            <span style={{ fontWeight: 600 }}>{line.displayName ?? line.sourceName}</span>
                            <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', marginLeft: 6 }}>
                              {line.episodes.map((e) => {
                                const active = playing?.sourceId === e.sourceId
                                return (
                                  <button
                                    key={e.sourceId}
                                    type="button"
                                    style={active ? EP_BUTTON_ACTIVE_STYLE : EP_BUTTON_STYLE}
                                    onClick={() => {
                                      setPlayByVideo((prev) => {
                                        const next = new Map(prev)
                                        next.set(v.id, {
                                          sourceId: e.sourceId,
                                          sourceUrl: e.sourceUrl,
                                          episodeNumber: e.episodeNumber,
                                          lineLabel: line.displayName ?? line.sourceName,
                                        })
                                        return next
                                      })
                                    }}
                                    data-testid={`compare-ep-${e.sourceId}`}
                                  >▶E{e.episodeNumber}</button>
                                )
                              })}
                            </span>
                          </div>
                        ))}
                        {/* 列内嵌播放器（key=sourceId remount 重载；多列同播对比画面） */}
                        {playing && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <AdminPlayer
                              key={playing.sourceId}
                              videoId={v.id}
                              sourceUrl={playing.sourceUrl}
                              sourceId={playing.sourceId}
                              title={v.title}
                              testId={`compare-player-${v.id}`}
                            />
                            <span style={{ ...MUTED, fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                              <span>{playing.lineLabel} · E{playing.episodeNumber}</span>
                              <button
                                type="button"
                                style={EP_BUTTON_STYLE}
                                onClick={() => {
                                  setPlayByVideo((prev) => {
                                    const next = new Map(prev)
                                    next.delete(v.id)
                                    return next
                                  })
                                }}
                                data-testid={`compare-player-close-${v.id}`}
                              >关闭</button>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
