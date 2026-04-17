/**
 * TableSettingsPanel — 纯 UI 组件，矩阵布局展示列设置
 *
 * 每行对应一列，显示 visible / sortable 两个开关。
 * 状态由调用方（TableSettingsTrigger）持有，本组件为 controlled。
 */

import type { ColumnRuntimeSetting } from './types'

interface TableSettingsPanelProps {
  columns: ColumnRuntimeSetting[]
  onToggle: (
    id: string,
    key: keyof Pick<ColumnRuntimeSetting, 'visible' | 'sortable'>,
    value: boolean,
  ) => void
  onReset: () => void
  /**
   * 当前表格是否支持排序（即 ModernDataTable 是否传入了 onSortChange）。
   * false 时隐藏矩阵列头的"排序"列和每行的 sortable checkbox，避免用户误操作。
   * 默认 true（向后兼容）。
   */
  hasSorting?: boolean
  'data-testid'?: string
}

export function TableSettingsPanel({
  columns,
  onToggle,
  onReset,
  hasSorting = true,
  'data-testid': testId,
}: TableSettingsPanelProps) {
  const gridCols = hasSorting ? '1fr auto auto' : '1fr auto'

  return (
    <div
      className="rounded border border-[var(--border)] bg-[var(--bg2)] p-3"
      data-testid={testId}
    >
      {/* 面板头部 */}
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-[var(--text)]">列设置</span>
        <button
          type="button"
          className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
          onClick={onReset}
          data-testid={testId ? `${testId}-reset` : undefined}
        >
          重置
        </button>
      </div>

      {/* 矩阵列头 */}
      <div
        className="mb-1 grid gap-x-4 text-[10px] text-[var(--muted)]"
        style={{ gridTemplateColumns: gridCols }}
      >
        <span />
        <span className="text-center">显示</span>
        {hasSorting && <span className="text-center">排序</span>}
      </div>

      {/* 列行 */}
      <div className="flex flex-col gap-1">
        {columns.map((col) => (
          <div
            key={col.id}
            className="grid items-center gap-x-4"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span className="truncate text-xs text-[var(--text)]">{col.label}</span>

            {/* visible 开关 */}
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={col.visible}
                disabled={col.required}
                onChange={(e) => onToggle(col.id, 'visible', e.target.checked)}
                className="accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                data-testid={testId ? `${testId}-visible-${col.id}` : undefined}
              />
            </div>

            {/* sortable 开关：仅当表格支持排序时渲染 */}
            {hasSorting && (
              <div className="flex justify-center">
                <input
                  type="checkbox"
                  checked={col.sortable}
                  onChange={(e) => onToggle(col.id, 'sortable', e.target.checked)}
                  className="accent-[var(--accent)]"
                  data-testid={testId ? `${testId}-sortable-${col.id}` : undefined}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
