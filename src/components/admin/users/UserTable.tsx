/**
 * UserTable.tsx — 用户管理表格（Client Component）
 * CHG-261: 迁移至 ModernDataTable + PaginationV2 + 服务端排序 + AdminDropdown 行操作
 */

'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { ColumnSettingsPanel } from '@/components/admin/shared/table/ColumnSettingsPanel'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import { useAdminTableColumns } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import {
  useUserTableColumns,
  USER_COLUMN_LABELS,
  USER_SORTABLE_MAP,
  USER_COLUMNS_META,
  USER_DEFAULT_TABLE_STATE,
  type UserRow,
  type UserColumnId,
} from './useUserTableColumns'

const DEFAULT_PAGE_SIZE = 20

export function UserTable() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const columnsState = useAdminTableColumns({
    route: '/admin/users',
    tableId: 'user-table',
    columns: USER_COLUMNS_META,
    defaultState: USER_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: USER_DEFAULT_TABLE_STATE.sort,
    sortable: USER_SORTABLE_MAP,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((col) => col.visible)
        .map((col) => col.id as UserColumnId),
    [columnsState.columns],
  )

  const sort = useMemo<TableSortState | undefined>(() => {
    if (!sortState.sort) return undefined
    return { field: sortState.sort.field, direction: sortState.sort.dir }
  }, [sortState.sort])

  const fetchUsers = useCallback(async (searchVal: string, pageVal: number, pageSizeVal: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageVal),
        limit: String(pageSizeVal),
      })
      if (searchVal) params.set('q', searchVal)
      if (sortState.sort) {
        params.set('sortField', sortState.sort.field)
        params.set('sortDir', sortState.sort.dir)
      }
      const res = await apiClient.get<{ data: UserRow[]; total: number }>(`/admin/users?${params}`)
      setUsers(res.data)
      setTotal(res.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [sortState.sort])

  useEffect(() => {
    setPage(1)
    void fetchUsers(search, 1, pageSize)
  }, [sortState.sort, pageSize, fetchUsers, search])

  const tableColumns = useUserTableColumns({
    visibleColumnIds,
    columnsById: columnsState.columnsById,
    onRefresh: useCallback(() => { void fetchUsers(search, page, pageSize) }, [fetchUsers, search, page, pageSize]),
  })

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      setSearch(val)
    }, 300)
  }

  return (
    <div data-testid="user-table" className="space-y-2">
      {/* 搜索栏 */}
      <div className="flex items-center">
        <input
          type="text"
          placeholder="搜索用户名或邮箱…"
          onChange={handleSearchChange}
          className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="user-table-search"
        />
      </div>

      {/* ⚙ 列设置叠加在表格右上角，面板在 overflow-hidden 外渲染 */}
      <div className="relative">
        <div className="absolute right-4 top-3 z-30">
          <button
            type="button"
            className="rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            onClick={() => setShowColumnsPanel((prev) => !prev)}
            data-testid="user-columns-toggle"
            aria-label="列设置"
            title="列设置"
          >⚙</button>
          {showColumnsPanel ? (
            <div className="absolute right-0 mt-1 w-52">
              <ColumnSettingsPanel
                data-testid="user-columns-panel"
                columns={columnsState.columns.map((col) => ({
                  id: col.id,
                  label: USER_COLUMN_LABELS[col.id as UserColumnId] ?? col.id,
                  visible: col.visible,
                }))}
                onToggle={(id) => columnsState.toggleColumnVisibility(id)}
                onReset={() => columnsState.resetColumnsMeta()}
              />
            </div>
          ) : null}
        </div>

        <ModernDataTable
          columns={tableColumns}
          rows={users}
          sort={sort}
          onSortChange={(nextSort) => {
            sortState.setSort(nextSort.field, nextSort.direction === 'asc' ? 'asc' : 'desc')
          }}
          onColumnWidthChange={(columnId, nextWidth) => {
            if (columnId in columnsState.columnsById) {
              columnsState.setColumnWidth(columnId, nextWidth)
            }
          }}
          loading={loading}
          emptyText="暂无数据"
          scrollTestId="user-table-scroll"
          getRowId={(row) => row.id}
        />
      </div>

      {total > 0 ? (
        <div className="mt-4">
          <PaginationV2
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={(nextPage) => { setPage(nextPage); void fetchUsers(search, nextPage, pageSize) }}
            onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); void fetchUsers(search, 1, nextSize) }}
          />
        </div>
      ) : null}
    </div>
  )
}
