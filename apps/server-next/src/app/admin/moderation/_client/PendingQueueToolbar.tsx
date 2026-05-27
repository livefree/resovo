'use client'

/**
 * PendingQueueToolbar.tsx — 审核台左队列上方 search + filterChips（CHG-350）
 *
 * 设计来源：plan §10.1 方案 A（保留 ModListRow 形态，顶部加 toolbar；不抽新原语）
 *
 * 职责：
 *   - 受控 search input（caller 持 q 字符串 + debounce）
 *   - 当前 active filters 可视化（来自 caller filters；本组件只显示，不修改 filters 维度）
 *   - "清除全部"按钮（重置 q + filter chips 全部）
 *
 * 不在职责：
 *   - debounce 实现（caller useEffect 或 useTransition 处理）
 *   - filter 维度（type / sourceCheckStatus 等）的修改（FilterPresetPopover 负责）
 */

import React from 'react'
import type { FilterPresetQuery } from '@/lib/moderation/use-filter-presets'

const TOOLBAR_STYLE: React.CSSProperties = {
  // CHG-350 BUG-FIX：sticky 贴 pane body 顶部，列表滚动时 toolbar 保持可见
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '6px 8px',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface-row)',
  flexShrink: 0,
}

const SEARCH_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const SEARCH_INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
  outline: 'none',
}

const CLEAR_BTN_STYLE: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xxs)',
}

const CHIPS_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
}

const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '1px 7px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-2xs)',
  background: 'var(--admin-accent-soft)',
  color: 'var(--accent-default)',
  border: '1px solid var(--accent-default)',
}

function formatChipValue(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? '是' : '否'
  return value
}

export interface PendingQueueToolbarProps {
  readonly q: string
  readonly onQChange: (q: string) => void
  readonly filters: FilterPresetQuery
  readonly onClearAll: () => void
  readonly resultCount?: number
}

export function PendingQueueToolbar({
  q,
  onQChange,
  filters,
  onClearAll,
  resultCount,
}: PendingQueueToolbarProps): React.ReactElement {
  const activeFilters = Object.entries(filters).filter(([, v]) => v != null && v !== '')
  const hasAnyFilter = q.trim() !== '' || activeFilters.length > 0

  return (
    <div style={TOOLBAR_STYLE} data-testid="pending-queue-toolbar">
      <div style={SEARCH_ROW_STYLE}>
        <input
          type="text"
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="搜索标题…"
          aria-label="搜索待审视频标题"
          style={SEARCH_INPUT_STYLE}
          data-testid="pending-queue-search-input"
        />
        {hasAnyFilter && (
          <button
            type="button"
            style={CLEAR_BTN_STYLE}
            onClick={onClearAll}
            data-testid="pending-queue-clear-all"
            title="清除搜索和所有筛选"
          >
            清除
          </button>
        )}
      </div>
      {(activeFilters.length > 0 || (resultCount != null && q.trim() !== '')) && (
        <div style={CHIPS_ROW_STYLE}>
          {activeFilters.map(([key, val]) => (
            <span key={key} style={CHIP_STYLE} data-filter-chip data-key={key}>
              {key}: {formatChipValue(val as string | boolean)}
            </span>
          ))}
          {resultCount != null && q.trim() !== '' && (
            <span style={{ ...CHIP_STYLE, background: 'var(--bg-surface-raised)', color: 'var(--fg-muted)', border: '1px solid var(--border-default)' }} data-testid="pending-queue-result-count">
              结果 {resultCount}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
