/**
 * ColumnHeaderMenu.tsx — 列标题 ⋮ 下拉菜单（共享组件）
 * CHG-327: 从 crawler-site/ColumnMenu 提取，去除 domain-specific 依赖
 *
 * 包含：排序区（升序/降序）+ filterContent slot + 隐藏按钮
 * 定位：absolute right-0 top-full，由 ModernTableHead 负责开关
 */

import type { ReactNode } from 'react'

export interface ColumnHeaderMenuProps {
  /** 是否展示排序按钮（调用方已确认 onSortChange 存在 + enableSorting） */
  canSort: boolean
  /** 当前该列的排序状态；null 表示未按此列排序 */
  currentSortDir: 'asc' | 'desc' | null
  /** 是否展示"隐藏此列"按钮 */
  canHide: boolean
  /** 列专属筛选控件（ReactNode slot，domain-specific） */
  filterContent?: ReactNode
  /** 是否展示筛选激活状态（圆点指示） */
  isFiltered?: boolean
  onSortAsc: () => void
  onSortDesc: () => void
  onHide: () => void
  /** 清除当前列筛选 */
  onClearFilter?: () => void
}

export function ColumnHeaderMenu({
  canSort,
  currentSortDir,
  canHide,
  filterContent,
  onSortAsc,
  onSortDesc,
  onHide,
  onClearFilter,
}: ColumnHeaderMenuProps) {
  return (
    <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-2 shadow-lg">
      {canSort && (
        <div className="mb-2 flex gap-1">
          <button
            type="button"
            onClick={onSortAsc}
            className={`rounded px-2 py-1 text-xs ${
              currentSortDir === 'asc'
                ? 'bg-[var(--accent)] text-black'
                : 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]'
            }`}
          >
            升序
          </button>
          <button
            type="button"
            onClick={onSortDesc}
            className={`rounded px-2 py-1 text-xs ${
              currentSortDir === 'desc'
                ? 'bg-[var(--accent)] text-black'
                : 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]'
            }`}
          >
            降序
          </button>
        </div>
      )}

      {filterContent && (
        <div className="mb-2 space-y-2">
          {filterContent}
          {onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              清除当前列筛选
            </button>
          )}
        </div>
      )}

      {canHide && (
        <button
          type="button"
          onClick={onHide}
          className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)]"
        >
          隐藏此列
        </button>
      )}
    </div>
  )
}
