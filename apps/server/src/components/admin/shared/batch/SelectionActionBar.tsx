/**
 * SelectionActionBar — 统一批量操作栏（CHG-255）
 * CHG-264: 扩展 items[].variant 支持多色按钮（primary / success / danger / default）
 *          新增 testId 字段供按钮携带 data-testid；新增 countTestId prop
 *
 * variant="inline"        嵌入工具栏 fragment（替换 AdminBatchBar）
 * variant="sticky-bottom" 页面底部 sticky 浮层（BatchPublishBar / BatchDeleteBar 布局层）
 */

export type SelectionActionVariant = 'default' | 'primary' | 'success' | 'danger'

export interface SelectionAction {
  key: string
  label: string
  onClick: () => void
  /** 按钮颜色语义；未设时退化为 danger 布尔值，再退化为 default */
  variant?: SelectionActionVariant
  /** 向后兼容；新代码请使用 variant='danger' */
  danger?: boolean
  disabled?: boolean
  testId?: string
}

interface SelectionActionBarProps {
  selectedCount: number
  actions: SelectionAction[]
  variant: 'inline' | 'sticky-bottom'
  'data-testid'?: string
  /** 为计数 <span> 附加 data-testid，供父组件测试使用 */
  countTestId?: string
}

const BUTTON_CLASS: Record<SelectionActionVariant, string> = {
  default:
    'rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:cursor-not-allowed disabled:opacity-50',
  primary:
    'rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-medium text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
  success:
    'rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs text-green-300 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'rounded-md border border-red-500/30 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50',
}

function resolveVariant(action: SelectionAction): SelectionActionVariant {
  if (action.variant) return action.variant
  if (action.danger) return 'danger'
  return 'default'
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
          data-testid={action.testId}
          className={BUTTON_CLASS[resolveVariant(action)]}
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
  countTestId,
}: SelectionActionBarProps) {
  if (selectedCount <= 0) return null

  if (variant === 'inline') {
    return (
      <>
        <span className="ml-1 text-xs text-[var(--muted)]" data-testid={countTestId}>
          已选 {selectedCount} 项
        </span>
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
      <span className="text-sm text-[var(--muted)]" data-testid={countTestId}>
        已选 {selectedCount} 项
      </span>
      <div className="flex flex-wrap gap-2">
        <ActionButtons actions={actions} />
      </div>
    </div>
  )
}
