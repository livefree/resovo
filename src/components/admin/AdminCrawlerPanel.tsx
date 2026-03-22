/**
 * AdminCrawlerPanel.tsx — 爬虫管理面板
 * CHG-36: 全局触发 + 任务记录展示
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'

// ── 类型 ─────────────────────────────────────────────────────────

interface CrawlerTask {
  id: string
  type: string
  status: 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled' | 'timeout'
  triggerType: 'single' | 'batch' | 'all' | 'schedule' | null
  runId?: string | null
  run_id?: string | null
  sourceSite?: string
  source_url: string | null
  result?: {
    error?: string
    [key: string]: unknown
  } | null
  scheduledAt?: string | null
  finishedAt?: string | null
  startedAt?: string | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

interface CrawlerTaskLogItem {
  id: string
  level: 'info' | 'warn' | 'error'
  stage: string
  message: string
  createdAt: string
}

type TaskStatusFilter = 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled' | 'timeout' | ''
type TaskTriggerFilter = 'single' | 'batch' | 'all' | 'schedule' | ''

type CrawlerTaskColumnId =
  | 'runId'
  | 'type'
  | 'site'
  | 'triggerType'
  | 'status'
  | 'startedAt'
  | 'finishedAt'
  | 'error'
  | 'actions'

const CRAWLER_TASK_COLUMN_LABELS: Record<CrawlerTaskColumnId, string> = {
  runId: 'Run ID',
  type: '类型',
  site: '站点',
  triggerType: '触发来源',
  status: '状态',
  startedAt: '开始时间',
  finishedAt: '结束时间',
  error: '错误信息',
  actions: '操作',
}

const CRAWLER_TASK_COLUMNS: AdminColumnMeta[] = [
  { id: 'runId', visible: true, width: 120, minWidth: 100, maxWidth: 220, resizable: true },
  { id: 'type', visible: true, width: 120, minWidth: 96, maxWidth: 220, resizable: true },
  { id: 'site', visible: true, width: 220, minWidth: 150, maxWidth: 420, resizable: true },
  { id: 'triggerType', visible: true, width: 120, minWidth: 96, maxWidth: 200, resizable: true },
  { id: 'status', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'startedAt', visible: true, width: 180, minWidth: 140, maxWidth: 280, resizable: true },
  { id: 'finishedAt', visible: true, width: 180, minWidth: 140, maxWidth: 280, resizable: true },
  { id: 'error', visible: true, width: 260, minWidth: 180, maxWidth: 520, resizable: true },
  { id: 'actions', visible: true, width: 120, minWidth: 100, maxWidth: 180, resizable: false },
]

// ── 小组件 ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CrawlerTask['status'] }) {
  const map: Record<CrawlerTask['status'], string> = {
    pending: 'bg-yellow-900/30 text-yellow-400',
    running: 'bg-blue-900/30 text-blue-400',
    paused: 'bg-zinc-700/40 text-zinc-300',
    done:    'bg-green-900/30 text-green-400',
    failed:  'bg-red-900/30 text-red-400',
    cancelled: 'bg-zinc-700/40 text-zinc-300',
    timeout: 'bg-orange-900/30 text-orange-400',
  }
  const labels: Record<CrawlerTask['status'], string> = {
    pending: '等待中',
    running: '运行中',
    paused: '已暂停',
    done:    '已完成',
    failed:  '失败',
    cancelled: '已取消',
    timeout: '超时',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${map[status]}`}>
      {labels[status]}
    </span>
  )
}

function TriggerBadge({ triggerType }: { triggerType: CrawlerTask['triggerType'] }) {
  const labels: Record<Exclude<CrawlerTask['triggerType'], null>, string> = {
    single: '单站',
    batch: '批量',
    all: '全站',
    schedule: '定时',
  }
  if (!triggerType) return <span className="text-xs text-[var(--muted)]">—</span>
  return (
    <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)]">
      {labels[triggerType]}
    </span>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────

interface AdminCrawlerPanelProps {
  initialRunId?: string
  initialStatusFilter?: TaskStatusFilter
  onRunIdChange?: (runId: string) => void
}

export function AdminCrawlerPanel({ initialRunId = '', initialStatusFilter = '', onRunIdChange }: AdminCrawlerPanelProps) {
  const [tasks, setTasks] = useState<CrawlerTask[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('')
  const [triggerFilter, setTriggerFilter] = useState<TaskTriggerFilter>('')
  const [runIdFilterInput, setRunIdFilterInput] = useState('')
  const [runIdFilter, setRunIdFilter] = useState('')
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logTaskId, setLogTaskId] = useState<string | null>(null)
  const [logLoading, setLogLoading] = useState(false)
  const [taskLogs, setTaskLogs] = useState<CrawlerTaskLogItem[]>([])

  const limit = 20
  const columnsState = useAdminTableColumns({
    route: '/admin/crawler',
    tableId: 'task-records',
    columns: CRAWLER_TASK_COLUMNS,
  })
  const sortState = useAdminTableSort({
    tableState: columnsState,
    sortable: {
      runId: true,
      type: true,
      site: true,
      triggerType: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      error: true,
      actions: false,
    },
    columnsById: columnsState.columnsById,
  })

  // 加载任务列表
  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (statusFilter) params.set('status', statusFilter)
      if (triggerFilter) params.set('triggerType', triggerFilter)
      if (runIdFilter) params.set('runId', runIdFilter)
      const res = await apiClient.get<{ data: CrawlerTask[]; pagination: { total: number } }>(
        `/admin/crawler/tasks?${params}`
      )
      setTasks(res.data)
      setTotal(res.pagination.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, triggerFilter, runIdFilter])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    const nextRunId = initialRunId.trim()
    if (!nextRunId) return
    setRunIdFilterInput(nextRunId)
    setRunIdFilter(nextRunId)
    setPage(1)
  }, [initialRunId])

  useEffect(() => {
    if (!initialStatusFilter) return
    setStatusFilter(initialStatusFilter)
    setPage(1)
  }, [initialStatusFilter])

  async function handleViewLogs(taskId: string) {
    setLogTaskId(taskId)
    setLogLoading(true)
    try {
      const res = await apiClient.get<{ data: { logs: CrawlerTaskLogItem[] } }>(
        `/admin/crawler/tasks/${taskId}/logs?limit=50`
      )
      setTaskLogs(res.data.logs ?? [])
    } catch (err) {
      alert(err instanceof Error ? err.message : '日志加载失败')
      setTaskLogs([])
    } finally {
      setLogLoading(false)
    }
  }

  function parseTime(value: string | null | undefined) {
    return value ? new Date(value).toLocaleString() : '—'
  }

  function getRunId(task: CrawlerTask) {
    return task.runId ?? task.run_id ?? null
  }

  function getSiteKey(task: CrawlerTask) {
    return task.sourceSite ?? task.source_url ?? '—'
  }

  function getErrorMessage(task: CrawlerTask) {
    const resultError = typeof task.result?.error === 'string' ? task.result.error : null
    return task.error ?? resultError ?? '—'
  }

  function getSortValue(task: CrawlerTask, field: string) {
    switch (field as CrawlerTaskColumnId) {
      case 'runId':
        return getRunId(task) ?? ''
      case 'type':
        return task.type ?? ''
      case 'site':
        return getSiteKey(task)
      case 'triggerType':
        return task.triggerType ?? ''
      case 'status':
        return task.status
      case 'startedAt':
        return new Date(task.startedAt ?? task.started_at ?? task.scheduledAt ?? 0).getTime()
      case 'finishedAt':
        return new Date(task.finishedAt ?? task.finished_at ?? 0).getTime()
      case 'error':
        return getErrorMessage(task)
      default:
        return ''
    }
  }

  const visibleColumnIds = useMemo(
    () => columnsState.columns.filter((column) => column.visible).map((column) => column.id as CrawlerTaskColumnId),
    [columnsState.columns],
  )

  const sort = sortState.sort
  const sortedTasks = !sort
    ? tasks
    : [...tasks].sort((a, b) => {
        const factor = sort.dir === 'asc' ? 1 : -1
        const left = getSortValue(a, sort.field)
        const right = getSortValue(b, sort.field)
        if (typeof left === 'number' && typeof right === 'number') {
          return (left - right) * factor
        }
        return String(left).localeCompare(String(right), 'zh-Hans-CN') * factor
      })

  const totalPages = Math.ceil(total / limit)
  return (
    <div data-testid="admin-crawler-panel" className="space-y-6">
      <div className="rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--muted)]">
        本页仅用于任务查询与日志审计。采集触发统一在「采集控制台」执行。
      </div>

      {/* ── 状态筛选 ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--muted)]">采集任务记录</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowColumnsPanel((prev) => !prev)}
              className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
              data-testid="admin-crawler-columns"
            >
              显示列
            </button>
            <button
              type="button"
              onClick={() => { void fetchTasks() }}
              className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
              data-testid="admin-crawler-refresh"
            >
              刷新
            </button>
          </div>
        </div>
        {showColumnsPanel && (
          <div className="mb-3 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">列显示</span>
              <button
                type="button"
                className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
                onClick={() => columnsState.resetColumnsMeta()}
              >
                重置
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {columnsState.columns.map((column) => (
                <label key={column.id} className="flex items-center gap-2 text-xs text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={column.visible}
                    onChange={() => columnsState.toggleColumnVisibility(column.id)}
                    className="accent-[var(--accent)]"
                  />
                  {CRAWLER_TASK_COLUMN_LABELS[column.id as CrawlerTaskColumnId]}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="mb-3 flex gap-1 rounded-md border border-[var(--border)] p-0.5 w-fit">
          {([
            { value: '', label: '全部' },
            { value: 'pending', label: '等待中' },
            { value: 'running', label: '运行中' },
            { value: 'paused', label: '已暂停' },
            { value: 'done', label: '已完成' },
            { value: 'failed', label: '失败' },
            { value: 'cancelled', label: '已取消' },
            { value: 'timeout', label: '超时' },
          ] as { value: TaskStatusFilter; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setPage(1); setStatusFilter(value) }}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                statusFilter === value
                  ? 'bg-[var(--accent)] text-black'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              data-testid={`admin-crawler-filter-${value || 'all'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mb-4 flex gap-1 rounded-md border border-[var(--border)] p-0.5 w-fit">
          {([
            { value: '', label: '全部来源' },
            { value: 'single', label: '单站' },
            { value: 'batch', label: '批量' },
            { value: 'all', label: '全站' },
            { value: 'schedule', label: '定时' },
          ] as { value: TaskTriggerFilter; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setPage(1); setTriggerFilter(value) }}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                triggerFilter === value
                  ? 'bg-[var(--accent)] text-black'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              data-testid={`admin-crawler-trigger-filter-${value || 'all'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={runIdFilterInput}
            onChange={(e) => setRunIdFilterInput(e.target.value)}
            placeholder="按 Run ID 过滤（完整 UUID）"
            className="w-[320px] rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            data-testid="admin-crawler-runid-input"
          />
          <button
            type="button"
            onClick={() => {
              setPage(1)
              const nextRunId = runIdFilterInput.trim()
              setRunIdFilter(nextRunId)
              onRunIdChange?.(nextRunId)
            }}
            className="rounded border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--bg2)]"
            data-testid="admin-crawler-runid-apply"
          >
            应用
          </button>
          <button
            type="button"
            onClick={() => {
              setPage(1)
              setRunIdFilter('')
              setRunIdFilterInput('')
              onRunIdChange?.('')
            }}
            className="rounded border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
            data-testid="admin-crawler-runid-clear"
          >
            清除
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
        )}

        <AdminTableFrame minWidth={1450}>
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              {visibleColumnIds.map((columnId) => {
                const meta = columnsState.columnsById[columnId]
                const sortable = sortState.isSortable(columnId)
                const sorted = sortState.isSortedBy(columnId)
                return (
                  <th key={columnId} className="relative px-4 py-3 text-left" style={{ width: `${meta.width}px` }}>
                    {sortable ? (
                      <button
                        type="button"
                        className="text-left text-xs hover:text-[var(--text)]"
                        onClick={() => sortState.toggleSort(columnId)}
                      >
                        {CRAWLER_TASK_COLUMN_LABELS[columnId]}
                        {sorted ? (sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    ) : (
                      <span className="text-xs">{CRAWLER_TASK_COLUMN_LABELS[columnId]}</span>
                    )}
                    {meta.resizable && (
                      <button
                        type="button"
                        onMouseDown={(event) => columnsState.startResize(columnId, event.clientX)}
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize before:absolute before:right-0 before:top-0 before:h-full before:w-px before:bg-[var(--border)] hover:bg-[var(--bg3)]/40"
                        aria-label={`${CRAWLER_TASK_COLUMN_LABELS[columnId]}列宽拖拽`}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--subtle)]">
            <AdminTableState
              isLoading={loading}
              isEmpty={!loading && sortedTasks.length === 0}
              colSpan={visibleColumnIds.length}
              emptyText="暂无任务记录"
            />
            {!loading && sortedTasks.map((task) => (
              <tr key={task.id} className="bg-[var(--bg)] hover:bg-[var(--bg2)]" data-testid={`admin-crawler-task-${task.id}`}>
                {visibleColumnIds.includes('runId') && (
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {getRunId(task) ? (
                      <button
                        type="button"
                        className="rounded bg-[var(--bg3)] px-2 py-1 text-left hover:text-[var(--text)]"
                        onClick={() => {
                          const runId = getRunId(task)
                          if (runId) {
                            setRunIdFilterInput(runId)
                            setRunIdFilter(runId)
                            setPage(1)
                            onRunIdChange?.(runId)
                          }
                        }}
                        data-testid={`admin-crawler-runid-pill-${task.id}`}
                      >
                        {getRunId(task)!.slice(0, 8)}
                      </button>
                    ) : '—'}
                  </td>
                )}
                {visibleColumnIds.includes('type') && (
                  <td className="px-4 py-3 text-[var(--text)]">{task.type}</td>
                )}
                {visibleColumnIds.includes('site') && (
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-[var(--muted)]">{getSiteKey(task)}</td>
                )}
                {visibleColumnIds.includes('triggerType') && (
                  <td className="px-4 py-3"><TriggerBadge triggerType={task.triggerType} /></td>
                )}
                {visibleColumnIds.includes('status') && (
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                )}
                {visibleColumnIds.includes('startedAt') && (
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {parseTime(task.startedAt ?? task.started_at ?? task.scheduledAt)}
                  </td>
                )}
                {visibleColumnIds.includes('finishedAt') && (
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {parseTime(task.finishedAt ?? task.finished_at)}
                  </td>
                )}
                {visibleColumnIds.includes('error') && (
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-red-400">
                    {getErrorMessage(task)}
                  </td>
                )}
                {visibleColumnIds.includes('actions') && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => { void handleViewLogs(task.id) }}
                      className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg2)]"
                      data-testid={`admin-crawler-task-logs-${task.id}`}
                    >
                      查看日志
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </AdminTableFrame>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
            <span>共 {total} 条</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40">上一页</button>
              <span className="px-2 py-1">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40">下一页</button>
            </div>
          </div>
        )}
      </section>

      {logTaskId && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4" data-testid="admin-crawler-task-logs-panel">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text)]">任务日志：{logTaskId}</h3>
            <button
              type="button"
              onClick={() => {
                setLogTaskId(null)
                setTaskLogs([])
              }}
              className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              关闭
            </button>
          </div>
          {logLoading ? (
            <p className="text-sm text-[var(--muted)]">日志加载中…</p>
          ) : taskLogs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">暂无日志</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded border border-[var(--border)] bg-[var(--bg)]">
              <ul className="divide-y divide-[var(--subtle)]">
                {taskLogs.map((log) => (
                  <li key={log.id} className="px-3 py-2 text-xs">
                    <div className="mb-1 flex items-center gap-2 text-[var(--muted)]">
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                      <span>{log.level.toUpperCase()}</span>
                      <span>{log.stage}</span>
                    </div>
                    <div className={log.level === 'error' ? 'text-red-400' : 'text-[var(--text)]'}>
                      {log.message}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
