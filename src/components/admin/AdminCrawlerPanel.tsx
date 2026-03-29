/**
 * AdminCrawlerPanel.tsx — 爬虫管理面板
 * CHG-36: 全局触发 + 任务记录展示
 * CHG-318: AdminTableFrame → ModernDataTable; 手写分页 → PaginationV2; 服务端排序
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import {
  useCrawlerTaskTableColumns,
  type CrawlerTaskRow,
} from '@/components/admin/system/crawler-task/useCrawlerTaskTableColumns'

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
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)
  const [sort, setSort] = useState<TableSortState | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logTaskId, setLogTaskId] = useState<string | null>(null)
  const [logLoading, setLogLoading] = useState(false)
  const [taskLogs, setTaskLogs] = useState<CrawlerTaskLogItem[]>([])

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

  const tableColumns = useCrawlerTaskTableColumns({
    onRunIdClick: handleRunIdClick,
    onViewLogs: handleViewLogs,
  })

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

        {/* 列设置面板（CHG-309 将替换为 settingsSlot）*/}
        {showColumnsPanel && (
          <div className="mb-3 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">列显示</span>
              <button
                type="button"
                className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
                onClick={() => setShowColumnsPanel(false)}
              >
                关闭
              </button>
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
