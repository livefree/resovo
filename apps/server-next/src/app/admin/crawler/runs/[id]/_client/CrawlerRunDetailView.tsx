'use client'

/**
 * CrawlerRunDetailView.tsx — /admin/crawler/runs/:id 批次详情视图（CHG-SN-6-17）
 *
 * 消费：
 *   GET /admin/crawler/runs/:id        — run 详情
 *   GET /admin/crawler/runs/:id/tasks  — 该批次任务列表
 *
 * 不在范围（独立卡）：
 *   - tasks 行操作（cancel/retry）
 *   - tasks 日志查看
 *   - DAG 视图
 */

import React, { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  DataTable,
  AdminCard,
  AdminButton,
  EmptyState,
  ErrorState,
  LoadingState,
  CodeText,
  PageHeader,
  type TableColumn,
  type TableSortState,
} from '@resovo/admin-ui'
import {
  getCrawlerRunById,
  listCrawlerRunTasks,
  type CrawlerRun,
  type CrawlerRunStatus,
  type CrawlerTaskDto,
  type CrawlerTaskStatus,
} from '@/lib/crawler/api'

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

const META_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
}

const META_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const META_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const META_VALUE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
}

const RUN_STATUS_BADGE: Record<CrawlerRunStatus, { label: string; bg: string; color: string }> = {
  queued:         { label: '排队中', bg: 'var(--state-info-bg)',     color: 'var(--state-info-fg)' },
  running:        { label: '运行中', bg: 'var(--state-info-bg)',     color: 'var(--state-info-fg)' },
  paused:         { label: '暂停',   bg: 'var(--state-warning-bg)',  color: 'var(--state-warning-fg)' },
  success:        { label: '成功',   bg: 'var(--state-success-bg)',  color: 'var(--state-success-fg)' },
  partial_failed: { label: '部分失败', bg: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)' },
  failed:         { label: '失败',   bg: 'var(--state-danger-bg)',   color: 'var(--state-danger-fg)' },
  cancelled:      { label: '已取消', bg: 'var(--bg-surface-sunken)', color: 'var(--fg-muted)' },
}

const TASK_STATUS_BADGE: Record<CrawlerTaskStatus, { label: string; bg: string; color: string }> = {
  queued:    { label: '排队中', bg: 'var(--state-info-bg)',     color: 'var(--state-info-fg)' },
  running:   { label: '运行中', bg: 'var(--state-info-bg)',     color: 'var(--state-info-fg)' },
  paused:    { label: '暂停',   bg: 'var(--state-warning-bg)',  color: 'var(--state-warning-fg)' },
  success:   { label: '成功',   bg: 'var(--state-success-bg)',  color: 'var(--state-success-fg)' },
  failed:    { label: '失败',   bg: 'var(--state-danger-bg)',   color: 'var(--state-danger-fg)' },
  cancelled: { label: '已取消', bg: 'var(--bg-surface-sunken)', color: 'var(--fg-muted)' },
  timeout:   { label: '超时',   bg: 'var(--state-danger-bg)',   color: 'var(--state-danger-fg)' },
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  const sec = Math.round((end - start) / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  return `${min}m${sec % 60}s`
}

const TASK_COLUMNS: readonly TableColumn<CrawlerTaskDto>[] = [
  {
    id: 'id',
    header: 'Task ID',
    accessor: (r) => r.id,
    width: 180,
    defaultVisible: true,
    pinned: true,
    cell: ({ row }) => <CodeText value={`${row.id.slice(0, 8)}…`} dataAttr={{ 'data-task-id': row.id }} />,
  },
  {
    id: 'siteKey',
    header: '站点',
    accessor: (r) => r.siteKey,
    width: 140,
    defaultVisible: true,
    cell: ({ row }) => <CodeText value={row.siteKey} />,
  },
  {
    id: 'mode',
    header: '模式',
    accessor: (r) => r.mode,
    width: 100,
    defaultVisible: true,
    cell: ({ row }) => (
      <span style={{ fontSize: 'var(--font-size-xs)' }} data-task-mode={row.mode}>
        {row.mode === 'incremental' ? '增量' : '全量'}
      </span>
    ),
  },
  {
    id: 'status',
    header: '状态',
    accessor: (r) => r.status,
    width: 100,
    defaultVisible: true,
    cell: ({ row }) => {
      const cfg = TASK_STATUS_BADGE[row.status]
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
          data-task-status={row.status}
        >
          {cfg.label}
        </span>
      )
    },
  },
  {
    id: 'itemCount',
    header: '产出',
    accessor: (r) => r.itemCount,
    width: 90,
    defaultVisible: true,
    cell: ({ row }) =>
      row.itemCount == null
        ? <span style={{ color: 'var(--fg-muted)' }}>—</span>
        : <span data-task-item-count style={{ fontSize: 'var(--font-size-xs)' }}>{row.itemCount}</span>,
  },
  {
    id: 'startedAt',
    header: '开始时间',
    accessor: (r) => r.startedAt,
    width: 160,
    defaultVisible: true,
    cell: ({ row }) => (
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
        {formatTime(row.startedAt)}
      </span>
    ),
  },
  {
    id: 'duration',
    header: '耗时',
    accessor: (r) => r.finishedAt,
    width: 100,
    defaultVisible: true,
    cell: ({ row }) => (
      <span style={{ fontSize: 'var(--font-size-xs)' }}>
        {formatDuration(row.startedAt, row.finishedAt)}
      </span>
    ),
  },
  {
    id: 'message',
    header: '消息',
    accessor: (r) => r.message,
    width: 220,
    defaultVisible: true,
    cell: ({ row }) =>
      row.message
        ? <span data-task-message style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)' }}>{row.message}</span>
        : <span style={{ color: 'var(--fg-muted)' }}>—</span>,
  },
]

export interface CrawlerRunDetailViewProps {
  readonly runId: string
}

export function CrawlerRunDetailView({ runId }: CrawlerRunDetailViewProps) {
  const [run, setRun] = useState<CrawlerRun | null>(null)
  const [runLoading, setRunLoading] = useState(true)
  const [runError, setRunError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const [tasks, setTasks] = useState<readonly CrawlerTaskDto[]>([])
  const [tasksTotal, setTasksTotal] = useState(0)
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksPageSize, setTasksPageSize] = useState(50)
  const [tasksSort, setTasksSort] = useState<TableSortState>({ field: 'startedAt', direction: 'desc' })
  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasksError, setTasksError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setRunLoading(true)
    setRunError(null)
    getCrawlerRunById(runId)
      .then((data) => { if (!cancelled) setRun(data) })
      .catch((err: unknown) => {
        if (!cancelled) setRunError(err instanceof Error ? err : new Error('批次加载失败'))
      })
      .finally(() => { if (!cancelled) setRunLoading(false) })
    return () => { cancelled = true }
  }, [runId, retryKey])

  useEffect(() => {
    let cancelled = false
    setTasksLoading(true)
    setTasksError(null)
    listCrawlerRunTasks(runId, { page: tasksPage, limit: tasksPageSize })
      .then((res) => {
        if (cancelled) return
        setTasks(res.data)
        setTasksTotal(res.pagination.total)
      })
      .catch((err: unknown) => {
        if (!cancelled) setTasksError(err instanceof Error ? err : new Error('tasks 加载失败'))
      })
      .finally(() => { if (!cancelled) setTasksLoading(false) })
    return () => { cancelled = true }
  }, [runId, tasksPage, tasksPageSize, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const tasksQuery = useMemo(
    () => ({
      pagination: { page: tasksPage, pageSize: tasksPageSize },
      sort: tasksSort,
      filters: new Map(),
      columns: new Map(),
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [tasksPage, tasksPageSize, tasksSort],
  )

  if (runLoading && !run) {
    return (
      <div data-crawler-run-detail data-state="loading" style={SECTION_STYLE}>
        <LoadingState variant="skeleton" />
      </div>
    )
  }

  if (runError) {
    return (
      <div data-crawler-run-detail data-state="error" style={SECTION_STYLE}>
        <ErrorState error={runError} title="批次加载失败" onRetry={refresh} />
      </div>
    )
  }

  if (!run) {
    return (
      <div data-crawler-run-detail data-state="not-found" style={SECTION_STYLE}>
        <EmptyState title="批次不存在" description="可能已被删除或 ID 无效" />
      </div>
    )
  }

  const runBadge = RUN_STATUS_BADGE[run.status]

  return (
    <div data-crawler-run-detail data-state="loaded" style={SECTION_STYLE}>
      <PageHeader
        title={`批次 ${run.id.slice(0, 8)}…`}
        subtitle={`触发 ${run.triggerType} · 模式 ${run.mode}`}
        actions={
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={refresh}
            data-testid="run-detail-refresh"
          >
            刷新
          </AdminButton>
        }
      />

      <AdminCard
        surface="elevated"
        padding="md"
        header={{ title: '基础信息' }}
        data-testid="run-detail-meta"
      >
        <div style={META_GRID_STYLE}>
          <div style={META_ITEM_STYLE}>
            <span style={META_LABEL_STYLE}>状态</span>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill, 12px)',
                fontSize: 'var(--font-size-xs)',
                background: runBadge.bg,
                color: runBadge.color,
                width: 'fit-content',
              }}
              data-run-status={run.status}
            >
              {runBadge.label}
            </span>
          </div>
          <div style={META_ITEM_STYLE}>
            <span style={META_LABEL_STYLE}>控制状态</span>
            <CodeText value={run.controlStatus} muted />
          </div>
          <div style={META_ITEM_STYLE}>
            <span style={META_LABEL_STYLE}>站点数</span>
            <span style={META_VALUE_STYLE} data-site-count>
              已入队 {run.enqueuedSiteCount} / 请求 {run.requestedSiteCount}
              {run.skippedSiteCount > 0 ? ` · 跳过 ${run.skippedSiteCount}` : ''}
            </span>
          </div>
          <div style={META_ITEM_STYLE}>
            <span style={META_LABEL_STYLE}>创建时间</span>
            <span style={META_VALUE_STYLE}>{formatTime(run.createdAt)}</span>
          </div>
          <div style={META_ITEM_STYLE}>
            <span style={META_LABEL_STYLE}>开始时间</span>
            <span style={META_VALUE_STYLE}>{formatTime(run.startedAt)}</span>
          </div>
          <div style={META_ITEM_STYLE}>
            <span style={META_LABEL_STYLE}>结束时间</span>
            <span style={META_VALUE_STYLE}>{formatTime(run.finishedAt)}</span>
          </div>
          <div style={META_ITEM_STYLE}>
            <span style={META_LABEL_STYLE}>耗时</span>
            <span style={META_VALUE_STYLE} data-run-duration>
              {formatDuration(run.startedAt, run.finishedAt)}
            </span>
          </div>
          <div style={META_ITEM_STYLE}>
            <span style={META_LABEL_STYLE}>创建者</span>
            <span style={META_VALUE_STYLE}>
              {run.createdBy ? <CodeText value={run.createdBy} /> : <span style={{ color: 'var(--fg-muted)' }}>—</span>}
            </span>
          </div>
        </div>
      </AdminCard>

      <AdminCard
        surface="elevated"
        padding="none"
        header={{ title: '任务列表', subtitle: `共 ${tasksTotal} 个任务` }}
        data-testid="run-detail-tasks"
      >
        {tasksLoading && tasks.length === 0
          ? <div style={{ padding: '14px' }}><LoadingState variant="skeleton" /></div>
          : tasksError
            ? <div style={{ padding: '14px' }}><ErrorState error={tasksError} title="任务加载失败" onRetry={refresh} /></div>
            : (
                <DataTable<CrawlerTaskDto>
                  rows={tasks}
                  columns={TASK_COLUMNS}
                  rowKey={(r) => r.id}
                  mode="server"
                  query={tasksQuery}
                  onQueryChange={(patch) => {
                    if (patch.pagination) {
                      if (patch.pagination.page !== undefined) setTasksPage(patch.pagination.page)
                      if (patch.pagination.pageSize !== undefined) {
                        setTasksPageSize(patch.pagination.pageSize)
                        setTasksPage(1)
                      }
                    }
                    if (patch.sort) setTasksSort(patch.sort)
                  }}
                  totalRows={tasksTotal}
                  loading={tasksLoading}
                  emptyState={<EmptyState title="暂无任务" description="该批次未产生任务记录" />}
                  data-testid="run-detail-tasks-table"
                  pagination={{ pageSizeOptions: [20, 50, 100, 200] }}
                />
              )
        }
      </AdminCard>
    </div>
  )
}
