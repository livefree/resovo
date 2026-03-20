import { ColumnFilterPanel } from '@/components/admin/system/crawler-site/components/ColumnFilterPanel'
import type { ColumnId, FilterState, SortDir, SortField } from '@/components/admin/system/crawler-site/tableState'

interface ColumnMenuProps {
  columnId: ColumnId
  filters: FilterState
  canSort: boolean
  canFilter: boolean
  canHide: boolean
  sortBy: SortField
  sortDir: SortDir
  onSortAsc: () => void
  onSortDesc: () => void
  onClearFilter: () => void
  onHideColumn: () => void
  onPatchFilter: (patch: Partial<FilterState>) => void
}

export function ColumnMenu({
  columnId,
  filters,
  canSort,
  canFilter,
  canHide,
  sortBy,
  sortDir,
  onSortAsc,
  onSortDesc,
  onClearFilter,
  onHideColumn,
  onPatchFilter,
}: ColumnMenuProps) {
  return (
    <div className="absolute right-2 top-full z-30 mt-1 w-52 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-2 shadow-lg">
      {canSort && (
        <div className="mb-2 flex gap-1">
          <button
            type="button"
            onClick={onSortAsc}
            className={`rounded px-2 py-1 text-xs ${sortBy === columnId && sortDir === 'asc' ? 'bg-[var(--accent)] text-black' : 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]'}`}
          >
            升序
          </button>
          <button
            type="button"
            onClick={onSortDesc}
            className={`rounded px-2 py-1 text-xs ${sortBy === columnId && sortDir === 'desc' ? 'bg-[var(--accent)] text-black' : 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]'}`}
          >
            降序
          </button>
        </div>
      )}

      {canFilter && (
        <div className="mb-2 space-y-2">
          <ColumnFilterPanel columnId={columnId} filters={filters} onPatch={onPatchFilter} />
          <button
            type="button"
            onClick={onClearFilter}
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
          >
            清除当前列筛选
          </button>
        </div>
      )}

      {canHide && (
        <button
          type="button"
          onClick={onHideColumn}
          className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)]"
        >
          隐藏此列
        </button>
      )}
    </div>
  )
}
