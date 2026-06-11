'use client'

/**
 * PendingQueueToolbar.tsx — 审核台左队列上方 search + filterChips（CHG-350）
 *
 * 设计来源：plan §10.1 方案 A（保留 ModListRow 形态，顶部加 toolbar；不抽新原语）
 *
 * 实施：复用 admin-ui `DataTableSearchInput`（半 uncontrolled / IME 兼容 / 内置 debounce）
 *   修复用户实测 bug：原普通受控 input 在外部 re-render 链路中触发光标失焦
 *   见 packages/admin-ui/src/components/data-table/search-input.tsx EP-4-HOTFIX 注释
 *
 * 职责：
 *   - search input（caller 通过 onQChange 接收 debounce/composition end 后的最终值）
 *   - 当前 active filters 可视化（来自 caller filters；本组件只显示，不修改 filters 维度）
 *   - "清除全部"按钮（重置 q + filter chips 全部）
 */

import React from 'react'
import { DataTableSearchInput } from '@resovo/admin-ui'
import type { FilterPresetQuery } from '@/lib/moderation/use-filter-presets'
import { M } from '@/i18n/messages/zh-CN/moderation'

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

// SEARCH_INPUT_STYLE 已删除 — 改用 DataTableSearchInput 自带样式

const CLEAR_BTN_STYLE: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xxs)',
}

// MODUX-P3-2：筛选弹层入口按钮（active 时高亮 + 维度计数 badge）
function filterBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    border: `1px solid ${active ? 'var(--accent-default)' : 'var(--border-default)'}`,
    borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--admin-accent-soft)' : 'var(--bg-surface)',
    color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-xxs)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }
}

const FILTER_COUNT_BADGE_STYLE: React.CSSProperties = {
  minWidth: 14,
  height: 14,
  padding: '0 3px',
  borderRadius: 999,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  fontSize: 'var(--font-size-3xs, 9px)',
  lineHeight: '14px',
  textAlign: 'center',
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
  /** MODUX-P3-2：打开筛选弹层（按钮触发；本组件不持弹层 state） */
  readonly onOpenFilters: () => void
  readonly resultCount?: number
}

export function PendingQueueToolbar({
  q,
  onQChange,
  filters,
  onClearAll,
  onOpenFilters,
  resultCount,
}: PendingQueueToolbarProps): React.ReactElement {
  const activeFilters = Object.entries(filters).filter(([, v]) => v != null && v !== '')
  const hasAnyFilter = q.trim() !== '' || activeFilters.length > 0

  return (
    <div style={TOOLBAR_STYLE} data-testid="pending-queue-toolbar">
      <div style={SEARCH_ROW_STYLE}>
        <button
          type="button"
          style={filterBtnStyle(activeFilters.length > 0)}
          onClick={onOpenFilters}
          aria-haspopup="dialog"
          title={M.filterPanel.kbdHint}
          data-testid="pending-queue-filter-trigger"
        >
          {M.filterPanel.triggerLabel}
          {activeFilters.length > 0 && (
            <span style={FILTER_COUNT_BADGE_STYLE} data-testid="pending-queue-filter-count">{activeFilters.length}</span>
          )}
        </button>
        <div style={{ flex: 1 }}>
          <DataTableSearchInput
            value={q}
            onChange={onQChange}
            placeholder="搜索标题…"
            aria-label="搜索待审视频标题"
            data-testid="pending-queue-search-input"
            size="sm"
          />
        </div>
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
