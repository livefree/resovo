/**
 * SelectionActionBar — 统一批量操作栏（CHG-255）
 *
 * variant="inline"        嵌入工具栏 fragment（替换 AdminBatchBar）
 * variant="sticky-bottom" 页面底部 sticky 浮层（给 BatchPublishBar 布局层使用）
 */

export interface SelectionAction {
  key: string
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface SelectionActionBarProps {
  selectedCount: number
  actions: SelectionAction[]
  variant: 'inline' | 'sticky-bottom'
  'data-testid'?: string
}

function ActionButtons({ actions }: { actions: SelectionAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          disabled={action.disabled}
          onClick={action.onClick}
          className={
            action.danger
              ? 'rounded-md border border-red-500/30 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50'
              : 'rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:cursor-not-allowed disabled:opacity-50'
          }
        >
          {action.label}
        </button>
      ))}
    </>
  )
}

export function SelectionActionBar({
  selectedCount,
  actions,
  variant,
  'data-testid': testId,
}: SelectionActionBarProps) {
  if (selectedCount <= 0) return null

  if (variant === 'inline') {
    return (
      <>
        <span className="ml-1 text-xs text-[var(--muted)]">已选 {selectedCount} 项</span>
        <ActionButtons actions={actions} />
      </>
    )
  }

  // sticky-bottom
  return (
    <div
      className="sticky bottom-0 z-10 flex items-center gap-3 rounded-t-lg border-t border-[var(--border)] bg-[var(--bg2)] px-4 py-3 shadow-lg"
      data-testid={testId}
    >
      <span className="text-sm text-[var(--muted)]">已选 {selectedCount} 项</span>
      <div className="flex flex-wrap gap-2">
        <ActionButtons actions={actions} />
      </div>
    </div>
  )
}
