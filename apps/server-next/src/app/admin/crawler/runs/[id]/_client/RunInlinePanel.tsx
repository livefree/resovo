'use client'

/**
 * RunInlinePanel.tsx — 批次详情面板（ADR-155 D-155-1 / EP-1A）
 *
 * 从 CrawlerRunDetailView 拆出的自治面板，提供两种消费场景：
 *   1. 行内展开（/admin/crawler/runs 表格内 DataTable.renderExpandedRow）
 *   2. 独立详情页（/admin/crawler/runs/[id] / CrawlerRunDetailView 包裹）
 *
 * 消费：
 *   GET /admin/crawler/runs/:id        — run 详情
 *   GET /admin/crawler/runs/:id/tasks  — 该批次任务列表
 *
 * 设计契约：
 *   - 不含 PageHeader（行内展开场景无外层标题）；refresh 按钮放在 meta card header.actions
 *   - 内部完全自治：state + effects + handlers 全部内聚，调用方仅需传 runId
 *   - ADR-150 / ADR-151：tasks 行级 cancel + batch cancel 与 CW1-B-EP 行为完全一致
 */

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  DataTable,
  AdminCard,
  AdminButton,
  EmptyState,
  ErrorState,
  LoadingState,
  CodeText,
  useToast,
  type ColumnPreference,
  type TableColumn,
  type TableSortState,
  type TableSelectionState,
} from '@resovo/admin-ui'
import {
  getCrawlerRunById,
  listCrawlerRunTasks,
  cancelCrawlerTask,
  batchCancelCrawlerTasks,
  type CrawlerRun,
  type CrawlerRunStatus,
  type CrawlerTaskDto,
  type CrawlerTaskStatus,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'
import { TaskLogsDrawer } from './TaskLogsDrawer'

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

interface BuildTaskColumnsOptions {
  readonly onViewLogs: (taskId: string) => void
  readonly onCancelTask: (task: CrawlerTaskDto) => void
  readonly pendingCancelTaskId: string | null
}

function buildTaskColumns({ onViewLogs, onCancelTask, pendingCancelTaskId }: BuildTaskColumnsOptions): readonly TableColumn<CrawlerTaskDto>[] {
  return [
    {
      id: 'id',
      kind: 'computed',
      header: 'Task ID',
      accessor: (r) => r.id,
      width: 180,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => <CodeText value={`${row.id.slice(0, 8)}…`} dataAttr={{ 'data-task-id': row.id }} />,
    },
    {
      id: 'siteKey',
      kind: 'computed',
      enableSorting: true,
      header: '站点',
      accessor: (r) => r.siteKey,
      width: 140,
      defaultVisible: true,
      cell: ({ row }) => <CodeText value={row.siteKey} />,
    },
    {
      id: 'mode',
      kind: 'computed',
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
      kind: 'computed',
      enableSorting: true,
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
      kind: 'computed',
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
      kind: 'computed',
      enableSorting: true,
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
      kind: 'computed',
      enableSorting: true,
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
      kind: 'computed',
      header: '消息',
      accessor: (r) => r.message,
      width: 220,
      defaultVisible: true,
      cell: ({ row }) =>
        row.message
          ? <span data-task-message style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)' }}>{row.message}</span>
          : <span style={{ color: 'var(--fg-muted)' }}>—</span>,
    },
    {
      id: 'ops',
      kind: 'action',
      header: '操作',
      accessor: (r) => r.id,
      width: 140,
      defaultVisible: true,
      cell: ({ row }) => {
        const canCancel = row.status === 'queued' || row.status === 'running' || row.status === 'paused'
        const cancelPending = pendingCancelTaskId === row.id
        return (
          <span style={{ display: 'inline-flex', gap: '4px' }}>
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={() => onViewLogs(row.id)}
              data-testid={`task-view-logs-${row.id}`}
            >
              查看
            </AdminButton>
            {canCancel ? (
              <AdminButton
                variant="ghost"
                size="sm"
                disabled={cancelPending}
                loading={cancelPending}
                onClick={() => onCancelTask(row)}
                data-testid={`task-cancel-${row.id}`}
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

export interface RunInlinePanelProps {
  readonly runId: string
}

export function RunInlinePanel({ runId }: RunInlinePanelProps) {
  const [run, setRun] = useState<CrawlerRun | null>(null)
  const [runLoading, setRunLoading] = useState(true)
  const [runError, setRunError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const [tasks, setTasks] = useState<readonly CrawlerTaskDto[]>([])
  const [tasksTotal, setTasksTotal] = useState(0)
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksPageSize, setTasksPageSize] = useState(50)
  const [tasksSort, setTasksSort] = useState<TableSortState>({ field: 'startedAt', direction: 'desc' })
  const [tasksColumnPrefs, setTasksColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())
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
    const sortFieldGuarded: 'site' | 'status' | 'startedAt' | 'finishedAt' | undefined =
      tasksSort.field === 'siteKey' ? 'site' :
      tasksSort.field === 'status' ? 'status' :
      tasksSort.field === 'startedAt' ? 'startedAt' :
      tasksSort.field === 'duration' ? 'finishedAt' :
      undefined
    listCrawlerRunTasks(runId, {
      page: tasksPage, limit: tasksPageSize,
      ...(sortFieldGuarded ? { sortField: sortFieldGuarded, sortDir: tasksSort.direction } : {}),
    })
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
  }, [runId, tasksPage, tasksPageSize, tasksSort, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const toast = useToast()
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const [pendingCancelTaskId, setPendingCancelTaskId] = useState<string | null>(null)

  const handleCancelTask = useCallback(async (task: CrawlerTaskDto) => {
    setPendingCancelTaskId(task.id)
    try {
      const result = await cancelCrawlerTask(task.id)
      if (result.alreadyRequested) {
        toast.push({
          title: '已请求取消',
          description: `${task.siteKey} task 上次取消请求仍在等待 worker 响应（≤15s）`,
          level: 'info',
        })
      } else if (result.finalStatus === 'cancelled') {
        toast.push({
          title: '已取消',
          description: `${task.siteKey} task 已置为 cancelled`,
          level: 'success',
        })
      } else {
        toast.push({
          title: '已请求取消',
          description: `${task.siteKey} running task 已通知 worker（15s 内响应）`,
          level: 'success',
        })
      }
      refresh()
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : '请重试')
      const title = err instanceof ApiClientError && err.code === 'TASK_CANCEL_FORBIDDEN_TERMINAL'
        ? '任务已是终态'
        : '取消失败'
      toast.push({ title, description: msg, level: 'danger' })
    } finally {
      setPendingCancelTaskId(null)
    }
  }, [refresh, toast])

  const [selection, setSelection] = useState<TableSelectionState>({ selectedKeys: new Set<string>(), mode: 'page' })
  const [batchCancelPending, setBatchCancelPending] = useState(false)

  const handleBatchCancel = useCallback(async () => {
    const ids = Array.from(selection.selectedKeys)
    if (ids.length === 0) return
    if (ids.length > 50 && !confirm(`确定批量取消 ${ids.length} 个 task？该操作不可撤销。`)) return
    setBatchCancelPending(true)
    try {
      const result = await batchCancelCrawlerTasks(ids)
      const { cancelled, cancelRequested, alreadyRequested, errors } = result.summary
      toast.push({
        title: '批量取消完成',
        description: `已取消 ${cancelled} · 已请求 ${cancelRequested} · 已在等待 ${alreadyRequested}${errors.length > 0 ? ` · 失败 ${errors.length}` : ''}`,
        level: errors.length === 0 ? 'success' : 'warn',
      })
      setSelection({ selectedKeys: new Set<string>(), mode: 'page' })
      refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '请重试'
      toast.push({ title: '批量取消失败', description: msg, level: 'danger' })
    } finally {
      setBatchCancelPending(false)
    }
  }, [selection, refresh, toast])

  const taskColumns = useMemo(
    () => buildTaskColumns({
      onViewLogs: (id) => setOpenTaskId(id),
      onCancelTask: handleCancelTask,
      pendingCancelTaskId,
    }),
    [handleCancelTask, pendingCancelTaskId],
  )

  const tasksQuery = useMemo(
    () => ({
      pagination: { page: tasksPage, pageSize: tasksPageSize },
      sort: tasksSort,
      filters: new Map(),
      columns: tasksColumnPrefs,
      selection,
    }),
    [tasksPage, tasksPageSize, tasksSort, selection, tasksColumnPrefs],
  )

  if (runLoading && !run) {
    return (
      <div data-run-inline-panel data-state="loading" style={SECTION_STYLE}>
        <LoadingState variant="skeleton" />
      </div>
    )
  }

  if (runError) {
    return (
      <div data-run-inline-panel data-state="error" style={SECTION_STYLE}>
        <ErrorState error={runError} title="批次加载失败" onRetry={refresh} />
      </div>
    )
  }

  if (!run) {
    return (
      <div data-run-inline-panel data-state="not-found" style={SECTION_STYLE}>
        <EmptyState title="批次不存在" description="可能已被删除或 ID 无效" />
      </div>
    )
  }

  const runBadge = RUN_STATUS_BADGE[run.status]

  return (
    <div data-run-inline-panel data-state="loaded" style={SECTION_STYLE}>
      <AdminCard
        surface="elevated"
        padding="md"
        header={{
          title: '基础信息',
          actions: (
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={refresh}
              data-testid="run-detail-refresh"
            >
              刷新
            </AdminButton>
          ),
        }}
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
            <span style={META_LABEL_STYLE}>触发 · 模式</span>
            <span style={META_VALUE_STYLE}>触发 {run.triggerType} · 模式 {run.mode}</span>
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
                  columns={taskColumns}
                  rowKey={(r) => r.id}
                  mode="server"
                  query={tasksQuery}
                  selection={selection}
                  onSelectionChange={setSelection}
                  bulkActions={
                    selection.selectedKeys.size > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)' }}>
                          已选 {selection.selectedKeys.size} 个
                        </span>
                        <AdminButton
                          variant="danger"
                          size="sm"
                          loading={batchCancelPending}
                          disabled={batchCancelPending}
                          onClick={() => void handleBatchCancel()}
                          data-testid="task-batch-cancel-btn"
                        >
                          批量取消
                        </AdminButton>
                      </span>
                    ) : null
                  }
                  onQueryChange={(patch) => {
                    if (patch.pagination) {
                      if (patch.pagination.page !== undefined) setTasksPage(patch.pagination.page)
                      if (patch.pagination.pageSize !== undefined) {
                        setTasksPageSize(patch.pagination.pageSize)
                        setTasksPage(1)
                      }
                    }
                    if (patch.sort) setTasksSort(patch.sort)
                    if (patch.columns) setTasksColumnPrefs(patch.columns)
                  }}
                  totalRows={tasksTotal}
                  loading={tasksLoading}
                  emptyState={<EmptyState title="暂无任务" description="该批次未产生任务记录" />}
                  data-testid="run-detail-tasks-table"
                  enableColumnResizing
                  pagination={{ pageSizeOptions: [20, 50, 100, 200] }}
                />
              )
        }
      </AdminCard>

      <TaskLogsDrawer
        open={openTaskId !== null}
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
      />
    </div>
  )
}
