'use client'

/**
 * UsersListClient.tsx — `/admin/users` 用户管理视图主组件
 * （M-SN-5 / SEQ-20260512-02 / CHG-SN-5-03）
 *
 * 范围：列表 + role/banned 筛选 + 搜索 + 行级封禁/解封 + 角色变更。
 * 端点：apps/api/src/routes/admin/users.ts（5 端点消费，零新端点）。
 *
 * 原语消费（5/6）：
 *   - PageHeader（page__head 统一壳）
 *   - AdminButton（刷新）
 *   - AdminInput（搜索框 in toolbar.search 槽）
 *   - AdminSelect（role 筛选 + banned 筛选）
 *   - Popover（角色变更弹层 — in UserRolePopover）
 *   - AdminCard — 跳过（无典型 dashboard 统计卡场景）
 *
 * 硬约束（SEQ-20260512-02）：
 *   - 零 admin-ui 通用组件 props 反向扩展
 *   - 零本地新建 admin-ui 通用组件
 *   - DataTable 一体化（不复用 ModernDataTable / 外置 PaginationV2 / 外置 SelectionActionBar）
 */

import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from 'react'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  AdminInput,
  AdminSelect,
  useToast,
  type AdminSelectOption,
  type TableSortState,
} from '@resovo/admin-ui'
import {
  listUsers,
  banUser,
  unbanUser,
  updateUserRole,
} from '@/lib/users/api'
import type { UserRow, UserRole } from '@/lib/users/types'
import { buildUserColumns } from './columns'

// ── 常量 ──────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20

const ROLE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'user', label: '用户' },
  { value: 'moderator', label: '版主' },
  { value: 'admin', label: '管理员' },
]

const BANNED_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'false', label: '正常' },
  { value: 'true', label: '已封禁' },
]

// ── 主组件 ────────────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

const TOOLBAR_LEFT_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
}

export function UsersListClient() {
  const toast = useToast()
  const [rows, setRows] = useState<readonly UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<TableSortState>({ field: 'created_at', direction: 'desc' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState<string | undefined>()
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [bannedFilter, setBannedFilter] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 搜索 debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQ(searchInput.trim() || undefined)
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    listUsers({
      q,
      role: roleFilter as UserRole | undefined,
      banned: bannedFilter as 'true' | 'false' | undefined,
      page,
      limit: pageSize,
      sortField: sort.field,
      sortDir: sort.direction,
    })
      .then((res) => {
        if (cancelled) return
        setRows(res.data)
        setTotal(res.total)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [q, roleFilter, bannedFilter, page, pageSize, sort, retryKey])

  const refresh = useCallback(() => {
    setRetryKey((k) => k + 1)
  }, [])

  const handleBan = useCallback(async (id: string) => {
    setPendingId(id)
    try {
      await banUser(id)
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '封禁失败',
        description: err instanceof Error ? err.message : '操作失败，请稍后重试',
        level: 'danger',
      })
    } finally {
      setPendingId(null)
    }
  }, [refresh, toast])

  const handleUnban = useCallback(async (id: string) => {
    setPendingId(id)
    try {
      await unbanUser(id)
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '解封失败',
        description: err instanceof Error ? err.message : '操作失败，请稍后重试',
        level: 'danger',
      })
    } finally {
      setPendingId(null)
    }
  }, [refresh, toast])

  const handleRoleChange = useCallback(async (id: string, role: 'user' | 'moderator') => {
    setPendingId(id)
    try {
      await updateUserRole(id, role)
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '角色变更失败',
        description: err instanceof Error ? err.message : '操作失败，请稍后重试',
        level: 'danger',
      })
    } finally {
      setPendingId(null)
    }
  }, [refresh, toast])

  const columns = useMemo(
    () => buildUserColumns({
      onBan: (id) => void handleBan(id),
      onUnban: (id) => void handleUnban(id),
      onRoleChange: (id, role) => void handleRoleChange(id, role),
      pendingId,
    }),
    [handleBan, handleUnban, handleRoleChange, pendingId],
  )

  const query = useMemo(
    () => ({
      pagination: { page, pageSize },
      sort,
      filters: new Map(),
      columns: new Map(),
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [page, pageSize, sort],
  )

  const hasFilter = searchInput || roleFilter || bannedFilter

  const toolbarSearch = (
    <span style={TOOLBAR_LEFT_STYLE} data-testid="users-toolbar-filters">
      <AdminInput
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="搜索用户名 / 邮箱"
        size="sm"
        data-testid="users-search-input"
        aria-label="搜索用户"
      />
      <AdminSelect
        options={ROLE_OPTIONS}
        value={roleFilter}
        onChange={(v) => { setRoleFilter(v); setPage(1) }}
        placeholder="全部角色"
        size="sm"
        data-testid="users-filter-role"
        aria-label="按角色筛选"
      />
      <AdminSelect
        options={BANNED_OPTIONS}
        value={bannedFilter}
        onChange={(v) => { setBannedFilter(v); setPage(1) }}
        placeholder="全部状态"
        size="sm"
        data-testid="users-filter-banned"
        aria-label="按封禁状态筛选"
      />
      {hasFilter ? (
        <AdminButton
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearchInput('')
            setRoleFilter(null)
            setBannedFilter(null)
            setPage(1)
          }}
          data-testid="users-filter-clear"
        >
          清空筛选
        </AdminButton>
      ) : null}
    </span>
  )

  return (
    <div data-users-list-client style={PAGE_STYLE}>
      <PageHeader
        title="用户管理"
        subtitle={`共 ${total} 位用户`}
        actions={
          <AdminButton
            variant="default"
            size="sm"
            onClick={refresh}
            data-testid="users-refresh"
          >
            刷新
          </AdminButton>
        }
        data-testid="users-page-header"
      />
      {loading && rows.length === 0
        ? <LoadingState variant="skeleton" />
        : error
          ? <ErrorState error={error} title="加载失败" onRetry={refresh} />
          : (
              <DataTable<UserRow>
                rows={rows}
                columns={columns}
                rowKey={(r) => r.id}
                mode="server"
                query={query}
                onQueryChange={(patch) => {
                  if (patch.pagination) {
                    if (patch.pagination.page !== undefined) setPage(patch.pagination.page)
                    if (patch.pagination.pageSize !== undefined) {
                      setPageSize(patch.pagination.pageSize)
                      setPage(1)
                    }
                  }
                  if (patch.sort) setSort(patch.sort)
                }}
                totalRows={total}
                loading={loading}
                emptyState={<EmptyState title="暂无用户" description="调整筛选条件后重试" />}
                data-testid="users-table"
                enableHeaderMenu
                toolbar={{
                  search: toolbarSearch,
                  hideFilterChips: true,
                }}
                pagination={{ pageSizeOptions: [10, 20, 50] }}
              />
            )
      }
    </div>
  )
}
