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

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  KpiCard,
  useToast,
  type ColumnPreference,
  type DistinctOption,
  type FilterValue,
  type TableSortState,
  type TableSelectionState,
} from '@resovo/admin-ui'
import {
  listUsers,
  banUser,
  unbanUser,
  updateUserRole,
  fetchUsersStats,
  batchBanUsers,
  batchUnbanUsers,
} from '@/lib/users/api'
import type { UserRow, UserRole, UserStats } from '@/lib/users/types'
import { buildUserColumns } from './columns'
import { downloadCsv, type CsvColumn } from '@/lib/csv-export'
import { RoleMatrixModal } from './RoleMatrixModal'
import { InviteUserModal } from './InviteUserModal'
import { ResetPasswordModal } from './ResetPasswordModal'
import { EditEmailModal } from './EditEmailModal'
import { EditProfileModal } from './EditProfileModal'

// ── 常量 ──────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20

// sub B（2026-05-24）：AdminSelectOption → DistinctOption（D-150-1 enum filter 静态选项注入）
const ROLE_OPTIONS: readonly DistinctOption[] = [
  { value: 'user', label: '用户' },
  { value: 'moderator', label: '版主' },
  { value: 'admin', label: '管理员' },
]

const BANNED_OPTIONS: readonly DistinctOption[] = [
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

const KPI_ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '12px',
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
  // sub B（2026-05-24）：4 filter state + 1 debounce 合并为 filtersMap
  // ADR-150 D-150-4 业务 key 桥接：'q' (column.id=username) / 'role' / 'banned'
  const [filtersMap, setFiltersMap] = useState<ReadonlyMap<string, FilterValue>>(new Map())
  const [columnPrefs, setColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [roleMatrixOpen, setRoleMatrixOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [resetPwdTarget, setResetPwdTarget] = useState<UserRow | null>(null)
  const [editEmailTarget, setEditEmailTarget] = useState<UserRow | null>(null)
  const [editProfileTarget, setEditProfileTarget] = useState<UserRow | null>(null)
  // CHG-SN-8-FUP-USERS-BATCH-BAN-UI / ADR-143 消费侧 — DataTable 原生 selection 范式
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [batchPending, setBatchPending] = useState(false)

  // sub B：filtersMap 派生 3 参数（DataTableAutoFilter "应用"按钮一次性 commit / 无需 debounce）
  const qFilter = useMemo<string | undefined>(() => {
    const v = filtersMap.get('q')
    return v?.kind === 'text' && v.value ? v.value.trim() : undefined
  }, [filtersMap])
  const roleFilter = useMemo<UserRole | undefined>(() => {
    const v = filtersMap.get('role')
    return v?.kind === 'enum' && v.value.length > 0 ? (v.value[0] as UserRole) : undefined
  }, [filtersMap])
  const bannedFilter = useMemo<'true' | 'false' | undefined>(() => {
    const v = filtersMap.get('banned')
    if (v?.kind !== 'enum' || v.value.length === 0) return undefined
    const first = v.value[0]
    return first === 'true' || first === 'false' ? first : undefined
  }, [filtersMap])

  useEffect(() => {
    let cancelled = false
    fetchUsersStats()
      .then((s) => { if (!cancelled) setStats(s) })
      .catch(() => { /* stats 加载失败不阻断主列表 */ })
    return () => { cancelled = true }
  }, [retryKey])

  // sub B：删 debounce useEffect / DataTableAutoFilter 应用按钮一次性 commit

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    listUsers({
      q: qFilter,
      role: roleFilter,
      banned: bannedFilter,
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
  }, [qFilter, roleFilter, bannedFilter, page, pageSize, sort, retryKey])

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

  const handleInvite = useCallback(async (_email: string, _role: 'user' | 'moderator') => {
    // 邀请端点待 ADR 起草后接入（CHG-SN-7-MISC-USERS-1）
    toast.push({
      title: '邀请功能待后端接入',
      description: '邀请用户端点将在下一版本实装，请直接在数据库创建账号',
      level: 'info',
    })
  }, [toast])

  const handleResetPassword = useCallback((row: UserRow) => {
    setResetPwdTarget(row)
  }, [])

  const handleEditEmail = useCallback((row: UserRow) => {
    setEditEmailTarget(row)
  }, [])

  const handleEditProfile = useCallback((row: UserRow) => {
    setEditProfileTarget(row)
  }, [])

  // CHG-SN-8-FUP-USERS-BATCH-BAN-UI：onSelectionChange 拦截 admin id（与后端 admin skip 一致，避免无效请求）
  const handleSelectionChange = useCallback((next: TableSelectionState) => {
    const adminIds = new Set(rows.filter((r) => r.role === 'admin').map((r) => r.id))
    const filtered = new Set([...next.selectedKeys].filter((id) => !adminIds.has(id)))
    setSelectedIds(filtered)
  }, [rows])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const handleBatchBan = useCallback(async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确定批量封禁 ${selectedIds.size} 个用户？此操作将立即终止其会话（写 Redis session invalidate）；可通过批量解封恢复。`)) return
    setBatchPending(true)
    try {
      const result = await batchBanUsers([...selectedIds])
      toast.push({
        title: '批量封禁完成',
        description: `成功 ${result.banned} · 跳过 ${result.skipped} · 失败 ${result.failed}`,
        level: result.failed > 0 ? 'warn' : 'success',
      })
      clearSelection()
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '批量封禁失败',
        description: err instanceof Error ? err.message : '操作失败，请稍后重试',
        level: 'danger',
      })
    } finally {
      setBatchPending(false)
    }
  }, [selectedIds, clearSelection, refresh, toast])

  const handleBatchUnban = useCallback(async () => {
    if (selectedIds.size === 0) return
    setBatchPending(true)
    try {
      const result = await batchUnbanUsers([...selectedIds])
      toast.push({
        title: '批量解封完成',
        description: `成功 ${result.unbanned} · 跳过 ${result.skipped} · 失败 ${result.failed}`,
        level: result.failed > 0 ? 'warn' : 'success',
      })
      clearSelection()
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '批量解封失败',
        description: err instanceof Error ? err.message : '操作失败，请稍后重试',
        level: 'danger',
      })
    } finally {
      setBatchPending(false)
    }
  }, [selectedIds, clearSelection, refresh, toast])

  const columns = useMemo(
    () => buildUserColumns({
      onBan: (id) => void handleBan(id),
      onUnban: (id) => void handleUnban(id),
      onRoleChange: (id, role) => void handleRoleChange(id, role),
      onResetPassword: handleResetPassword,
      onEditEmail: handleEditEmail,
      onEditProfile: handleEditProfile,
      pendingId,
      // sub B：filterOptions 静态注入（ADR-150 D-150-1 enum 列）
      roleOptions: ROLE_OPTIONS,
      bannedOptions: BANNED_OPTIONS,
    }),
    [handleBan, handleUnban, handleRoleChange, handleResetPassword, handleEditEmail, handleEditProfile, pendingId],
  )

  const query = useMemo(
    () => ({
      pagination: { page, pageSize },
      sort,
      // sub B：filters 用 filtersMap state（D-150-4 业务 key 桥接）
      filters: filtersMap,
      columns: columnPrefs,
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [page, pageSize, sort, filtersMap, columnPrefs],
  )

  // CHG-SN-6-23：导出当前页 rows 为 CSV
  const handleExportCsv = () => {
    if (rows.length === 0) return
    const columns: readonly CsvColumn<UserRow>[] = [
      { header: 'id',         accessor: (r) => r.id },
      { header: 'username',   accessor: (r) => r.username },
      { header: 'email',      accessor: (r) => r.email },
      { header: 'role',       accessor: (r) => r.role },
      { header: 'banned_at',  accessor: (r) => r.banned_at },
      { header: 'created_at', accessor: (r) => r.created_at },
    ]
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadCsv(rows, columns, `users-${ts}.csv`)
  }

  const toolbarTrailing = (
    <AdminButton
      variant="ghost"
      size="sm"
      onClick={handleExportCsv}
      disabled={rows.length === 0}
      data-testid="users-export-csv"
    >
      导出 CSV
    </AdminButton>
  )

  // sub B（2026-05-24）：toolbarSearch 3 控件 + clear button 全删 / 迁列内 filterable
  // ADR-150 D-150-1 双轨：filtersMap 由 DataTable popover OK 触发 / 矩阵 popover 清空

  return (
    <>
    <RoleMatrixModal open={roleMatrixOpen} onClose={() => setRoleMatrixOpen(false)} />
    <InviteUserModal
      open={inviteOpen}
      onClose={() => setInviteOpen(false)}
      onInvite={handleInvite}
    />
    <ResetPasswordModal
      open={resetPwdTarget != null}
      onClose={() => setResetPwdTarget(null)}
      user={resetPwdTarget}
    />
    <EditEmailModal
      open={editEmailTarget != null}
      onClose={() => setEditEmailTarget(null)}
      user={editEmailTarget}
      onSuccess={refresh}
    />
    <EditProfileModal
      open={editProfileTarget != null}
      onClose={() => setEditProfileTarget(null)}
      user={editProfileTarget ? {
        id: editProfileTarget.id,
        username: editProfileTarget.username,
        displayName: editProfileTarget.display_name,
      } : null}
      onSuccess={refresh}
    />
    <div data-users-list-client style={PAGE_STYLE}>
      <PageHeader
        title="用户管理"
        subtitle={`共 ${total} 位用户`}
        actions={
          <span style={{ display: 'inline-flex', gap: '8px' }}>
            <AdminButton
              variant="default"
              size="sm"
              onClick={() => setRoleMatrixOpen(true)}
              data-testid="users-role-matrix-btn"
            >
              角色矩阵
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              onClick={() => setInviteOpen(true)}
              data-testid="users-invite-btn"
            >
              邀请用户
            </AdminButton>
            {/* CHG-SN-8-FUP-USERS-BATCH-BAN-UI / ADR-143：batch ban/unban 通过表格 checkbox + 底部 bulk action bar 触发
                （DataTable 原生 selection 范式 + admin row 自动屏蔽）；选中后会出现批量操作条 */}
            <AdminButton
              variant="default"
              size="sm"
              onClick={refresh}
              data-testid="users-refresh"
            >
              刷新
            </AdminButton>
          </span>
        }
        data-testid="users-page-header"
      />
      <div style={KPI_ROW_STYLE} data-testid="users-kpi-row">
        <KpiCard
          label="全部用户"
          value={stats ? stats.totalCount.toLocaleString('en-US') : '—'}
          variant="default"
          dataSource={stats ? 'live' : undefined}
          testId="users-kpi-total"
        />
        <KpiCard
          label="今日新增"
          value={stats ? stats.newTodayCount.toLocaleString('en-US') : '—'}
          variant="is-ok"
          dataSource={stats ? 'live' : undefined}
          testId="users-kpi-new-today"
        />
        <KpiCard
          label="已封账号"
          value={stats ? stats.bannedCount.toLocaleString('en-US') : '—'}
          variant="is-danger"
          dataSource={stats ? 'live' : undefined}
          testId="users-kpi-banned"
        />
        <KpiCard
          label="版主"
          value={stats ? stats.moderatorCount.toLocaleString('en-US') : '—'}
          variant="default"
          dataSource={stats ? 'live' : undefined}
          testId="users-kpi-moderator"
        />
      </div>
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
                  // sub B：filters patch（DataTableAutoFilter popover OK 触发 / 矩阵清空）
                  if (patch.filters) { setFiltersMap(patch.filters); setPage(1) }
                  if (patch.columns) setColumnPrefs(patch.columns)
                }}
                totalRows={total}
                loading={loading}
                emptyState={<EmptyState title="暂无用户" description="调整筛选条件后重试" />}
                data-testid="users-table"
                enableHeaderMenu
                enableColumnResizing
                selection={{ selectedKeys: selectedIds, mode: 'page' }}
                onSelectionChange={handleSelectionChange}
                bulkActions={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} data-testid="users-bulk-actions">
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-default)' }}>
                      已选 {selectedIds.size} 个用户
                    </span>
                    <AdminButton
                      variant="danger"
                      size="sm"
                      onClick={() => void handleBatchBan()}
                      disabled={batchPending || selectedIds.size === 0}
                      data-testid="users-bulk-ban-btn"
                    >
                      {batchPending ? '处理中…' : `批量封禁 (${selectedIds.size})`}
                    </AdminButton>
                    <AdminButton
                      variant="default"
                      size="sm"
                      onClick={() => void handleBatchUnban()}
                      disabled={batchPending || selectedIds.size === 0}
                      data-testid="users-bulk-unban-btn"
                    >
                      {batchPending ? '处理中…' : `批量解封 (${selectedIds.size})`}
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      disabled={batchPending}
                      data-testid="users-bulk-clear-btn"
                    >
                      清除选择
                    </AdminButton>
                  </span>
                }
                toolbar={{
                  trailing: toolbarTrailing,
                  hideFilterChips: true,
                }}
                pagination={{ pageSizeOptions: [10, 20, 50] }}
              />
            )
      }
    </div>
    </>
  )
}
