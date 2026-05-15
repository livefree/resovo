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
import {
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  AdminSelect,
  AdminInput,
  useToast,
  type AdminSelectOption,
  type TableColumn,
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

const DETAIL_SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
}

const DETAIL_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const DETAIL_VALUE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  wordBreak: 'break-all',
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

const JSONB_BLOCK_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '12px',
  maxHeight: '300px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  margin: 0,
}

// ── 列定义 ────────────────────────────────────────────────────────

function buildAuditColumns(): readonly TableColumn<AdminAuditLogListRow>[] {
  return [
    {
      id: 'createdAt',
      header: '时间',
      accessor: (r) => r.createdAt,
      width: 180,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }),
    },
    {
      id: 'actor',
      header: '操作人',
      accessor: (r) => r.actorUsername ?? r.actorId,
      width: 160,
      defaultVisible: true,
      cell: ({ row }) => (
        <span data-actor-cell={row.actorId}>
          {row.actorUsername ?? <span style={{ color: 'var(--fg-muted)' }}>(已删除)</span>}
        </span>
      ),
    },
    {
      id: 'actionType',
      header: '操作类型',
      accessor: (r) => r.actionType,
      width: 200,
      defaultVisible: true,
      cell: ({ row }) => (
        <code style={{ fontSize: 'var(--font-size-xs)' }} data-action-type={row.actionType}>
          {row.actionType}
        </code>
      ),
    },
    {
      id: 'target',
      header: '目标',
      accessor: (r) => `${r.targetKind}:${r.targetId ?? ''}`,
      width: 220,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'baseline' }}>
          <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
            {row.targetKind}
          </code>
          <span style={{ fontSize: 'var(--font-size-xs)' }}>
            {row.targetId
              ? `${row.targetId.slice(0, 8)}…`
              : <span style={{ color: 'var(--fg-muted)' }}>批量</span>}
          </span>
        </span>
      ),
    },
    {
      id: 'payloadSummary',
      header: '摘要',
      accessor: (r) => r.payloadSummary,
      minWidth: 240,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }} data-payload-summary>
          {row.payloadSummary ?? '—'}
        </span>
      ),
    },
    {
      id: 'requestId',
      header: 'Request ID',
      accessor: (r) => r.requestId,
      width: 160,
      defaultVisible: true,
      cell: ({ row }) => (
        <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
          {row.requestId ?? '—'}
        </code>
      ),
    },
  ]
}

// ── 详情抽屉 ──────────────────────────────────────────────────────

interface DetailDrawerProps {
  readonly open: boolean
  readonly detail: AdminAuditLogDetail | null
  readonly loading: boolean
  readonly onClose: () => void
}

function DetailDrawer({ open, detail, loading, onClose }: DetailDrawerProps) {
  return (
    <Drawer
      open={open}
      placement="right"
      width={560}
      onClose={onClose}
      title={detail ? `审计详情 #${detail.id}` : '审计详情'}
      data-testid="audit-detail-drawer"
    >
      {loading ? (
        <LoadingState variant="spinner" />
      ) : !detail ? (
        <EmptyState title="无数据" description="审计行已被删除或不存在" />
      ) : (
        <div style={DETAIL_SECTION_STYLE} data-testid="audit-detail-content">
          <div>
            <div style={DETAIL_LABEL_STYLE}>操作类型</div>
            <div style={DETAIL_VALUE_STYLE}>{detail.actionType}</div>
          </div>
          <div>
            <div style={DETAIL_LABEL_STYLE}>操作人</div>
            <div style={DETAIL_VALUE_STYLE}>
              {detail.actorUsername ?? '(已删除)'} · <code>{detail.actorId}</code>
            </div>
          </div>
          <div>
            <div style={DETAIL_LABEL_STYLE}>目标</div>
            <div style={DETAIL_VALUE_STYLE}>
              {detail.targetKind}
              {detail.targetId ? ` · ${detail.targetId}` : ' · (批量操作)'}
            </div>
          </div>
          <div>
            <div style={DETAIL_LABEL_STYLE}>时间</div>
            <div style={DETAIL_VALUE_STYLE}>
              {new Date(detail.createdAt).toLocaleString('zh-CN', { hour12: false })}
            </div>
          </div>
          {detail.requestId ? (
            <div>
              <div style={DETAIL_LABEL_STYLE}>Request ID</div>
              <div style={DETAIL_VALUE_STYLE}>{detail.requestId}</div>
            </div>
          ) : null}
          {detail.ipHash ? (
            <div>
              <div style={DETAIL_LABEL_STYLE}>IP Hash</div>
              <div style={DETAIL_VALUE_STYLE}>{detail.ipHash}</div>
            </div>
          ) : null}
          <div>
            <div style={DETAIL_LABEL_STYLE}>变更前 (before_jsonb)</div>
            <pre style={JSONB_BLOCK_STYLE} data-testid="audit-before-jsonb">
              {detail.beforeJsonb ? JSON.stringify(detail.beforeJsonb, null, 2) : '—'}
            </pre>
          </div>
          <div>
            <div style={DETAIL_LABEL_STYLE}>变更后 (after_jsonb)</div>
            <pre style={JSONB_BLOCK_STYLE} data-testid="audit-after-jsonb">
              {detail.afterJsonb ? JSON.stringify(detail.afterJsonb, null, 2) : '—'}
            </pre>
          </div>
        </div>
      )}
    </Drawer>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function AuditClient() {
  const toast = useToast()

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
      ...(actorIdInput.trim() ? { actorId: actorIdInput.trim() } : {}),
      ...(requestIdInput.trim() ? { requestId: requestIdInput.trim() } : {}),
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
  }, [page, pageSize, actionType, targetKind, actorIdInput, requestIdInput, from, to, retryKey])

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

  const columns = useMemo(() => buildAuditColumns(), [])

  const actionTypeOptions = useMemo<readonly AdminSelectOption[]>(
    () => (enums?.actionTypes ?? []).map((t) => ({ value: t, label: t })),
    [enums],
  )
  const targetKindOptions = useMemo<readonly AdminSelectOption[]>(
    () => (enums?.targetKinds ?? []).map((k) => ({ value: k, label: k })),
    [enums],
  )

  const hasFilter = Boolean(actionType || targetKind || actorIdInput.trim() || requestIdInput.trim() || from || to)

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
      <AdminInput
        value={actorIdInput}
        onChange={(e) => setActorIdInput(e.target.value)}
        onBlur={() => setPage(1)}
        placeholder="actor_id (UUID)"
        size="sm"
        data-testid="audit-filter-actor"
        aria-label="按 actor_id 筛选"
      />
      <AdminInput
        value={requestIdInput}
        onChange={(e) => setRequestIdInput(e.target.value)}
        onBlur={() => setPage(1)}
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
        subtitle={`${total} 条记录 · admin_audit_log 全局写操作流水`}
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
