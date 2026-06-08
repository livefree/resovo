'use client'

/**
 * ActivityTab — 采集与富集记录（ADR-188 D-188-4/5）
 *
 * external_fetch_log 可查询流水表：按 operation（内容类型）/ method（离线·抓取·API）/
 * status（成功·失败·超时）过滤 + 分页。回答用户「最近发生过多少次抓取、是否成功、
 * 抓的是什么、离线还是在线」的逐条诉求（概览给聚合，本 tab 给原始流水可下钻）。
 *
 * 表格走 server-next 真源范式：admin-ui DataTable 一体化 + useTableQuery（URL namespace
 * 'act' 与外层 ?provider=&tab= 互不冲突）。过滤器为页面级本地 state（不入 snapshot.filters，
 * 仿 VideoListClient 快捷筛选范式），切换即回第 1 页。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DataTable,
  AdminSelect,
  Pill,
  EmptyState,
  ErrorState,
  LoadingState,
  useTableQuery,
  type ColumnDescriptor,
  type TableColumn,
  type TableQueryPatch,
  type PillVariant,
} from '@resovo/admin-ui'
import type { ProviderKey } from '@resovo/types'
import { useTableRouterAdapter } from '@/lib/table-router-adapter'
import {
  fetchActivity,
  OPERATION_LABELS,
  METHOD_LABELS,
  STATUS_LABELS,
  SOURCE_LABELS,
  labelOf,
  type FetchLogRow,
} from '@/lib/external-resources/api'

const COLUMN_DESCRIPTORS: readonly ColumnDescriptor[] = [
  { id: 'createdAt', header: '时间', defaultVisible: true },
  { id: 'operation', header: '内容类型', defaultVisible: true },
  { id: 'method', header: '方式', defaultVisible: true },
  { id: 'status', header: '状态', defaultVisible: true },
  { id: 'source', header: '触发方', defaultVisible: true },
  { id: 'target', header: '目标', defaultVisible: true },
  { id: 'itemCount', header: '条数', defaultVisible: true },
  { id: 'durationMs', header: '耗时', defaultVisible: true },
]

const STATUS_PILL: Readonly<Record<string, PillVariant>> = {
  ok: 'ok',
  fail: 'danger',
  timeout: 'warn',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function toOptions(map: Readonly<Record<string, string>>): { value: string; label: string }[] {
  return Object.entries(map).map(([value, label]) => ({ value, label }))
}

const TARGET_CELL_STYLE: React.CSSProperties = {
  display: 'inline-block',
  maxWidth: '260px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  verticalAlign: 'bottom',
  color: 'var(--fg-muted)',
  fontVariantNumeric: 'tabular-nums',
}

const FILTERS_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
}

function buildColumns(): readonly TableColumn<FetchLogRow>[] {
  return [
    {
      id: 'createdAt', header: '时间', filterable: false, accessor: (r) => r.createdAt,
      cell: ({ row }) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)' }}>{formatDateTime(row.createdAt)}</span>,
    },
    { id: 'operation', header: '内容类型', filterable: false, accessor: (r) => r.operation, cell: ({ row }) => labelOf(OPERATION_LABELS, row.operation) },
    { id: 'method', header: '方式', filterable: false, accessor: (r) => r.method, cell: ({ row }) => labelOf(METHOD_LABELS, row.method) },
    {
      id: 'status', header: '状态', filterable: false, accessor: (r) => r.status,
      cell: ({ row }) => <Pill variant={STATUS_PILL[row.status] ?? 'neutral'}>{labelOf(STATUS_LABELS, row.status)}</Pill>,
    },
    { id: 'source', header: '触发方', filterable: false, accessor: (r) => r.source, cell: ({ row }) => labelOf(SOURCE_LABELS, row.source) },
    {
      id: 'target', header: '目标', filterable: false, accessor: (r) => r.target,
      cell: ({ row }) => <span style={TARGET_CELL_STYLE} title={row.target ?? undefined}>{row.target ?? '—'}</span>,
    },
    {
      id: 'itemCount', header: '条数', filterable: false, accessor: (r) => r.itemCount,
      cell: ({ row }) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.itemCount}</span>,
    },
    {
      id: 'durationMs', header: '耗时', filterable: false, accessor: (r) => r.durationMs,
      cell: ({ row }) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)' }}>{row.durationMs == null ? '—' : `${row.durationMs}ms`}</span>,
    },
  ]
}

export function ActivityTab({ provider }: { provider: ProviderKey }) {
  const router = useTableRouterAdapter()
  const { snapshot, patch } = useTableQuery({
    tableId: 'ext-activity',
    router,
    urlNamespace: 'act',
    defaults: { pagination: { page: 1, pageSize: 20 } },
    columns: COLUMN_DESCRIPTORS,
  })

  const [operation, setOperation] = useState<string | null>(null)
  const [method, setMethod] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [rows, setRows] = useState<FetchLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)

  const columns = useMemo(() => buildColumns(), [])

  const page = snapshot.pagination.page
  const pageSize = snapshot.pagination.pageSize

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    fetchActivity(provider, {
      ...(operation ? { operation } : {}),
      ...(method ? { method } : {}),
      ...(status ? { status } : {}),
      page,
      limit: pageSize,
    })
      .then((res) => {
        if (cancelled) return
        setRows(res?.rows ?? [])
        setTotal(res?.total ?? 0)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [provider, operation, method, status, page, pageSize, retryKey])

  const resetToFirstPage = useCallback(() => {
    if (snapshot.pagination.page !== 1) patch({ pagination: { page: 1, pageSize } })
  }, [patch, snapshot.pagination.page, pageSize])

  const onFilter = useCallback((setter: (v: string | null) => void) => (next: string | null) => {
    setter(next)
    resetToFirstPage()
  }, [resetToFirstPage])

  const handlePatch = useCallback((next: TableQueryPatch) => patch(next), [patch])

  const filtersNode = (
    <div style={FILTERS_ROW_STYLE} data-activity-filters>
      <AdminSelect
        options={toOptions(OPERATION_LABELS)}
        value={operation}
        onChange={onFilter(setOperation)}
        placeholder="内容类型"
        size="sm"
        aria-label="按内容类型过滤"
        data-testid="ext-activity-filter-operation"
      />
      <AdminSelect
        options={toOptions(METHOD_LABELS)}
        value={method}
        onChange={onFilter(setMethod)}
        placeholder="方式"
        size="sm"
        aria-label="按方式过滤"
        data-testid="ext-activity-filter-method"
      />
      <AdminSelect
        options={toOptions(STATUS_LABELS)}
        value={status}
        onChange={onFilter(setStatus)}
        placeholder="状态"
        size="sm"
        aria-label="按状态过滤"
        data-testid="ext-activity-filter-status"
      />
    </div>
  )

  if (loading && rows.length === 0) {
    return <LoadingState variant="skeleton" />
  }
  if (error) {
    return <ErrorState error={error} title="加载失败" onRetry={() => setRetryKey((k) => k + 1)} />
  }

  return (
    <DataTable<FetchLogRow>
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      mode="server"
      query={snapshot}
      onQueryChange={handlePatch}
      totalRows={total}
      loading={loading}
      emptyState={<EmptyState title="暂无采集记录" description="调整过滤条件或等待 worker 下次采集" />}
      data-testid="ext-activity-table"
      toolbar={{ trailing: filtersNode, hideFilterChips: true }}
      pagination={{ pageSizeOptions: [20, 50, 100] }}
    />
  )
}
