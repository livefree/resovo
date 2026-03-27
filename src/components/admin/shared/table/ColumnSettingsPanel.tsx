/**
 * ColumnSettingsPanel — 统一列设置面板（CHG-251）
 *
 * 纯 UI 组件：渲染列显示/隐藏复选框列表 + 重置按钮。
 * 状态由调用方持有（controlled）。
 */

export interface ColumnSettingItem {
  id: string
  label: string
  visible: boolean
  /** 必选列：显示 checkbox 但禁用，不可隐藏 */
  required?: boolean
}

interface ColumnSettingsPanelProps {
  columns: ColumnSettingItem[]
  onToggle: (id: string) => void
  onReset: () => void
  'data-testid'?: string
}

export function ColumnSettingsPanel({
  columns,
  onToggle,
  onReset,
  'data-testid': testId,
}: ColumnSettingsPanelProps) {
  return (
    <div
      className="rounded border border-[var(--border)] bg-[var(--bg2)] p-2"
      data-testid={testId}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--muted)]">显示列</span>
        <button
          type="button"
          className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
          onClick={onReset}
          data-testid={testId ? `${testId}-reset` : undefined}
        >
          重置
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {columns.map((column) => (
          <label
            key={column.id}
            className="flex items-center gap-2 text-xs text-[var(--text)]"
          >
            <input
              type="checkbox"
              checked={column.visible}
              disabled={column.required}
              onChange={() => onToggle(column.id)}
              className="accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={testId ? `${testId}-toggle-${column.id}` : undefined}
            />
            {column.label}
          </label>
        ))}
      </div>
    </div>
  )
}
