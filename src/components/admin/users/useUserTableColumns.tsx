/**
 * useUserTableColumns.tsx — 用户管理表格列定义（CHG-261）
 * 列：用户名 / 邮箱 / 角色 / 注册时间 / 状态 / 操作（UserActions + AdminDropdown）
 */

'use client'

import { useMemo } from 'react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { UserActions, type UserRow } from '@/components/admin/users/UserActions'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import type { AdminColumnMeta, AdminResolvedColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import type { BadgeStatus } from '@/components/admin/StatusBadge'

export type { UserRow }

export type UserColumnId = 'username' | 'email' | 'role' | 'created_at' | 'status' | 'actions'

export const USER_COLUMN_LABELS: Record<UserColumnId, string> = {
  username: '用户名',
  email: '邮箱',
  role: '角色',
  created_at: '注册时间',
  status: '状态',
  actions: '操作',
}

export const USER_SORTABLE_MAP: Record<UserColumnId, boolean> = {
  username: true,
  email: true,
  role: true,
  created_at: true,
  status: true,
  actions: false,
}

export const USER_COLUMNS_META: AdminColumnMeta[] = [
  { id: 'username', visible: true, width: 180, minWidth: 140, maxWidth: 320, resizable: true },
  { id: 'email', visible: true, width: 260, minWidth: 180, maxWidth: 420, resizable: true },
  { id: 'role', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'created_at', visible: true, width: 130, minWidth: 110, maxWidth: 220, resizable: true },
  { id: 'status', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'actions', visible: true, width: 170, minWidth: 140, maxWidth: 240, resizable: false },
]

export const USER_DEFAULT_TABLE_STATE = {
  sort: { field: 'created_at', dir: 'desc' as const },
}

const ROLE_STATUS_MAP: Record<string, BadgeStatus> = {
  admin: 'active',
  moderator: 'pending',
  user: 'inactive',
}

interface UseUserTableColumnsOptions {
  visibleColumnIds: UserColumnId[]
  columnsById: Record<string, AdminResolvedColumnMeta>
  onRefresh: () => void
}

export function useUserTableColumns({
  visibleColumnIds,
  columnsById,
  onRefresh,
}: UseUserTableColumnsOptions): TableColumn<UserRow>[] {
  return useMemo((): TableColumn<UserRow>[] => {
    const all: TableColumn<UserRow>[] = [
      {
        id: 'username',
        header: USER_COLUMN_LABELS.username,
        accessor: (row) => row.username,
        width: columnsById['username']?.width ?? 180,
        minWidth: 140,
        enableSorting: USER_SORTABLE_MAP.username,
        enableResizing: true,
        cell: ({ row }) => (
          <span
            className="inline-block max-w-[180px] truncate font-medium text-[var(--text)]"
            title={row.username}
          >
            {row.username}
          </span>
        ),
      },
      {
        id: 'email',
        header: USER_COLUMN_LABELS.email,
        accessor: (row) => row.email,
        width: columnsById['email']?.width ?? 260,
        minWidth: 180,
        enableSorting: USER_SORTABLE_MAP.email,
        enableResizing: true,
        cell: ({ row }) => (
          <span
            className="inline-block max-w-[260px] truncate text-[var(--muted)]"
            title={row.email}
          >
            {row.email}
          </span>
        ),
      },
      {
        id: 'role',
        header: USER_COLUMN_LABELS.role,
        accessor: (row) => row.role,
        width: columnsById['role']?.width ?? 110,
        minWidth: 90,
        enableSorting: USER_SORTABLE_MAP.role,
        enableResizing: true,
        cell: ({ row }) => (
          <StatusBadge status={ROLE_STATUS_MAP[row.role] ?? 'inactive'} />
        ),
      },
      {
        id: 'created_at',
        header: USER_COLUMN_LABELS.created_at,
        accessor: (row) => row.created_at,
        width: columnsById['created_at']?.width ?? 130,
        minWidth: 110,
        enableSorting: USER_SORTABLE_MAP.created_at,
        enableResizing: true,
        cell: ({ row }) => (
          <span className="text-xs text-[var(--muted)]">
            {new Date(row.created_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'status',
        header: USER_COLUMN_LABELS.status,
        accessor: (row) => row.banned_at ?? '',
        width: columnsById['status']?.width ?? 110,
        minWidth: 90,
        enableSorting: USER_SORTABLE_MAP.status,
        enableResizing: true,
        cell: ({ row }) => (
          <StatusBadge status={row.banned_at ? 'banned' : 'active'} />
        ),
      },
      {
        id: 'actions',
        header: USER_COLUMN_LABELS.actions,
        accessor: () => null,
        width: columnsById['actions']?.width ?? 170,
        minWidth: 140,
        enableSorting: false,
        enableResizing: false,
        overflowVisible: true,
        cell: ({ row }) => (
          <UserActions user={row} onRefresh={onRefresh} />
        ),
      },
    ]

    return all.filter((col) => visibleColumnIds.includes(col.id as UserColumnId))
  }, [visibleColumnIds, columnsById, onRefresh])
}
