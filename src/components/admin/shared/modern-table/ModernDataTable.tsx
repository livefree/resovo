'use client'

import { useMemo } from 'react'
import { ModernTableBody } from '@/components/admin/shared/modern-table/ModernTableBody'
import { ModernTableHead } from '@/components/admin/shared/modern-table/ModernTableHead'
import { TableSettingsTrigger } from '@/components/admin/shared/modern-table/settings/TableSettingsTrigger'
import type {
  ResolvedTableColumn,
  TableColumn,
  TableSortState,
} from '@/components/admin/shared/modern-table/types'
import type {
  ColumnRuntimeSetting,
} from '@/components/admin/shared/modern-table/settings/types'

const DEFAULT_COLUMN_WIDTH = 160
const DEFAULT_MIN_WIDTH = 72

/** settingsSlot prop：传入时在表格右上角渲染 TableSettingsTrigger */
export interface ModernDataTableSettingsSlot {
  settingsColumns: ColumnRuntimeSetting[]
  onSettingsChange: (
    id: string,
    key: keyof Pick<ColumnRuntimeSetting, 'visible' | 'sortable'>,
    value: boolean,
  ) => void
  onSettingsReset: () => void
}

interface ModernDataTableProps<T> {
  columns: Array<TableColumn<T>>
  rows: T[]
  sort?: TableSortState
  onSortChange?: (nextSort: TableSortState) => void
  onColumnWidthChange?: (columnId: string, nextWidth: number) => void
  loading?: boolean
  loadingText?: string
  emptyText?: string
  scrollTestId?: string
  getRowId?: (row: T, rowIndex: number) => string
  /**
   * 传入时在表格右上角渲染 TableSettingsTrigger（⋮ 按钮 + 浮动设置面板）。
   * 建议与 useTableSettings + applyToColumns 配合使用。
   */
  settingsSlot?: ModernDataTableSettingsSlot
  /** 已选中行 ID 集合；传入时启用行选择（全选 checkbox + 行级 checkbox） */
  selectedIds?: string[]
  /** 行选择变更回调（接收新的完整 ID 集合） */
  onSelectionChange?: (ids: string[]) => void
}

function getDefaultWidthByColumnId(columnId: string): number {
  const normalized = columnId.toLowerCase()

  if (normalized === 'id' || normalized.endsWith('_id')) {
    return 80
  }

  if (normalized.includes('status')) {
    return 100
  }

  if (
    normalized.includes('date')
    || normalized.includes('time')
    || normalized.includes('created')
    || normalized.includes('updated')
    || normalized.endsWith('_at')
  ) {
    return 160
  }

  if (normalized.includes('title') || normalized.includes('url')) {
    return 300
  }

  return DEFAULT_COLUMN_WIDTH
}

function resolveColumnMeta<T>(column: TableColumn<T>): ResolvedTableColumn<T> {
  const minWidth = column.minWidth ?? DEFAULT_MIN_WIDTH
  const width = Math.max(column.width ?? getDefaultWidthByColumnId(column.id), minWidth)

  return {
    ...column,
    width,
    minWidth,
    enableResizing: column.enableResizing ?? true,
    enableSorting: column.enableSorting ?? false,
  }
}

function defaultGetRowId<T>(_row: T, rowIndex: number): string {
  return String(rowIndex)
}

export function ModernDataTable<T>({
  columns,
  rows,
  sort,
  onSortChange,
  onColumnWidthChange,
  loading = false,
  loadingText,
  emptyText,
  scrollTestId,
  getRowId = defaultGetRowId,
  settingsSlot,
  selectedIds,
  onSelectionChange,
}: ModernDataTableProps<T>) {
  const resolvedColumns = useMemo(
    () => columns.map((column) => resolveColumnMeta(column)),
    [columns],
  )

  const allRowIds = useMemo(
    () => rows.map((row, rowIndex) => getRowId(row, rowIndex)),
    [rows, getRowId],
  )

  const handleRowSelect = selectedIds !== undefined
    ? (id: string, checked: boolean) => {
        if (!onSelectionChange) return
        if (checked) {
          onSelectionChange([...selectedIds, id])
        } else {
          onSelectionChange(selectedIds.filter((x) => x !== id))
        }
      }
    : undefined

  const handleSelectAll = selectedIds !== undefined
    ? (checked: boolean) => {
        onSelectionChange?.(checked ? allRowIds : [])
      }
    : undefined

  const tableWidth = useMemo(
    () => Math.max(1, resolvedColumns.reduce((sum, column) => sum + column.width, 0)) + (selectedIds !== undefined ? 40 : 0),
    [resolvedColumns, selectedIds],
  )

  // Derive onHideColumn from settingsSlot so column menus can hide columns
  const onHideColumn = settingsSlot
    ? (id: string) => settingsSlot.onSettingsChange(id, 'visible', false)
    : undefined

  // hasSorting: whether this table supports sorting (controls sortable checkbox visibility)
  const hasSorting = typeof onSortChange === 'function'

  return (
    <div className="relative">
      {settingsSlot && (
        <div className="absolute right-2 top-2 z-30">
          <TableSettingsTrigger
            columns={settingsSlot.settingsColumns}
            onToggle={settingsSlot.onSettingsChange}
            onReset={settingsSlot.onSettingsReset}
            hasSorting={hasSorting}
            data-testid={scrollTestId ? `${scrollTestId}-settings` : undefined}
          />
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)]">
        <div className="overflow-x-auto" data-testid={scrollTestId}>
          <table
            className="min-w-full table-fixed text-sm [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-20"
            data-testid="modern-data-table-table"
            style={{ width: `${tableWidth}px` }}
          >
            <ModernTableHead
              columns={resolvedColumns}
              sort={sort}
              onSortChange={onSortChange}
              onColumnWidthChange={onColumnWidthChange}
              onHideColumn={onHideColumn}
              allRowIds={selectedIds !== undefined ? allRowIds : undefined}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
            />
            <ModernTableBody
              columns={resolvedColumns}
              rows={rows}
              loading={loading}
              loadingText={loadingText}
              emptyText={emptyText}
              getRowId={getRowId}
              selectedIds={selectedIds}
              onRowSelect={handleRowSelect}
            />
          </table>
        </div>
      </div>
    </div>
  )
}
