/**
 * UserTable.tsx — 用户管理表格（Client Component）
 * CHG-127: 接入 shared table 基线能力（排序/列显隐/列宽/持久化）
 */

'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Pagination } from '@/components/admin/Pagination'
import { UserActions, type UserRow } from '@/components/admin/users/UserActions'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'
import type { BadgeStatus } from '@/components/admin/StatusBadge'

const PAGE_SIZE = 20

const ROLE_STATUS_MAP: Record<string, BadgeStatus> = {
  admin: 'active',
  moderator: 'pending',
  user: 'inactive',
}

type UserColumnId = 'username' | 'email' | 'role' | 'created_at' | 'status' | 'actions'
type UserTableRow = UserRow

const USER_COLUMNS: AdminColumnMeta[] = [
  { id: 'username', visible: true, width: 180, minWidth: 140, maxWidth: 320, resizable: true },
  { id: 'email', visible: true, width: 260, minWidth: 180, maxWidth: 420, resizable: true },
  { id: 'role', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'created_at', visible: true, width: 130, minWidth: 110, maxWidth: 220, resizable: true },
  { id: 'status', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'actions', visible: true, width: 170, minWidth: 140, maxWidth: 240, resizable: false },
]

const USER_DEFAULT_TABLE_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'created_at', dir: 'desc' },
}

const USER_COLUMN_LABELS: Record<UserColumnId, string> = {
  username: '用户名',
  email: '邮箱',
  role: '角色',
  created_at: '注册时间',
  status: '状态',
  actions: '操作',
}

const USER_SORTABLE_MAP: Record<UserColumnId, boolean> = {
  username: true,
  email: true,
  role: true,
  created_at: true,
  status: true,
  actions: false,
}

function toComparableValue(row: UserTableRow, field: string): string | number {
  switch (field) {
    case 'username':
      return row.username.toLowerCase()
    case 'email':
      return row.email.toLowerCase()
    case 'role':
      return row.role
    case 'created_at':
      return new Date(row.created_at).getTime()
    case 'status':
      return row.banned_at ? 1 : 0
    default:
      return ''
  }
}

export function UserTable() {
  const [users, setUsers] = useState<UserTableRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const columnsState = useAdminTableColumns({
    route: '/admin/users',
    tableId: 'user-table',
    columns: USER_COLUMNS,
    defaultState: USER_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: USER_DEFAULT_TABLE_STATE.sort,
    sortable: USER_SORTABLE_MAP,
  })

  const visibleColumnIds = useMemo(
    () => columnsState.columns.filter((column) => column.visible).map((column) => column.id as UserColumnId),
    [columnsState.columns],
  )

  const sortedUsers = useMemo(() => {
    if (!sortState.sort) return users
    const next = [...users]
    next.sort((a, b) => {
      const va = toComparableValue(a, sortState.sort?.field ?? '')
      const vb = toComparableValue(b, sortState.sort?.field ?? '')
      if (va === vb) return 0
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortState.sort?.dir === 'asc' ? va - vb : vb - va
      }
      const sa = String(va)
      const sb = String(vb)
      return sortState.sort?.dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })
    return next
  }, [users, sortState.sort])

  const fetchUsers = useCallback(
    async (searchVal: string, pageVal: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(pageVal),
          limit: String(PAGE_SIZE),
        })
        if (searchVal) params.set('q', searchVal)
        const res = await apiClient.get<{ data: UserRow[]; total: number }>(`/admin/users?${params}`)
        setUsers(res.data as UserTableRow[])
        setTotal(res.total)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchUsers(search, page)
  }, [fetchUsers, search, page])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      setSearch(val)
    }, 300)
  }

  function renderSortIndicator(columnId: UserColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="user-table" className="space-y-2">
      <AdminToolbar
        className="gap-3"
        actions={(
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="搜索用户名或邮箱…"
              onChange={handleSearchChange}
              className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              data-testid="user-table-search"
            />
          </div>
        )}
      />

      {showColumnsPanel && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg2)] p-2" data-testid="user-columns-panel">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">显示列</span>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => columnsState.resetColumnsMeta()}
              data-testid="user-columns-reset"
            >
              重置
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {columnsState.columns.map((column) => (
              <label key={column.id} className="flex items-center gap-2 text-xs text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => columnsState.toggleColumnVisibility(column.id)}
                  className="accent-[var(--accent)]"
                  data-testid={`user-column-toggle-${column.id}`}
                />
                {USER_COLUMN_LABELS[column.id as UserColumnId]}
              </label>
            ))}
          </div>
        </div>
      )}

      <AdminTableFrame minWidth={980}>
        <thead className="bg-[var(--bg2)] text-[var(--muted)]">
          <tr>
            {visibleColumnIds.map((columnId) => {
              const meta = columnsState.columnsById[columnId]
              const sortable = sortState.isSortable(columnId)
              const isLastVisible = columnId === visibleColumnIds[visibleColumnIds.length - 1]
              return (
                <th key={columnId} className="relative px-4 py-3 text-left" style={{ width: `${meta.width}px` }}>
                  {sortable ? (
                    <button
                      type="button"
                      className="text-left text-sm hover:text-[var(--text)]"
                      onClick={() => sortState.toggleSort(columnId)}
                      data-testid={`user-sort-${columnId}`}
                    >
                      {USER_COLUMN_LABELS[columnId]}
                      {renderSortIndicator(columnId)}
                    </button>
                  ) : (
                    <span className="text-sm">{USER_COLUMN_LABELS[columnId]}</span>
                  )}

                  {isLastVisible && (
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                      onClick={() => setShowColumnsPanel((prev) => !prev)}
                      data-testid="user-columns-toggle"
                      aria-label="列设置"
                      title="列设置"
                    >
                      ⚙
                    </button>
                  )}

                  {meta.resizable && (
                    <button
                      type="button"
                      aria-label={`${USER_COLUMN_LABELS[columnId]}列宽拖拽`}
                      data-testid={`user-resize-${columnId}`}
                      onMouseDown={(event) => columnsState.startResize(columnId, event.clientX)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize before:absolute before:right-0 before:top-0 before:h-full before:w-px before:bg-[var(--border)] hover:bg-[var(--bg3)]/40"
                    />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          <AdminTableState
            isLoading={loading}
            isEmpty={!loading && sortedUsers.length === 0}
            colSpan={visibleColumnIds.length}
            emptyText="暂无数据"
          />

          {!loading &&
            sortedUsers.map((row) => (
              <tr
                key={row.id}
                className="h-[68px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`user-row-${row.id}`}
              >
                {visibleColumnIds.includes('username') && (
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-block max-w-[180px] truncate font-medium text-[var(--text)]" title={row.username}>
                      {row.username}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('email') && (
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-block max-w-[260px] truncate text-[var(--muted)]" title={row.email}>
                      {row.email}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('role') && (
                  <td className="px-4 py-3 align-middle">
                    <StatusBadge status={ROLE_STATUS_MAP[row.role] ?? 'inactive'} />
                  </td>
                )}

                {visibleColumnIds.includes('created_at') && (
                  <td className="px-4 py-3 align-middle text-xs text-[var(--muted)]">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                )}

                {visibleColumnIds.includes('status') && (
                  <td className="px-4 py-3 align-middle">
                    <StatusBadge status={row.banned_at ? 'banned' : 'active'} />
                  </td>
                )}

                {visibleColumnIds.includes('actions') && (
                  <td className="px-4 py-3 align-middle">
                    <UserActions user={row} onRefresh={() => fetchUsers(search, page)} />
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </AdminTableFrame>

      {total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}
    </div>
  )
}
