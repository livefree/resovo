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
  AdminSelect,
  AdminInput,
  useToast,
  type AdminSelectOption,
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

const TOOLBAR_LEFT_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
}

const DATETIME_INPUT_STYLE: CSSProperties = {
  height: 'var(--control-h-sm, 28px)',
  padding: '0 8px',
  fontSize: 'var(--font-size-xs)',
  fontFamily: 'inherit',
  color: 'var(--fg-default)',
  background: 'var(--bg-surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
}

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

  // ── 筛选状态 ──
  const [actionType, setActionType] = useState<AdminAuditActionType | null>(null)
  const [targetKind, setTargetKind] = useState<AdminAuditTargetKind | null>(null)
  const [actorIdInput, setActorIdInput] = useState('')
  const [requestIdInput, setRequestIdInput] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // ── debounced filter（CHG-SN-6-AUDIT-DEBOUNCE-FIX / ultrareview P0-1）──
  // UUID 36 字符按键即触发 36 次 API → 改为 300ms debounce 单次触发
  // R-ADR-118-2 COUNT(*) p95 风险防前端放大
  const [actorIdDebounced, setActorIdDebounced] = useState('')
  const [requestIdDebounced, setRequestIdDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setActorIdDebounced(actorIdInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [actorIdInput])
  useEffect(() => {
    const timer = setTimeout(() => {
      setRequestIdDebounced(requestIdInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [requestIdInput])

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

  // 列表加载
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params: ListAdminAuditLogsParams = {
      page,
      limit: pageSize,
      ...(actionType ? { actionType } : {}),
      ...(targetKind ? { targetKind } : {}),
      ...(actorIdDebounced ? { actorId: actorIdDebounced } : {}),
      ...(requestIdDebounced ? { requestId: requestIdDebounced } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
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
  }, [page, pageSize, actionType, targetKind, actorIdDebounced, requestIdDebounced, from, to, retryKey])

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

  const columns = useMemo(() => buildAuditColumns({ onRollback: handleRollback }), [handleRollback])

  const actionTypeOptions = useMemo<readonly AdminSelectOption[]>(
    () => (enums?.actionTypes ?? []).map((t) => ({ value: t, label: t })),
    [enums],
  )
  const targetKindOptions = useMemo<readonly AdminSelectOption[]>(
    () => (enums?.targetKinds ?? []).map((k) => ({ value: k, label: k })),
    [enums],
  )

  const hasFilter = Boolean(actionType || targetKind || actorIdInput.trim() || requestIdInput.trim() || from || to)

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

  const toolbarSearch = (
    <span style={TOOLBAR_LEFT_STYLE} data-testid="audit-toolbar-filters">
      <AdminSelect
        options={actionTypeOptions}
        value={actionType}
        onChange={(next) => { setActionType(next as AdminAuditActionType | null); setPage(1) }}
        placeholder="全部 action"
        size="sm"
        searchable
        data-testid="audit-filter-action"
        aria-label="按 action_type 筛选"
      />
      <AdminSelect
        options={targetKindOptions}
        value={targetKind}
        onChange={(next) => { setTargetKind(next as AdminAuditTargetKind | null); setPage(1) }}
        placeholder="全部 target_kind"
        size="sm"
        data-testid="audit-filter-target-kind"
        aria-label="按 target_kind 筛选"
      />
      {!isModerator && (
        <AdminInput
          value={actorIdInput}
          onChange={(e) => setActorIdInput(e.target.value)}
          placeholder="actor_id (UUID)"
          size="sm"
          data-testid="audit-filter-actor"
          aria-label="按 actor_id 筛选"
        />
      )}
      <AdminInput
        value={requestIdInput}
        onChange={(e) => setRequestIdInput(e.target.value)}
        placeholder="request_id"
        size="sm"
        data-testid="audit-filter-request"
        aria-label="按 request_id 筛选"
      />
      <input
        type="datetime-local"
        value={from}
        onChange={(e) => { setFrom(e.target.value); setPage(1) }}
        style={DATETIME_INPUT_STYLE}
        data-testid="audit-filter-from"
        aria-label="起始时间"
      />
      <input
        type="datetime-local"
        value={to}
        onChange={(e) => { setTo(e.target.value); setPage(1) }}
        style={DATETIME_INPUT_STYLE}
        data-testid="audit-filter-to"
        aria-label="结束时间"
      />
      {hasFilter ? (
        <AdminButton
          variant="ghost"
          size="sm"
          onClick={() => {
            setActionType(null); setTargetKind(null)
            setActorIdInput(''); setRequestIdInput('')
            setFrom(''); setTo('')
            setPage(1)
          }}
          data-testid="audit-filter-clear"
        >
          清空筛选
        </AdminButton>
      ) : null}
    </span>
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

  return (
    <div data-audit-client style={PAGE_STYLE}>
      <PageHeader
        title="审计日志"
        subtitle={isModerator
          ? `${total} 条记录 · 仅显示你的操作`
          : `${total} 条记录 · admin_audit_log 全局写操作流水`}
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
                }}
                totalRows={total}
                loading={loading}
                onRowClick={(row) => void handleRowClick(row)}
                emptyState={<EmptyState title="暂无审计记录" description="调整筛选条件后重试" />}
                data-testid="audit-table"
                enableHeaderMenu
                toolbar={{
                  search: toolbarSearch,
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
