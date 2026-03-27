/**
 * AdminBatchBar — thin wrapper over SelectionActionBar (inline variant)
 * Kept for backward compatibility; prefer SelectionActionBar directly.
 */
import { SelectionActionBar } from './SelectionActionBar'
import type { SelectionAction } from './SelectionActionBar'

interface AdminBatchBarProps {
  selectedCount: number
  actions: SelectionAction[]
}

export function AdminBatchBar({ selectedCount, actions }: AdminBatchBarProps) {
  return (
    <SelectionActionBar
      selectedCount={selectedCount}
      actions={actions}
      variant="inline"
    />
  )
}
