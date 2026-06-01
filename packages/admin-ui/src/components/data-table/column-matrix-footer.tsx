'use client'

/**
 * column-matrix-footer.tsx — ColumnMatrixMenu 底部批量按钮区（DTR-A 拆自 column-matrix-menu.tsx）
 *
 * 当前批量按钮：清除全部过滤 / 清除排序 / 恢复默认列可见性。
 * DTR-C 将在此追加「重置列宽」按钮（onResetColumnWidths 定义时渲染）。
 */
import React from 'react'
import { FOOT_STYLE, FOOT_BTN_STYLE } from './column-matrix-menu.styles'

export interface ColumnMatrixFooterProps {
  /** 底部批量按钮：清除全部过滤 */
  readonly onClearAllFilters: () => void
  /** 底部批量按钮：清除排序 */
  readonly onClearSort: () => void
  /** 底部批量按钮：恢复默认列可见性（按 column.defaultVisible 重置） */
  readonly onResetColumnVisibility: () => void
}

export function ColumnMatrixFooter({
  onClearAllFilters,
  onClearSort,
  onResetColumnVisibility,
}: ColumnMatrixFooterProps): React.ReactElement {
  return (
    <div style={FOOT_STYLE} role="group" aria-label="批量操作">
      <button
        type="button"
        style={FOOT_BTN_STYLE}
        onClick={onClearAllFilters}
        data-testid="matrix-foot-clear-filters"
      >
        清除全部过滤
      </button>
      <button
        type="button"
        style={FOOT_BTN_STYLE}
        onClick={onClearSort}
        data-testid="matrix-foot-clear-sort"
      >
        清除排序
      </button>
      <button
        type="button"
        style={FOOT_BTN_STYLE}
        onClick={onResetColumnVisibility}
        data-testid="matrix-foot-reset-visibility"
      >
        恢复默认列可见性
      </button>
    </div>
  )
}
