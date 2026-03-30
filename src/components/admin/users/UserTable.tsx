/**
 * UserTable.tsx — 用户管理表格（Client Component）
 * CHG-261: 迁移至 ModernDataTable + PaginationV2 + 服务端排序 + AdminDropdown 行操作
 */

'use client'

import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import { useAdminTableColumns } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import {
  useUserTableColumns,
  USER_COLUMN_LABELS,
  USER_SORTABLE_MAP,
  USER_COLUMNS_META,
  USER_DEFAULT_TABLE_STATE,
  type UserRow,
  type UserColumnId,
} from './useUserTableColumns'

// 所有列 ID（useTableSettings 控制显/隐，useUserTableColumns 构建全集）
const ALL_USER_COLUMN_IDS = USER_COLUMNS_META.map((col) => col.id as UserColumnId)

// useTableSettings 列描述（label + 默认可见/可排序）
const USER_SETTINGS_COLUMNS = USER_COLUMNS_META.map((col) => ({
  id: col.id,
  label: USER_COLUMN_LABELS[col.id as UserColumnId] ?? col.id,
  defaultVisible: col.visible ?? true,
  defaultSortable: USER_SORTABLE_MAP[col.id as UserColumnId] ?? false,
  required: col.id === 'actions', // 操作列不可隐藏
}))

const DEFAULT_PAGE_SIZE = 20

export function UserTable() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const columnsState = useAdminTableColumns({
    route: '/admin/users',
    tableId: 'user-table',
    columns: USER_COLUMNS_META,
    defaultState: USER_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    defaultSort: USER_DEFAULT_TABLE_STATE.sort,
    sortable: USER_SORTABLE_MAP,
  })

  const tableSettings = useTableSettings({
    tableId: 'user-table',
    columns: USER_SETTINGS_COLUMNS,
  })

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

  const allTableColumns = useUserTableColumns({
    visibleColumnIds: ALL_USER_COLUMN_IDS,
    columnsById: columnsState.columnsById,
    onRefresh: useCallback(() => { void fetchUsers(search, page, pageSize) }, [fetchUsers, search, page, pageSize]),
  })

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

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

      <ModernDataTable
        columns={tableColumns}
        rows={users}
        sort={sort}
        onSortChange={(nextSort) => {
          sortState.setSort(nextSort.field, nextSort.direction === 'asc' ? 'asc' : 'desc')
        }}
        onColumnWidthChange={tableSettings.updateWidth}
        loading={loading}
        emptyText="暂无数据"
        scrollTestId="user-table-scroll"
        getRowId={(row) => row.id}
        settingsSlot={{
          settingsColumns: tableSettings.orderedSettings,
          onSettingsChange: tableSettings.updateSetting,
          onSettingsReset: tableSettings.reset,
        }}
      />

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
