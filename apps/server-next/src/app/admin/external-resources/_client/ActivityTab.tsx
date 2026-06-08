'use client'

/**
 * ActivityTab — 采集与富集记录（ADR-188 D-188-4/5）
 *
 * external_fetch_log 可查询流水表：按 operation（内容类型）/ method（离线·抓取·API）/
 * status（成功·失败·超时）过滤 + 分页。回答用户「最近发生过多少次抓取、是否成功、
 * 抓的是什么、离线还是在线」的逐条诉求（概览给聚合，本 tab 给原始流水可下钻）。
 *
 * 表格走 server-next 真源范式：admin-ui DataTable 一体化 + useTableQuery（URL namespace
 * 'act' 与外层 ?provider=&tab= 互不冲突）。operation/method/status 走**原生列过滤**
 * （列头 ⋯ 菜单 enum 多选 → snapshot.filters → getEnumFirst 映射单值后端，对齐 VideoColumns/
 * buildVideoFilter 标杆）；列宽可调（enableColumnResizing）；过滤变更回第 1 页。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DataTable,
  Pill,
  EmptyState,
  ErrorState,
  LoadingState,
  useTableQuery,
  type ColumnDescriptor,
  type TableColumn,
  type TableQueryPatch,
  type TableQuerySnapshot,
  type FilterValue,
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

const OPERATION_OPTIONS = toOptions(OPERATION_LABELS)
const METHOD_OPTIONS = toOptions(METHOD_LABELS)
const STATUS_OPTIONS = toOptions(STATUS_LABELS)

/**
 * 读单值列过滤入参（映射单值后端 operation/method/status）。
 * 容忍两种 kind：
 * - `enum`：会话内列头多选应用 / URL 多值（逗号） → 取首值。
 * - `text`：**URL restore 单值退化**——url-sync `inferFilterValue` 对无逗号值推断为 text
 *   而非 enum，单选过滤经 URL 往返后落 text；此处一并读取，保证 URL restore 不丢过滤。
 *   （operation/method/status 取值均为非数字/非 bool 字符串，单值必落 text，无歧义。）
 */
function readSingleFilter(filters: TableQuerySnapshot['filters'], key: string): string | undefined {
  const v: FilterValue | undefined = filters.get(key)
  if (v?.kind === 'enum') return v.value[0]
  if (v?.kind === 'text') return v.value || undefined
  return undefined
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

// 列定义对齐 VideoColumns 范式：列宽可调（width+minWidth+enableResizing）；
// operation/method/status 走原生 enum 列过滤（filterKind:'enum' + filterOptions → snapshot.filters，
// 列 id 即后端过滤 key，无需 filterFieldName）；其余列只读展示（filterable:false / 未接线 sort 禁用）。
function buildColumns(): readonly TableColumn<FetchLogRow>[] {
  return [
    {
      id: 'createdAt', header: '时间', accessor: (r) => r.createdAt,
      width: 150, minWidth: 130, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)' }}>{formatDateTime(row.createdAt)}</span>,
    },
    {
      id: 'operation', header: '内容类型', accessor: (r) => r.operation,
      width: 120, minWidth: 100, enableResizing: true, enableSorting: false,
      filterable: true, filterKind: 'enum', filterOptions: OPERATION_OPTIONS,
      cell: ({ row }) => labelOf(OPERATION_LABELS, row.operation),
    },
    {
      id: 'method', header: '方式', accessor: (r) => r.method,
      width: 110, minWidth: 90, enableResizing: true, enableSorting: false,
      filterable: true, filterKind: 'enum', filterOptions: METHOD_OPTIONS,
      cell: ({ row }) => labelOf(METHOD_LABELS, row.method),
    },
    {
      id: 'status', header: '状态', accessor: (r) => r.status,
      width: 90, minWidth: 80, enableResizing: true, enableSorting: false,
      filterable: true, filterKind: 'enum', filterOptions: STATUS_OPTIONS,
      cell: ({ row }) => <Pill variant={STATUS_PILL[row.status] ?? 'neutral'}>{labelOf(STATUS_LABELS, row.status)}</Pill>,
    },
    {
      id: 'source', header: '触发方', accessor: (r) => r.source,
      width: 110, minWidth: 90, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => labelOf(SOURCE_LABELS, row.source),
    },
    {
      id: 'target', header: '目标', accessor: (r) => r.target,
      width: 260, minWidth: 160, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => <span style={TARGET_CELL_STYLE} title={row.target ?? undefined}>{row.target ?? '—'}</span>,
    },
    {
      id: 'itemCount', header: '条数', accessor: (r) => r.itemCount,
      width: 80, minWidth: 64, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.itemCount}</span>,
    },
    {
      id: 'durationMs', header: '耗时', accessor: (r) => r.durationMs,
      width: 90, minWidth: 72, enableResizing: true, enableSorting: false, filterable: false,
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

  const [rows, setRows] = useState<FetchLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)

  const columns = useMemo(() => buildColumns(), [])

  const page = snapshot.pagination.page
  const pageSize = snapshot.pagination.pageSize
  // 原生列过滤 → snapshot.filters（列 id 即后端 key）；取首值映射单值后端（enum/URL-restore text 兼容）
  const operation = readSingleFilter(snapshot.filters, 'operation')
  const method = readSingleFilter(snapshot.filters, 'method')
  const status = readSingleFilter(snapshot.filters, 'status')

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

  // useTableQuery.patch 内置「filter/sort 变更回第 1 页」，直接透传（对齐 VideoListClient 标杆）
  const handlePatch = useCallback((next: TableQueryPatch) => patch(next), [patch])

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
      enableColumnResizing
      emptyState={<EmptyState title="暂无采集记录" description="调整过滤条件或等待 worker 下次采集" />}
      data-testid="ext-activity-table"
      toolbar={{ hideFilterChips: true }}
      pagination={{ pageSizeOptions: [20, 50, 100] }}
    />
  )
}
