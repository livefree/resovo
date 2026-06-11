'use client'

import React from 'react'
import { DualSignalCount, Thumb, EnrichmentBadgeCluster } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'

interface ModListRowProps {
  readonly it: VideoQueueRow
  readonly active: boolean
  readonly onClick: () => void
  /** CHG-SN-8-GAPS-MOD-BATCH：批量模式开关；on 时显 checkbox 替代单击直跳 */
  readonly selectionMode?: boolean
  /** 选中状态（仅 selectionMode=true 时消费） */
  readonly selected?: boolean
  /** checkbox toggle 回调（selectionMode=true 时必填） */
  readonly onToggleSelect?: () => void
}

const ROW_BASE: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: 'var(--list-row-padding-y) var(--list-row-padding-x)',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer',
}

const THUMB_FALLBACK_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

// MODUX-P2-1：右侧栏分区——column + gap 建立层级（替代散落 marginTop），利用 280px 列宽。
//   ① 标题行 ② 元信息行（type·year ↔ badge，space-between 占满列宽）③ 信号/富集行。
const COL_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const META_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
}

const META_TEXT_STYLE: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

// 次要信息（badge）：右对齐占列宽尾部、保留 warning 语义色但不加突出背景；
//   截断显示首项（多项补 +N 计数），完整文案经 title hover 透出。
const BADGE_STYLE: React.CSSProperties = {
  flexShrink: 0,
  maxWidth: '55%',
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--state-warning-fg)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: 'help',
}

const SIGNAL_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  flexWrap: 'wrap',
}

function titleStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 'var(--font-size-sm-tight)',
    fontWeight: 600,
    color: active ? 'var(--accent-default)' : 'var(--fg-default)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
}

export function ModListRow({
  it,
  active,
  onClick,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: ModListRowProps): React.ReactElement {
  const handleRowClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect()
    } else {
      onClick()
    }
  }
  // 多 badge 折叠为「首项 +N」，title 透出全部
  const badgeLabel = it.badges.length > 1 ? `${it.badges[0]} +${it.badges.length - 1}` : it.badges[0]
  return (
    <div
      role="option"
      aria-selected={selectionMode ? selected : active}
      onClick={handleRowClick}
      style={{
        ...ROW_BASE,
        background: selectionMode
          ? (selected ? 'var(--state-success-bg, var(--state-ok-soft))' : 'transparent')
          : (active ? 'var(--admin-accent-soft)' : 'transparent'),
        borderLeft: `2px solid ${selectionMode ? (selected ? 'var(--state-success-fg)' : 'transparent') : (active ? 'var(--accent-default)' : 'transparent')}`,
      }}
      data-mod-list-row
      data-video-id={it.id}
      data-batch-selected={selectionMode && selected ? '' : undefined}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.()}
          onClick={(e) => e.stopPropagation()}
          style={{ alignSelf: 'center', cursor: 'pointer' }}
          data-testid={`mod-list-checkbox-${it.id}`}
          aria-label={`选择 ${it.title}`}
        />
      )}
      <Thumb
        src={it.coverUrl}
        size="poster-sm"
        decorative={false}
        alt={it.title}
        fallback={<span style={THUMB_FALLBACK_STYLE}>{it.type}</span>}
      />
      <div style={COL_STYLE}>
        {/* 标题行 */}
        <div style={titleStyle(active)}>{it.title}</div>
        {/* 元信息行：type·year ↔ badge（space-between 利用列宽；badge 次要信息 hover 透出）*/}
        <div style={META_ROW_STYLE}>
          <span style={META_TEXT_STYLE}>{it.type} · {it.year ?? '—'}</span>
          {it.badges.length > 0 && (
            <span style={BADGE_STYLE} title={it.badges.join(' · ')} data-mod-row-badge>
              {badgeLabel}
            </span>
          )}
        </div>
        {/* 信号/富集行 */}
        <div style={SIGNAL_ROW_STYLE}>
          {/* CHG-360-C / ADR-159：X/Y 聚合显示 / 按 DISTINCT 线路 count / partial 黄色 */}
          <DualSignalCount probe={it.probeAggregate} render={it.renderAggregate} />
          {/* META-12-B / feature-2：富集徽标簇（density='row'）；anime-only bangumi 由 Cluster 依 it.type 门控 */}
          {it.enrichmentSummary && (
            <EnrichmentBadgeCluster summary={it.enrichmentSummary} type={it.type} density="row" />
          )}
        </div>
      </div>
    </div>
  )
}
