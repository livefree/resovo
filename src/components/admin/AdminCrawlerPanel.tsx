/**
 * AdminCrawlerPanel.tsx — 爬虫管理面板
 * CHG-36: 全局触发 + 任务记录展示
 * CHG-318: AdminTableFrame → ModernDataTable; 手写分页 → PaginationV2; 服务端排序
 * CHG-309: 内联列设置 panel → useTableSettings + settingsSlot
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import {
  useCrawlerTaskTableColumns,
  CRAWLER_TASK_COLUMN_LABELS,
  type CrawlerTaskRow,
} from '@/components/admin/system/crawler-task/useCrawlerTaskTableColumns'

// ── 列设置描述（useTableSettings 控制显/隐）────────────────────────

const CRAWLER_SETTINGS_COLUMNS = [
  { id: 'runId',       label: CRAWLER_TASK_COLUMN_LABELS.runId,       defaultVisible: true,  defaultSortable: true  },
  { id: 'type',        label: CRAWLER_TASK_COLUMN_LABELS.type,        defaultVisible: true,  defaultSortable: true  },
  { id: 'site',        label: CRAWLER_TASK_COLUMN_LABELS.site,        defaultVisible: true,  defaultSortable: true  },
  { id: 'triggerType', label: CRAWLER_TASK_COLUMN_LABELS.triggerType, defaultVisible: true,  defaultSortable: true  },
  { id: 'status',      label: CRAWLER_TASK_COLUMN_LABELS.status,      defaultVisible: true,  defaultSortable: true  },
  { id: 'startedAt',   label: CRAWLER_TASK_COLUMN_LABELS.startedAt,   defaultVisible: true,  defaultSortable: true  },
  { id: 'finishedAt',  label: CRAWLER_TASK_COLUMN_LABELS.finishedAt,  defaultVisible: true,  defaultSortable: true  },
  { id: 'error',       label: CRAWLER_TASK_COLUMN_LABELS.error,       defaultVisible: true,  defaultSortable: true  },
  { id: 'actions',     label: CRAWLER_TASK_COLUMN_LABELS.actions,     defaultVisible: true,  defaultSortable: false, required: true },
]

// ── 类型 ─────────────────────────────────────────────────────────

type TaskStatusFilter = 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled' | 'timeout' | ''
type TaskTriggerFilter = 'single' | 'batch' | 'all' | 'schedule' | ''

interface CrawlerTaskLogItem {
  id: string
  level: 'info' | 'warn' | 'error'
  stage: string
  message: string
  createdAt: string
}

interface TaskSiteBreakdown {
  siteKey: string
  videosUpserted: number
  sourcesUpserted: number
  sourcesKept: number
  sourcesRemoved: number
  errors: number
}

interface TaskRunContext {
  crawlMode: 'batch' | 'keyword' | 'source-refetch'
  keyword: string | null
  targetVideoId: string | null
}

interface TaskDetailData {
  siteBreakdown: TaskSiteBreakdown
  runContext: TaskRunContext | null
}

// ── 주요 컴포넌트 ───────────────────────────────────────────────────

interface AdminCrawlerPanelProps {
  initialRunId?: string
  initialStatusFilter?: TaskStatusFilter
  onRunIdChange?: (runId: string) => void
}

export function AdminCrawlerPanel({ initialRunId = '', initialStatusFilter = '', onRunIdChange }: AdminCrawlerPanelProps) {
  const [tasks, setTasks] = useState<CrawlerTaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('')
  const [triggerFilter, setTriggerFilter] = useState<TaskTriggerFilter>('')
  const [runIdFilterInput, setRunIdFilterInput] = useState('')
  const [runIdFilter, setRunIdFilter] = useState('')
  const [sort, setSort] = useState<TableSortState | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logTaskId, setLogTaskId] = useState<string | null>(null)
  const [logLoading, setLogLoading] = useState(false)
  const [taskLogs, setTaskLogs] = useState<CrawlerTaskLogItem[]>([])
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [taskDetail, setTaskDetail] = useState<TaskDetailData | null>(null)

  // 加载任务列表
  const fetchTasks = useCallback(async (pageVal: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(pageVal), limit: String(pageSize) })
      if (statusFilter) params.set('status', statusFilter)
      if (triggerFilter) params.set('triggerType', triggerFilter)
      if (runIdFilter) params.set('runId', runIdFilter)
      if (sort) {
        params.set('sortField', sort.field)
        params.set('sortDir', sort.direction)
      }
      const res = await apiClient.get<{ data: CrawlerTaskRow[]; pagination: { total: number } }>(
        `/admin/crawler/tasks?${params}`
      )
      setTasks(res.data)
      setTotal(res.pagination.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [pageSize, statusFilter, triggerFilter, runIdFilter, sort])

  useEffect(() => { void fetchTasks(page) }, [fetchTasks, page])

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

  function handleRunIdClick(runId: string) {
    setRunIdFilterInput(runId)
    setRunIdFilter(runId)
    setPage(1)
    onRunIdChange?.(runId)
  }

  async function handleViewDetail(taskId: string) {
    if (detailTaskId === taskId) {
      setDetailTaskId(null)
      setTaskDetail(null)
      return
    }
    setDetailTaskId(taskId)
    setDetailLoading(true)
    try {
      const res = await apiClient.get<{ data: TaskDetailData }>(
        `/admin/crawler/tasks/${taskId}`
      )
      setTaskDetail(res.data)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '详情加载失败')
      setTaskDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleViewLogs(taskId: string) {
    setLogTaskId(taskId)
    setLogLoading(true)
    try {
      const res = await apiClient.get<{ data: { logs: CrawlerTaskLogItem[] } }>(
        `/admin/crawler/tasks/${taskId}/logs?limit=50`
      )
      setTaskLogs(res.data.logs ?? [])
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '日志加载失败')
      setTaskLogs([])
    } finally {
      setLogLoading(false)
    }
  }

  const tableSettings = useTableSettings({
    tableId: 'crawler-tasks',
    columns: CRAWLER_SETTINGS_COLUMNS,
  })

  const allTableColumns = useCrawlerTaskTableColumns({
    onRunIdClick: handleRunIdClick,
    onViewLogs: handleViewLogs,
    onViewDetail: handleViewDetail,
  })

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

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
              onClick={() => { void fetchTasks(page) }}
              className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
              data-testid="admin-crawler-refresh"
            >
              刷新
            </button>
          </div>
        </div>

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

        <ModernDataTable
          columns={tableColumns}
          rows={tasks}
          sort={sort}
          onSortChange={(nextSort) => {
            setSort(nextSort)
            setPage(1)
          }}
          loading={loading}
          emptyText="暂无任务记录"
          scrollTestId="crawler-tasks-table-scroll"
          getRowId={(row) => row.id}
          settingsSlot={{
            settingsColumns: tableSettings.orderedSettings,
            onSettingsChange: tableSettings.updateSetting,
            onSettingsReset: tableSettings.reset,
          }}
        />

        {total > 0 && (
          <div className="mt-4">
            <PaginationV2
              page={page}
              total={total}
              pageSize={pageSize}
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          </div>
        )}
      </section>

      {detailTaskId && (
        <section
          className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4"
          data-testid="admin-crawler-task-detail-panel"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text)]">
              任务详情：{detailTaskId.slice(0, 8)}
            </h3>
            <button
              type="button"
              onClick={() => { setDetailTaskId(null); setTaskDetail(null) }}
              className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              关闭
            </button>
          </div>
          {detailLoading ? (
            <p className="text-sm text-[var(--muted)]">加载中…</p>
          ) : taskDetail ? (
            <div className="space-y-4">
              {/* Run 上下文：关键词 / 补源目标 */}
              {taskDetail.runContext?.crawlMode === 'keyword' && taskDetail.runContext.keyword && (
                <div className="rounded-md bg-[var(--bg3)] px-3 py-2 text-xs">
                  <span className="text-[var(--muted)]">搜索关键词：</span>
                  <span className="font-medium text-[var(--text)]">{taskDetail.runContext.keyword}</span>
                </div>
              )}
              {taskDetail.runContext?.crawlMode === 'source-refetch' && taskDetail.runContext.targetVideoId && (
                <div className="rounded-md bg-[var(--bg3)] px-3 py-2 text-xs">
                  <span className="text-[var(--muted)]">目标视频 ID：</span>
                  <span className="font-medium text-[var(--text)]">{taskDetail.runContext.targetVideoId}</span>
                </div>
              )}

              {/* 站点统计表 */}
              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">站点维度统计</p>
                <table className="w-full text-xs" data-testid="task-site-breakdown-table">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                      <th className="py-1 pr-4 font-normal">站点</th>
                      <th className="py-1 pr-4 font-normal">视频数</th>
                      <th className="py-1 pr-4 font-normal">新增源</th>
                      <th className="py-1 pr-4 font-normal">保留源</th>
                      <th className="py-1 pr-4 font-normal">移除源</th>
                      <th className="py-1 font-normal">错误</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr data-testid="task-site-breakdown-row">
                      <td className="py-1 pr-4 text-[var(--text)]">{taskDetail.siteBreakdown.siteKey}</td>
                      <td className="py-1 pr-4 text-[var(--text)]">{taskDetail.siteBreakdown.videosUpserted}</td>
                      <td className="py-1 pr-4 text-green-400">{taskDetail.siteBreakdown.sourcesUpserted}</td>
                      <td className="py-1 pr-4 text-[var(--muted)]">{taskDetail.siteBreakdown.sourcesKept}</td>
                      <td className="py-1 pr-4 text-[var(--muted)]">{taskDetail.siteBreakdown.sourcesRemoved}</td>
                      <td className={`py-1 ${taskDetail.siteBreakdown.errors > 0 ? 'text-red-400' : 'text-[var(--muted)]'}`}>
                        {taskDetail.siteBreakdown.errors}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">暂无详情数据</p>
          )}
        </section>
      )}

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
