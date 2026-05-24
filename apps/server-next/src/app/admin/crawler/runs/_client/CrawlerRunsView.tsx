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
  AdminButton,
  EmptyState,
  ErrorState,
  LoadingState,
  CodeText,
  useToast,
  type AdminSelectOption,
  type DistinctOption,
  type FilterValue,
  type TableColumn,
  type TableSortState,
} from '@resovo/admin-ui'
import {
  listCrawlerRuns,
  cancelCrawlerRun,
  pauseCrawlerRun,
  resumeCrawlerRun,
  type CrawlerRun,
  type CrawlerRunStatus,
  type CrawlerRunTriggerType,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

// ADR-149 EP-5-crawler-runs: TOOLBAR_STYLE 已删（toolbarSearch 删除后无用）

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

// ADR-150 阶段 4 / EP-3-A sub 1：D-149-15 桥接 helper 已删（列固有 D-150 范式 / filterOptions 直接用）
// 静态选项（D-150-1 双轨 / 优先静态 / 走后端 distinct API 留作其它列）
const STATUS_FILTER_OPTIONS: readonly DistinctOption[] = STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: typeof o.label === 'string' ? o.label : o.value,
}))
const TRIGGER_TYPE_FILTER_OPTIONS: readonly DistinctOption[] = TRIGGER_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: typeof o.label === 'string' ? o.label : o.value,
}))

interface BuildColumnsOptions {
  readonly onCancel: (row: CrawlerRun) => void
  readonly onPause: (row: CrawlerRun) => void
  readonly onResume: (row: CrawlerRun) => void
  readonly pendingRunId: string | null
}

function buildColumns({
  onCancel,
  onPause,
  onResume,
  pendingRunId,
}: BuildColumnsOptions): readonly TableColumn<CrawlerRun>[] {
  return [
    {
      id: 'id',
      header: 'Run ID',
      accessor: (r) => r.id,
      width: 200,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => (
        <a
          href={`/admin/crawler/runs/${row.id}`}
          data-run-id={row.id}
          data-testid={`run-link-${row.id}`}
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--fg-link, var(--fg-default))',
            textDecoration: 'underline',
          }}
        >
          {row.id.slice(0, 8)}…
        </a>
      ),
    },
    {
      id: 'status',
      header: '状态',
      accessor: (r) => r.status,
      width: 110,
      defaultVisible: true,
      // ADR-150 阶段 4 / EP-3-A sub 1：D-149-15 桥接 → D-150 列固有自动过滤
      filterable: true,
      filterFieldName: 'status',
      filterKind: 'enum',
      filterOptions: STATUS_FILTER_OPTIONS,
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
      // ADR-150 阶段 4 / EP-3-A sub 1：D-149-15 桥接 → D-150 列固有自动过滤
      filterable: true,
      filterFieldName: 'triggerType',
      filterKind: 'enum',
      filterOptions: TRIGGER_TYPE_FILTER_OPTIONS,
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
    {
      id: 'ops',
      header: '操作',
      accessor: (r) => r.status,
      width: 180,
      defaultVisible: true,
      cell: ({ row }) => {
        const pending = pendingRunId === row.id
        const showCancel = row.status === 'queued' || row.status === 'running' || row.status === 'paused'
        const showPause = row.status === 'running' || row.status === 'queued'
        const showResume = row.status === 'paused'

        if (!showCancel && !showPause && !showResume) {
          return <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)' }}>—</span>
        }

        return (
          <span style={{ display: 'inline-flex', gap: '4px' }}>
            {showPause ? (
              <AdminButton
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => onPause(row)}
                data-testid={`run-pause-${row.id}`}
              >
                暂停
              </AdminButton>
            ) : null}
            {showResume ? (
              <AdminButton
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => onResume(row)}
                data-testid={`run-resume-${row.id}`}
              >
                恢复
              </AdminButton>
            ) : null}
            {showCancel ? (
              <AdminButton
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() => onCancel(row)}
                data-testid={`run-cancel-${row.id}`}
              >
                取消
              </AdminButton>
            ) : null}
          </span>
        )
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
  // EP-5-crawler-runs-PATCH-B: 多选 state（空数组 = 未过滤）
  // ADR-150 阶段 4 / EP-3-A sub 1：filtersMap 统一管理所有列过滤（替代 statusFilter/triggerTypeFilter 独立 state）
  // D-150-4 业务 filter key：'status' / 'trigger_type'（与 column.filterFieldName + 后端 FILTER_FIELDS 对齐）
  const [filtersMap, setFiltersMap] = useState<ReadonlyMap<string, FilterValue>>(new Map())
  const statusFilter = useMemo<readonly CrawlerRunStatus[]>(() => {
    const v = filtersMap.get('status')
    return v?.kind === 'enum' ? (v.value as readonly CrawlerRunStatus[]) : []
  }, [filtersMap])
  const triggerTypeFilter = useMemo<readonly CrawlerRunTriggerType[]>(() => {
    const v = filtersMap.get('triggerType')
    return v?.kind === 'enum' ? (v.value as readonly CrawlerRunTriggerType[]) : []
  }, [filtersMap])
  // EP-4.5-HOTFIX-3 / 问题 1+3：列偏好 state（矩阵 popover 可见性 toggle / 列级 ⋯ 隐藏此列触发）
  const [columnPrefs, setColumnPrefs] = useState<ReadonlyMap<string, { readonly visible: boolean; readonly width?: number }>>(new Map())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listCrawlerRuns({
      page,
      limit: pageSize,
      ...(statusFilter.length > 0 ? { status: statusFilter } : {}),
      ...(triggerTypeFilter.length > 0 ? { triggerType: triggerTypeFilter } : {}),
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
  }, [page, pageSize, filtersMap, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const [pendingRunId, setPendingRunId] = useState<string | null>(null)

  const handleCancel = useCallback(async (run: CrawlerRun) => {
    if (typeof window !== 'undefined' && !window.confirm(`确定取消 run ${run.id.slice(0, 8)}…？`)) return
    setPendingRunId(run.id)
    try {
      const result = await cancelCrawlerRun(run.id)
      toast.push({
        title: '已请求取消',
        description: `已取消排队 ${result.cancelledPending}，已通知运行中 ${result.signaledRunning}`,
        level: 'success',
      })
      refresh()
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : '请重试')
      toast.push({ title: '取消失败', description: msg, level: 'danger' })
    } finally {
      setPendingRunId(null)
    }
  }, [toast, refresh])

  const handlePause = useCallback(async (run: CrawlerRun) => {
    setPendingRunId(run.id)
    try {
      const result = await pauseCrawlerRun(run.id)
      toast.push({ title: '已暂停', description: `controlStatus: ${result.controlStatus}`, level: 'success' })
      refresh()
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : '请重试')
      toast.push({ title: '暂停失败', description: msg, level: 'danger' })
    } finally {
      setPendingRunId(null)
    }
  }, [toast, refresh])

  const handleResume = useCallback(async (run: CrawlerRun) => {
    setPendingRunId(run.id)
    try {
      const result = await resumeCrawlerRun(run.id)
      toast.push({ title: '已恢复', description: `controlStatus: ${result.controlStatus}`, level: 'success' })
      refresh()
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : '请重试')
      toast.push({ title: '恢复失败', description: msg, level: 'danger' })
    } finally {
      setPendingRunId(null)
    }
  }, [toast, refresh])

  // ADR-150 阶段 4 / EP-3-A sub 1：handleStatusChange/handleTriggerTypeChange 已删
  // DataTable popover 应用 → onQueryChange({ filters: next }) → setFiltersMap → fetch deps 触发

  const columns = useMemo(
    () => buildColumns({
      onCancel: handleCancel,
      onPause: handlePause,
      onResume: handleResume,
      pendingRunId,
    }),
    [handleCancel, handlePause, handleResume, pendingRunId],
  )

  // ADR-149 EP-5-crawler-runs: toolbar.search 已删（业务 filter 迁移到列级 ⋯ + 矩阵 popover）
  // toolbar 仅剩矩阵触发器（EP-4.5 已实装永驻渲染）

  const query = useMemo(
    () => ({
      pagination: { page, pageSize },
      sort,
      // ADR-150 阶段 4 / EP-3-A sub 1：filters 用 filtersMap state（D-150-4 业务 key 统一）
      filters: filtersMap,
      // EP-4.5-HOTFIX-3 / 问题 1+3：columns 用 state 不再是空 Map（让矩阵 popover toggle 真生效）
      columns: columnPrefs,
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [page, pageSize, sort, filtersMap, columnPrefs],
  )

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
                  // EP-4.5-HOTFIX-3 / 问题 1+3：消费 columns patch（矩阵 popover 可见性 toggle / 列级 ⋯ 隐藏此列）
                  if (patch.columns) setColumnPrefs(patch.columns)
                  // ADR-150 阶段 4 / EP-3-A sub 1：消费 filters patch（DataTableAutoFilter popover OK 触发）
                  if (patch.filters) { setFiltersMap(patch.filters); setPage(1) }
                }}
                totalRows={total}
                loading={loading}
                emptyState={<EmptyState title="暂无 runs" description="尚未触发采集批次，可在站点页面发起采集" />}
                data-testid="crawler-runs-table"
                enableHeaderMenu
                toolbar={{
                  hideFilterChips: true,
                }}
                pagination={{ pageSizeOptions: [10, 20, 50, 100] }}
              />
            )
      }
    </div>
  )
}
