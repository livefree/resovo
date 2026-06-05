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

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { VisChip } from '@resovo/admin-ui'
import type { VideoSummaryForMerge } from '@resovo/types'
// CHG-VIR-17-PARTIAL：500 行硬限拆分——样式常量 + 线路行组件分文件（拆出随迁注释见各文件头）
import {
  WRAP_STYLE,
  FIELD_COL_WIDTH,
  VIDEO_COL_MIN_WIDTH,
  FIELD_CELL_STYLE,
  VIDEO_CELL_STYLE,
  TARGET_SIDE_BORDER,
  HEAD_CELL_STYLE,
  HEAD_CELL_TARGET_STYLE,
  RECOMMENDED_BADGE_STYLE,
  WARN_TEXT,
  DANGER_TEXT,
  MUTED,
  COVER_STYLE,
} from './MergeComparePanel.styles'
import { CompareLinesRow, type CompareLinesState } from './CompareLinesRow'

// 公开 re-export（消费方 import 路径保持不变：MergeCandidateExpand 等）
export type { CompareLinesState }

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
  /** UX-B ③：线路×集数行数据（注入时渲染「线路 · 播放」行；undefined = 不渲染该行） */
  readonly linesState?: CompareLinesState
  /** UX-B ③：展开（idle/error → load）/ 收起（ready → 清数据） */
  readonly onToggleLines?: () => void
  /**
   * CHG-VIR-17-PARTIAL（D-105a-18 遗留 ① 兑现）：部分合并成员勾选（受控）。
   * undefined = 不渲染勾选（整组语义，既有消费方零影响）；提供时列头加 checkbox，
   * 排除列整列灰化 + target radio disabled（target 必须在选中集合内，联动由消费方编排）。
   */
  readonly selectedIds?: ReadonlySet<string>
  /** 勾选切换（id, 纳入与否）；与 selectedIds 成对提供 */
  readonly onSelectedChange?: (id: string, selected: boolean) => void
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
  selectedIds, onSelectedChange,
}: MergeComparePanelProps) {
  const conflicts = useMemo(() => deriveConflicts(videos), [videos])

  // CHG-VIR-17-PARTIAL：排除列判定（selectedIds 未提供 = 全部纳入，整组语义）
  const isExcluded = (id: string) => selectedIds !== undefined && !selectedIds.has(id)

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

  /** 视频列单元格样式合成（target 绿框 + 相同值行背景 + 末行底边收口 + 排除列灰化） */
  const cellStyle = (videoId: string, rowKey: string): CSSProperties => ({
    ...VIDEO_CELL_STYLE,
    ...(sameRowKeys.has(rowKey) ? { background: 'var(--bg-subtle)' } : {}),
    ...(videoId === targetId ? TARGET_SIDE_BORDER : {}),
    ...(videoId === targetId && rowKey === lastRowKey
      ? { borderBottom: '2px solid var(--state-success-border)' }
      : {}),
    // CHG-VIR-17-PARTIAL：排除列整列灰化（不参与本次合并的视觉降权）
    ...(isExcluded(videoId) ? { opacity: 0.45 } : {}),
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
                style={{
                  ...(v.id === targetId ? HEAD_CELL_TARGET_STYLE : HEAD_CELL_STYLE),
                  // CHG-VIR-17-PARTIAL：排除列头同列体灰化
                  ...(isExcluded(v.id) ? { opacity: 0.45 } : {}),
                }}
                scope="col"
                onClick={() => { if (!isExcluded(v.id)) onTargetChange(v.id) }}
                data-testid={`compare-head-${v.id}`}
              >
                {/* CHG-VIR-17-PARTIAL：成员勾选（排除 = 不参与本次合并；target 联动由消费方编排） */}
                {selectedIds !== undefined && onSelectedChange && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(v.id)}
                    onChange={(e) => onSelectedChange(v.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`${selectedIds.has(v.id) ? '排除' : '纳入'} ${v.title}`}
                    style={{ marginRight: 6 }}
                    data-testid={`compare-select-${v.id}`}
                  />
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: isExcluded(v.id) ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="radio"
                    name="compare-target"
                    checked={targetId === v.id}
                    disabled={isExcluded(v.id)}
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

          {/* UX-B ③：线路 · 播放预览行（每视频列自己的线路 + 列内嵌播放器；
              CHG-VIR-17-PARTIAL 拆出 CompareLinesRow，cellStyle 注入保持排除灰化口径单一真源） */}
          {linesState && (
            <CompareLinesRow
              videos={videos}
              linesState={linesState}
              onToggleLines={onToggleLines}
              cellStyle={cellStyle}
            />
          )}
        </tbody>
      </table>
    </div>
  )
}
