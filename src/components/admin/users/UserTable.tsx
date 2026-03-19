/**
 * UserTable.tsx — 用户管理表格（Client Component）
 * CHG-26: DataTable + StatusBadge + Pagination + 搜索 + UserActions
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { apiClient } from '@/lib/api-client'
import { DataTable } from '@/components/admin/DataTable'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Pagination } from '@/components/admin/Pagination'
import { UserActions, type UserRow } from '@/components/admin/users/UserActions'
import type { BadgeStatus } from '@/components/admin/StatusBadge'
import type { Column } from '@/components/admin/DataTable'

const PAGE_SIZE = 20

const ROLE_STATUS_MAP: Record<string, BadgeStatus> = {
  admin: 'active',
  moderator: 'pending',
  user: 'inactive',
}

type UserTableRow = UserRow & Record<string, unknown>

function makeColumns(onRefresh: () => void): Column<UserTableRow>[] {
  return [
    {
      key: 'username',
      title: '用户名',
      render: (row): ReactNode => (
        <span className="font-medium text-[var(--text)]">{row.username}</span>
      ),
    },
    {
      key: 'email',
      title: '邮箱',
      render: (row): ReactNode => (
        <span className="text-[var(--muted)]">{row.email}</span>
      ),
    },
    {
      key: 'role',
      title: '角色',
      render: (row): ReactNode => (
        <StatusBadge status={ROLE_STATUS_MAP[row.role] ?? 'inactive'} />
      ),
    },
    {
      key: 'created_at',
      title: '注册时间',
      render: (row): ReactNode => (
        <span className="text-xs text-[var(--muted)]">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'banned_at',
      title: '状态',
      render: (row): ReactNode => (
        <StatusBadge status={row.banned_at ? 'banned' : 'active'} />
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (row): ReactNode => (
        <UserActions user={row} onRefresh={onRefresh} />
      ),
    },
  ]
}

export function UserTable() {
  const [users, setUsers] = useState<UserTableRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(
    async (searchVal: string, pageVal: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(pageVal),
          limit: String(PAGE_SIZE),
        })
        if (searchVal) params.set('q', searchVal)
        const res = await apiClient.get<{ data: UserRow[]; total: number }>(
          `/admin/users?${params}`
        )
        setUsers(res.data as UserTableRow[])
        setTotal(res.total)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    },
    []
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

  const columns = makeColumns(() => fetchUsers(search, page))

  return (
    <div data-testid="user-table">
      <div className="mb-4">
        <input
          type="text"
          placeholder="搜索用户名或邮箱…"
          onChange={handleSearchChange}
          className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="user-table-search"
        />
      </div>

      <DataTable<UserTableRow>
        columns={columns}
        data={users}
        isLoading={loading}
      />

      {total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
