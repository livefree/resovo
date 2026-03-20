/**
 * AdminCrawlerPanel.tsx — 爬虫管理面板
 * CHG-36: 全局触发 + 任务记录展示
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

// ── 类型 ─────────────────────────────────────────────────────────

interface CrawlerTask {
  id: string
  type: string
  status: 'pending' | 'running' | 'done' | 'failed'
  triggerType: 'single' | 'batch' | 'all' | 'schedule' | null
  source_url: string | null
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

type TaskStatusFilter = 'pending' | 'running' | 'done' | 'failed' | ''
type TaskTriggerFilter = 'single' | 'batch' | 'all' | 'schedule' | ''

// ── 小组件 ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CrawlerTask['status'] }) {
  const map: Record<CrawlerTask['status'], string> = {
    pending: 'bg-yellow-900/30 text-yellow-400',
    running: 'bg-blue-900/30 text-blue-400',
    done:    'bg-green-900/30 text-green-400',
    failed:  'bg-red-900/30 text-red-400',
  }
  const labels: Record<CrawlerTask['status'], string> = {
    pending: '等待中',
    running: '运行中',
    done:    '已完成',
    failed:  '失败',
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

export function AdminCrawlerPanel() {
  const [tasks, setTasks] = useState<CrawlerTask[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('')
  const [triggerFilter, setTriggerFilter] = useState<TaskTriggerFilter>('')
  const [triggering, setTriggering] = useState<string | null>(null) // null = idle, 'all' = global, siteKey = single
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logTaskId, setLogTaskId] = useState<string | null>(null)
  const [logLoading, setLogLoading] = useState(false)
  const [taskLogs, setTaskLogs] = useState<CrawlerTaskLogItem[]>([])

  const limit = 20

  // 加载任务列表
  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (statusFilter) params.set('status', statusFilter)
      if (triggerFilter) params.set('triggerType', triggerFilter)
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
  }, [page, statusFilter, triggerFilter])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // 触发采集（全局）
  async function handleTrigger(type: 'full-crawl' | 'incremental-crawl') {
    setTriggering('all')
    try {
      await apiClient.post('/admin/crawler/tasks', { type })
      await fetchTasks()
    } catch (err) {
      alert(err instanceof Error ? err.message : '触发失败')
    } finally {
      setTriggering(null)
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
      alert(err instanceof Error ? err.message : '日志加载失败')
      setTaskLogs([])
    } finally {
      setLogLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)
  const globalTriggering = triggering === 'all'

  return (
    <div data-testid="admin-crawler-panel" className="space-y-6">

      {/* ── 全局操作区 ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => handleTrigger('full-crawl')}
          disabled={triggering !== null}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
          data-testid="admin-crawler-trigger-full"
        >
          {globalTriggering ? '触发中…' : '全量采集（全部源站）'}
        </button>
        <button
          onClick={() => handleTrigger('incremental-crawl')}
          disabled={triggering !== null}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg2)] disabled:opacity-60"
          data-testid="admin-crawler-trigger-incremental"
        >
          {globalTriggering ? '触发中…' : '增量采集（近 24h）'}
        </button>
        <button
          onClick={() => { fetchTasks() }}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          data-testid="admin-crawler-refresh"
        >
          刷新
        </button>
      </div>

      {/* ── 状态筛选 ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">采集任务记录</h2>
        <div className="mb-3 flex gap-1 rounded-md border border-[var(--border)] p-0.5 w-fit">
          {([
            { value: '', label: '全部' },
            { value: 'pending', label: '等待中' },
            { value: 'running', label: '运行中' },
            { value: 'done', label: '已完成' },
            { value: 'failed', label: '失败' },
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

        {error && (
          <p className="mb-4 rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
        )}

        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg2)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left">类型</th>
                <th className="px-4 py-3 text-left">触发来源</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">开始时间</th>
                <th className="px-4 py-3 text-left">结束时间</th>
                <th className="px-4 py-3 text-left">错误信息</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--subtle)]">
              {loading && (
                <tr><td colSpan={7} className="py-8 text-center text-[var(--muted)]">加载中…</td></tr>
              )}
              {!loading && tasks.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-[var(--muted)]">暂无任务记录</td></tr>
              )}
              {!loading && tasks.map((task) => (
                <tr key={task.id} className="bg-[var(--bg)] hover:bg-[var(--bg2)]" data-testid={`admin-crawler-task-${task.id}`}>
                  <td className="px-4 py-3 text-[var(--text)]">{task.type}</td>
                  <td className="px-4 py-3"><TriggerBadge triggerType={task.triggerType} /></td>
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
                    {task.started_at ? new Date(task.started_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
                    {task.finished_at ? new Date(task.finished_at).toLocaleString() : '—'}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-red-400">
                    {task.error ?? '—'}
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
