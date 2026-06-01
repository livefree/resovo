'use client'

/**
 * column-matrix-footer.tsx — ColumnMatrixMenu 底部批量按钮区（DTR-A 拆自 column-matrix-menu.tsx）
 *
 * 批量按钮：清除全部过滤 / 清除排序 / 恢复默认列可见性 /（DTR-C/DTR-F）自适应列宽。
 * 「自适应列宽」仅在 `onAutoFitColumnWidths` 提供时渲染（即表级 enableColumnResizing 启用时）。
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
  /** 底部批量按钮：自适应列宽（auto-fit 全列按当前页内容 + 表头列名 / DTR-F）；缺省不渲染该按钮 */
  readonly onAutoFitColumnWidths?: () => void
}

export function ColumnMatrixFooter({
  onClearAllFilters,
  onClearSort,
  onResetColumnVisibility,
  onAutoFitColumnWidths,
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
      {onAutoFitColumnWidths && (
        <button
          type="button"
          style={FOOT_BTN_STYLE}
          onClick={onAutoFitColumnWidths}
          data-testid="matrix-foot-reset-widths"
        >
          自适应列宽
        </button>
      )}
    </div>
  )
}
