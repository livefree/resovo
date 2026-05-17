'use client'

/**
 * CrawlerRunsView.tsx — `/admin/crawler` runs tab MVP（CHG-SN-6-15）
 *
 * 范围：消费 GET /admin/crawler/runs（v1 已存在）+ status / triggerType filter + 分页
 *
 * 不在范围（独立卡）：
 *   - runs/:id detail 视图
 *   - cancel / pause / resume 行操作（POST 端点已存在但 UI 待独立卡）
 *   - tasks per run / freeze 控制
 *
 * 共享原语（≥ 80%）：
 *   DataTable / AdminButton / AdminSelect / CodeText / EmptyState / ErrorState
 *   / LoadingState / useToast
 */

import React, { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  DataTable,
  AdminSelect,
  AdminButton,
  EmptyState,
  ErrorState,
  LoadingState,
  CodeText,
  useToast,
  type AdminSelectOption,
  type TableColumn,
  type TableSortState,
} from '@resovo/admin-ui'
import {
  listCrawlerRuns,
  type CrawlerRun,
  type CrawlerRunStatus,
  type CrawlerRunTriggerType,
} from '@/lib/crawler/api'

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const TOOLBAR_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
}

const STATUS_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '运行中' },
  { value: 'paused', label: '暂停' },
  { value: 'success', label: '成功' },
  { value: 'partial_failed', label: '部分失败' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
]

const TRIGGER_TYPE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'single', label: '单站点' },
  { value: 'batch', label: '批量' },
  { value: 'all', label: '全部' },
  { value: 'schedule', label: '定时' },
]

const STATUS_BADGE: Record<CrawlerRunStatus, { label: string; bg: string; color: string }> = {
  queued:         { label: '排队中', bg: 'var(--state-info-bg)',     color: 'var(--state-info-fg)' },
  running:        { label: '运行中', bg: 'var(--state-info-bg)',     color: 'var(--state-info-fg)' },
  paused:         { label: '暂停',   bg: 'var(--state-warning-bg)',  color: 'var(--state-warning-fg)' },
  success:        { label: '成功',   bg: 'var(--state-success-bg)',  color: 'var(--state-success-fg)' },
  partial_failed: { label: '部分失败', bg: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)' },
  failed:         { label: '失败',   bg: 'var(--state-danger-bg)',   color: 'var(--state-danger-fg)' },
  cancelled:      { label: '已取消', bg: 'var(--bg-surface-sunken)', color: 'var(--fg-muted)' },
}

function buildColumns(): readonly TableColumn<CrawlerRun>[] {
  return [
    {
      id: 'id',
      header: 'Run ID',
      accessor: (r) => r.id,
      width: 200,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => (
        <CodeText
          value={`${row.id.slice(0, 8)}…`}
          dataAttr={{ 'data-run-id': row.id }}
        />
      ),
    },
    {
      id: 'status',
      header: '状态',
      accessor: (r) => r.status,
      width: 110,
      defaultVisible: true,
      cell: ({ row }) => {
        const cfg = STATUS_BADGE[row.status]
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill, 12px)',
              fontSize: 'var(--font-size-xs)',
              background: cfg.bg,
              color: cfg.color,
            }}
            data-run-status={row.status}
          >
            {cfg.label}
          </span>
        )
      },
    },
    {
      id: 'triggerType',
      header: '触发',
      accessor: (r) => r.triggerType,
      width: 100,
      defaultVisible: true,
      cell: ({ row }) => <CodeText value={row.triggerType} muted />,
    },
    {
      id: 'siteCount',
      header: '站点数',
      accessor: (r) => `${r.enqueuedSiteCount}/${r.requestedSiteCount}`,
      width: 110,
      defaultVisible: true,
      cell: ({ row }) => (
        <span data-site-count style={{ fontSize: 'var(--font-size-xs)' }}>
          已入队 {row.enqueuedSiteCount} / 请求 {row.requestedSiteCount}
          {row.skippedSiteCount > 0 ? (
            <span style={{ color: 'var(--fg-muted)' }}> · 跳过 {row.skippedSiteCount}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: '创建时间',
      accessor: (r) => r.createdAt,
      width: 170,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
          {new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false })}
        </span>
      ),
    },
    {
      id: 'duration',
      header: '耗时',
      accessor: (r) => r.finishedAt,
      width: 100,
      defaultVisible: true,
      cell: ({ row }) => {
        if (!row.startedAt) return <span style={{ color: 'var(--fg-muted)' }}>—</span>
        const start = new Date(row.startedAt).getTime()
        const end = row.finishedAt ? new Date(row.finishedAt).getTime() : Date.now()
        const sec = Math.round((end - start) / 1000)
        if (sec < 60) return `${sec}s`
        const min = Math.floor(sec / 60)
        return `${min}m${sec % 60}s`
      },
    },
  ]
}

export function CrawlerRunsView() {
  const toast = useToast()
  const [rows, setRows] = useState<readonly CrawlerRun[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sort, setSort] = useState<TableSortState>({ field: 'createdAt', direction: 'desc' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [statusFilter, setStatusFilter] = useState<CrawlerRunStatus | null>(null)
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<CrawlerRunTriggerType | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listCrawlerRuns({
      page,
      limit: pageSize,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(triggerTypeFilter ? { triggerType: triggerTypeFilter } : {}),
    }).then((res) => {
      if (cancelled) return
      setRows(res.data)
      setTotal(res.pagination.total)
    }).catch((err: unknown) => {
      if (cancelled) return
      setError(err instanceof Error ? err : new Error('runs 加载失败'))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [page, pageSize, statusFilter, triggerTypeFilter, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const columns = useMemo(() => buildColumns(), [])

  const hasFilter = Boolean(statusFilter || triggerTypeFilter)

  const toolbarSearch = (
    <span style={TOOLBAR_STYLE} data-testid="crawler-runs-filters">
      <AdminSelect
        options={STATUS_OPTIONS}
        value={statusFilter}
        onChange={(v) => { setStatusFilter(v as CrawlerRunStatus | null); setPage(1) }}
        placeholder="全部状态"
        size="sm"
        data-testid="crawler-runs-status-filter"
        aria-label="按状态筛选"
      />
      <AdminSelect
        options={TRIGGER_TYPE_OPTIONS}
        value={triggerTypeFilter}
        onChange={(v) => { setTriggerTypeFilter(v as CrawlerRunTriggerType | null); setPage(1) }}
        placeholder="全部触发"
        size="sm"
        data-testid="crawler-runs-trigger-filter"
        aria-label="按触发类型筛选"
      />
      {hasFilter ? (
        <AdminButton
          variant="ghost"
          size="sm"
          onClick={() => { setStatusFilter(null); setTriggerTypeFilter(null); setPage(1) }}
          data-testid="crawler-runs-filter-clear"
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

  // 暴露 refresh 给 toast 错误处理 + 触发场景
  void toast

  return (
    <div data-crawler-runs-view style={SECTION_STYLE}>
      {loading && rows.length === 0
        ? <LoadingState variant="skeleton" />
        : error
          ? <ErrorState error={error} title="加载失败" onRetry={refresh} />
          : (
              <DataTable<CrawlerRun>
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
                emptyState={<EmptyState title="暂无 runs" description="尚未触发采集批次，可在站点页面发起采集" />}
                data-testid="crawler-runs-table"
                enableHeaderMenu
                toolbar={{
                  search: toolbarSearch,
                  hideFilterChips: true,
                }}
                pagination={{ pageSizeOptions: [10, 20, 50, 100] }}
              />
            )
      }
    </div>
  )
}
