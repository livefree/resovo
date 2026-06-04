'use client'

/**
 * MergeComparePanel.tsx — N 列字段级对比矩阵（CHG-VIR-13-B2A / 设计 §4.2 + §10.4 + §11.2）
 *
 * 行 = 字段（封面 / 标题 / 类型·年份 / catalog / 状态 / 源构成 / 集数范围 / 外部 ID），
 * 列 = 组内各 video（N→1 天然横向扩展）；**target 选择 = 列头单选**（选中列整列高亮）。
 * 布局：字段名首列 sticky + 列区横向滚动 + 列最小宽度（§10.4 定档）。
 * 冲突标警（CSS 变量零硬编码）：type/year 不一致 → warn 行；外部 ID 同 provider 不同 id → danger。
 *
 * 数据契约：VideoSummaryForMerge +7 optional（D-105-7 / CHG-VIR-13-B1）；
 * 字段缺失（旧 response / legacy 降级）渲染「—」，组件零崩溃。
 */

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { VisChip } from '@resovo/admin-ui'
import type { VideoSummaryForMerge } from '@resovo/types'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

const WRAP_STYLE: CSSProperties = {
  overflowX: 'auto',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
}

const TABLE_STYLE: CSSProperties = {
  borderCollapse: 'separate',
  borderSpacing: 0,
  width: 'max-content',
  minWidth: '100%',
  fontSize: 'var(--font-size-sm)',
}

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
  minWidth: 160,
  maxWidth: 260,
  verticalAlign: 'top',
  borderBottom: '1px solid var(--border-subtle)',
}

const VIDEO_CELL_TARGET_STYLE: CSSProperties = {
  ...VIDEO_CELL_STYLE,
  background: 'var(--state-success-bg)',
}

const HEAD_CELL_STYLE: CSSProperties = {
  ...VIDEO_CELL_STYLE,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const HEAD_CELL_TARGET_STYLE: CSSProperties = {
  ...HEAD_CELL_STYLE,
  background: 'var(--state-success-bg)',
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

// ── 组件 ──────────────────────────────────────────────────────────

export interface MergeComparePanelProps {
  readonly videos: readonly VideoSummaryForMerge[]
  /** 当前 target（列头单选受控值） */
  readonly targetId: string
  readonly onTargetChange: (id: string) => void
  /** 推荐 target（候选路径 recommendedTargetVideoId；列头加「推荐」badge） */
  readonly recommendedTargetId?: string
}

interface FieldRow {
  readonly key: string
  readonly label: string
  readonly render: (v: VideoSummaryForMerge) => ReactNode
  /** 行级冲突标警样式（命中冲突时整行字段名标色） */
  readonly conflict?: boolean
  readonly conflictTone?: 'warn' | 'danger'
}

export function MergeComparePanel({ videos, targetId, onTargetChange, recommendedTargetId }: MergeComparePanelProps) {
  const conflicts = useMemo(() => deriveConflicts(videos), [videos])

  const rows = useMemo<readonly FieldRow[]>(() => [
    {
      key: 'cover',
      label: '封面',
      render: (v) => v.coverUrl
        // eslint-disable-next-line @next/next/no-img-element -- 矩阵缩略图（外域封面 / 与 Thumb 同范式）
        ? <img src={v.coverUrl} alt={v.title} style={COVER_STYLE} loading="lazy" />
        : <span style={MUTED}>—</span>,
    },
    {
      key: 'title',
      label: '标题',
      render: (v) => <span style={{ fontWeight: 500 }}>{v.title}</span>,
    },
    {
      key: 'type-year',
      label: '类型 / 年份',
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
      render: (v) => v.catalogTitle
        ? <span title={v.catalogId}>{v.catalogTitle}</span>
        : <span style={MUTED}>—</span>,
    },
    {
      key: 'status',
      label: '状态',
      render: (v) => (v.reviewStatus && v.visibilityStatus)
        ? <VisChip visibility={v.visibilityStatus} review={v.reviewStatus} testId={`compare-vis-${v.id}`} />
        : <span style={MUTED}>—</span>,
    },
    {
      key: 'sources',
      label: '源构成',
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
      render: (v) => v.episodeRange && v.episodeRange.min !== null
        ? <span>E{v.episodeRange.min}–E{v.episodeRange.max}</span>
        : <span style={MUTED}>—</span>,
    },
    {
      key: 'external',
      label: '外部 ID',
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

  return (
    <div style={WRAP_STYLE} data-testid="merge-compare-panel">
      <table style={TABLE_STYLE}>
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
                <td key={v.id} style={v.id === targetId ? VIDEO_CELL_TARGET_STYLE : VIDEO_CELL_STYLE}>
                  {row.render(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
