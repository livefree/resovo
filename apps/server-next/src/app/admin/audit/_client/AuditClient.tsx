'use client'

/**
 * AuditClient.tsx — `/admin/audit` 全局审计日志视图（M-SN-6 / CHG-SN-6-01 / ADR-118）
 *
 * 范围：admin_audit_log 表（全局写操作流水）多维 filter + 分页列表 + 详情抽屉
 *
 * 端点契约（ADR-118 §端点契约）：
 *   GET /admin/audit/logs       — 列表（裁剪 jsonb，带 payloadSummary）
 *   GET /admin/audit/logs/:id   — 详情（完整 jsonb + ipHash）
 *   GET /admin/audit/enums      — actionTypes + targetKinds 枚举
 *
 * 共享原语（≥ 80% 占比硬清单，quality-gates §7 第 2 项）：
 *   DataTable / Drawer / PageHeader / AdminButton / AdminSelect / AdminInput /
 *   EmptyState / ErrorState / LoadingState
 *
 * 设计模式：Mode A 整页滚动（ADR-103 AMENDMENT 2026-05-14 默认）— 不设 height 约束
 */

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { resolveRollbackTarget } from '@/lib/audit/rollback-routes'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  useToast,
  type DistinctOption,
  type ColumnPreference,
  type FilterValue,
  type TableSortState,
} from '@resovo/admin-ui'
import type {
  AdminAuditActionType,
  AdminAuditTargetKind,
  AdminAuditLogListRow,
  AdminAuditLogDetail,
  AdminAuditLogEnumsResult,
  ListAdminAuditLogsParams,
} from '@resovo/types'
import {
  listAdminAuditLogs,
  getAdminAuditLogDetail,
  getAdminAuditEnums,
} from '@/lib/audit/api'
import { downloadCsv, type CsvColumn } from '@/lib/csv-export'
import { DetailDrawer } from './AuditDetailDrawer'
import { buildAuditColumns } from './AuditColumns'

// ── 常量 ──────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

// sub 2（2026-05-24）：toolbar 6 控件迁列内 filterable / TOOLBAR_LEFT_STYLE + DATETIME_INPUT_STYLE 已删

// ── ADR-142 / CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP：moderator self-scope UI ──
// 读 user_role cookie 推断当前 role；moderator 走 self-scope 视图（隐藏 actorId filter + 显 info banner）
function readUserRoleFromCookie(): 'admin' | 'moderator' | 'user' {
  if (typeof document === 'undefined') return 'admin'  // SSR 默认（实际由 middleware 守门）
  const match = /(?:^|;\s*)user_role=([^;]+)/.exec(document.cookie)
  const role = match?.[1]
  return role === 'moderator' || role === 'user' ? role : 'admin'
}

const SELF_SCOPE_BANNER_STYLE: CSSProperties = {
  padding: '10px 14px',
  marginBottom: '12px',
  background: 'var(--state-info-bg)',
  border: '1px solid var(--state-info-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--state-info-fg)',
  fontSize: 'var(--font-size-xs)',
  lineHeight: '1.5',
}

// ── 主组件 ────────────────────────────────────────────────────────

export function AuditClient() {
  const toast = useToast()
  // ADR-142 D-142-4：moderator self-scope UI gating
  const currentUserRole = useMemo(() => readUserRoleFromCookie(), [])
  const isModerator = currentUserRole === 'moderator'

  // ── 列表状态 ──
  const [rows, setRows] = useState<readonly AdminAuditLogListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<TableSortState>({ field: 'createdAt', direction: 'desc' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  // ── 筛选状态（sub 2：6 独立 state + 2 debounced 已合并为 filtersMap 单一状态）──
  // ADR-150 D-150-4 业务 key 桥接：column.filterFieldName 即 filtersMap key
  //   actionType / targetKind / actorId / requestId / createdAt
  // DataTableAutoFilter apply 提交时一次性触发 / 无需 debounce
  const [filtersMap, setFiltersMap] = useState<ReadonlyMap<string, FilterValue>>(new Map())
  const [columnPrefs, setColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())

  const actionTypeFilter = useMemo<AdminAuditActionType | undefined>(() => {
    const v = filtersMap.get('actionType')
    return v?.kind === 'enum' && v.value.length > 0 ? (v.value[0] as AdminAuditActionType) : undefined
  }, [filtersMap])
  const targetKindFilter = useMemo<AdminAuditTargetKind | undefined>(() => {
    const v = filtersMap.get('targetKind')
    return v?.kind === 'enum' && v.value.length > 0 ? (v.value[0] as AdminAuditTargetKind) : undefined
  }, [filtersMap])
  const actorIdFilter = useMemo<string | undefined>(() => {
    const v = filtersMap.get('actorId')
    return v?.kind === 'text' && v.value ? v.value.trim() : undefined
  }, [filtersMap])
  const requestIdFilter = useMemo<string | undefined>(() => {
    const v = filtersMap.get('requestId')
    return v?.kind === 'text' && v.value ? v.value.trim() : undefined
  }, [filtersMap])
  // sub 2：createdAt date kind → ISO 8601 timestamptz（含 to 当日 endOfDay 23:59:59.999）
  const createdAtFromIso = useMemo<string | undefined>(() => {
    const v = filtersMap.get('createdAt')
    if (v?.kind !== 'date-range' || !v.from) return undefined
    return `${v.from}T00:00:00.000Z`
  }, [filtersMap])
  const createdAtToIso = useMemo<string | undefined>(() => {
    const v = filtersMap.get('createdAt')
    if (v?.kind !== 'date-range' || !v.to) return undefined
    return `${v.to}T23:59:59.999Z`
  }, [filtersMap])

  // ── 枚举 + 详情 ──
  const [enums, setEnums] = useState<AdminAuditLogEnumsResult | null>(null)
  const [detail, setDetail] = useState<AdminAuditLogDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 枚举加载（单次）
  useEffect(() => {
    let cancelled = false
    getAdminAuditEnums()
      .then((res) => { if (!cancelled) setEnums(res) })
      .catch(() => { /* enums 加载失败不阻塞主视图，AdminSelect 显示空 options */ })
    return () => { cancelled = true }
  }, [])

  // 列表加载（sub 2：deps 从 6 独立 state → filtersMap 单一）
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    // sub 2 EXTEND（2026-05-24）：sort 白名单守卫（audit 仅支持 createdAt）
    const sortFieldGuarded: 'createdAt' | undefined = sort.field === 'createdAt' ? 'createdAt' : undefined
    const params: ListAdminAuditLogsParams = {
      page,
      limit: pageSize,
      ...(actionTypeFilter ? { actionType: actionTypeFilter } : {}),
      ...(targetKindFilter ? { targetKind: targetKindFilter } : {}),
      ...(actorIdFilter ? { actorId: actorIdFilter } : {}),
      ...(requestIdFilter ? { requestId: requestIdFilter } : {}),
      ...(createdAtFromIso ? { from: createdAtFromIso } : {}),
      ...(createdAtToIso ? { to: createdAtToIso } : {}),
      // sub 2 EXTEND：sort 字段透传（仅 createdAt）
      ...(sortFieldGuarded ? { sortField: sortFieldGuarded, sortDirection: sort.direction } : {}),
    }
    listAdminAuditLogs(params)
      .then((res) => {
        if (cancelled) return
        setRows(res.data)
        setTotal(res.total)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('加载失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, pageSize, filtersMap, sort, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const handleRowClick = useCallback(async (row: AdminAuditLogListRow) => {
    setDrawerOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const result = await getAdminAuditLogDetail(row.id)
      setDetail(result)
    } catch (err: unknown) {
      toast.push({
        title: '详情加载失败',
        description: err instanceof Error ? err.message : '请重试',
        level: 'danger',
      })
      setDrawerOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }, [toast])

  const router = useRouter()

  // CHG-SN-8-GAPS-AUDIT-ROLLBACK：消费层「回滚」按钮 — 按 actionType 跳对应业务页（零新端点）
  const handleRollback = useCallback(
    (row: AdminAuditLogListRow) => {
      const target = resolveRollbackTarget(row)
      if (target.href == null) {
        toast.push({
          title: '不可回滚',
          description: target.disabledReason ?? '此操作类型暂未支持回滚',
          level: 'warn',
        })
        return
      }
      router.push(target.href)
    },
    [router, toast],
  )

  // sub 2：filterOptions 注入 buildAuditColumns（GET /admin/audit/enums 静态选项 / 不走 distinct）
  const actionTypeOptions = useMemo<readonly DistinctOption[]>(
    () => (enums?.actionTypes ?? []).map((t) => ({ value: t, label: t })),
    [enums],
  )
  const targetKindOptions = useMemo<readonly DistinctOption[]>(
    () => (enums?.targetKinds ?? []).map((k) => ({ value: k, label: k })),
    [enums],
  )

  const columns = useMemo(
    () => buildAuditColumns({
      onRollback: handleRollback,
      actionTypeOptions,
      targetKindOptions,
      hideActorFilter: isModerator,
    }),
    [handleRollback, actionTypeOptions, targetKindOptions, isModerator],
  )

  // CHG-SN-6-22：导出当前页 rows 为 CSV
  const handleExportCsv = () => {
    if (rows.length === 0) return
    const columns: readonly CsvColumn<AdminAuditLogListRow>[] = [
      { header: 'id',         accessor: (r) => r.id },
      { header: 'actionType', accessor: (r) => r.actionType },
      { header: 'targetKind', accessor: (r) => r.targetKind },
      { header: 'targetId',   accessor: (r) => r.targetId },
      { header: 'actorId',    accessor: (r) => r.actorId },
      { header: 'requestId',  accessor: (r) => r.requestId },
      { header: 'createdAt',  accessor: (r) => r.createdAt },
    ]
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadCsv(rows, columns, `audit-logs-${ts}.csv`)
  }

  const toolbarTrailing = (
    <AdminButton
      variant="ghost"
      size="sm"
      onClick={handleExportCsv}
      disabled={rows.length === 0}
      data-testid="audit-export-csv"
    >
      导出 CSV
    </AdminButton>
  )

  // sub 2：toolbarSearch 6 控件已删（迁列内 filterable / 矩阵 popover 统一清空）

  const query = useMemo(
    () => ({
      pagination: { page, pageSize },
      sort,
      // sub 2：filters 用 filtersMap state（D-150-4 业务 key 统一）
      filters: filtersMap,
      columns: columnPrefs,
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [page, pageSize, sort, filtersMap, columnPrefs],
  )

  return (
    <div data-audit-client style={PAGE_STYLE}>
      <PageHeader
        title="审计日志"
        titleVisuallyHidden
        subtitle={isModerator
          ? `${total} 条记录 · 仅显示你的操作`
          : `${total} 条记录`}
        actions={
          <AdminButton
            variant="default"
            size="sm"
            onClick={refresh}
            data-testid="audit-refresh"
          >
            刷新
          </AdminButton>
        }
        data-testid="audit-page-header"
      />
      {isModerator && (
        <div style={SELF_SCOPE_BANNER_STYLE} data-testid="audit-moderator-banner">
          仅显示你的操作记录。如需查看完整审计日志，请联系管理员。
        </div>
      )}
      {loading && rows.length === 0
        ? <LoadingState variant="skeleton" />
        : error
          ? <ErrorState error={error} title="加载失败" onRetry={refresh} />
          : (
              <DataTable<AdminAuditLogListRow>
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
                  // sub 2：filters patch（DataTableAutoFilter popover OK 触发 / 矩阵清空）
                  if (patch.filters) { setFiltersMap(patch.filters); setPage(1) }
                  if (patch.columns) setColumnPrefs(patch.columns)
                }}
                totalRows={total}
                loading={loading}
                onRowClick={(row) => void handleRowClick(row)}
                emptyState={<EmptyState title="暂无审计记录" description="调整筛选条件后重试" />}
                data-testid="audit-table"
                enableHeaderMenu
                enableColumnResizing
                toolbar={{
                  trailing: toolbarTrailing,
                  hideFilterChips: true,
                }}
                pagination={{ pageSizeOptions: [10, 20, 50, 100] }}
              />
            )
      }
      <DetailDrawer
        open={drawerOpen}
        detail={detail}
        loading={detailLoading}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
