interface AdminBatchAction {
  key: string
  label: string
  onClick: () => void
  danger?: boolean
}

interface AdminBatchBarProps {
  selectedCount: number
  actions: AdminBatchAction[]
}

export function AdminBatchBar({ selectedCount, actions }: AdminBatchBarProps) {
  if (selectedCount <= 0) {
    return null
  }

  return (
    <>
      <span className="ml-1 text-xs text-[var(--muted)]">已选 {selectedCount} 项</span>
      {actions.map((action) => (
        <button
          key={action.key}
          onClick={action.onClick}
          className={
            action.danger
              ? 'rounded-md border border-red-500/30 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10'
              : 'rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] hover:bg-[var(--bg3)]'
          }
        >
          {action.label}
        </button>
      ))}
    </>
  )
}
