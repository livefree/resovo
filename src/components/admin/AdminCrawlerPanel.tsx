/**
 * AdminCrawlerPanel.tsx — 爬虫管理面板
 * CHG-36: 全局触发 + 自动采集开关 + 任务记录展示
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

// ── 类型 ─────────────────────────────────────────────────────────

interface CrawlerTask {
  id: string
  type: string
  status: 'pending' | 'running' | 'done' | 'failed'
  source_url: string | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

type TaskStatusFilter = 'pending' | 'running' | 'done' | 'failed' | ''

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

// ── 主组件 ───────────────────────────────────────────────────────

export function AdminCrawlerPanel() {
  const [tasks, setTasks] = useState<CrawlerTask[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('')
  const [triggering, setTriggering] = useState<string | null>(null) // null = idle, 'all' = global, siteKey = single
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [autoCrawlEnabled, setAutoCrawlEnabled] = useState<boolean | null>(null)
  const [autoCrawlSaving, setAutoCrawlSaving] = useState(false)

  const limit = 20

  // 加载任务列表
  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (statusFilter) params.set('status', statusFilter)
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
  }, [page, statusFilter])

  // 加载自动采集开关
  const fetchAutoCrawl = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Record<string, unknown> }>('/admin/system/settings')
      setAutoCrawlEnabled(res.data.autoCrawlEnabled === true || res.data.autoCrawlEnabled === 'true')
    } catch {
      // 非阻塞
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => { fetchAutoCrawl() }, [fetchAutoCrawl])

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

  // 切换自动采集开关
  async function handleAutoCrawlToggle() {
    if (autoCrawlEnabled === null) return
    const next = !autoCrawlEnabled
    setAutoCrawlSaving(true)
    try {
      await apiClient.post('/admin/system/settings', { auto_crawl_enabled: String(next) })
      setAutoCrawlEnabled(next)
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败')
    } finally {
      setAutoCrawlSaving(false)
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

        {/* 自动采集开关 */}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
          <span>每日自动采集</span>
          <button
            onClick={handleAutoCrawlToggle}
            disabled={autoCrawlSaving || autoCrawlEnabled === null}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
              autoCrawlEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
            } disabled:opacity-60`}
            data-testid="admin-crawler-auto-toggle"
            role="switch"
            aria-checked={autoCrawlEnabled ?? false}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                autoCrawlEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>

      {/* ── 状态筛选 ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">采集任务记录</h2>
        <div className="mb-4 flex gap-1 rounded-md border border-[var(--border)] p-0.5 w-fit">
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

        {error && (
          <p className="mb-4 rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
        )}

        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg2)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left">类型</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">开始时间</th>
                <th className="px-4 py-3 text-left">结束时间</th>
                <th className="px-4 py-3 text-left">错误信息</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--subtle)]">
              {loading && (
                <tr><td colSpan={5} className="py-8 text-center text-[var(--muted)]">加载中…</td></tr>
              )}
              {!loading && tasks.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-[var(--muted)]">暂无任务记录</td></tr>
              )}
              {!loading && tasks.map((task) => (
                <tr key={task.id} className="bg-[var(--bg)] hover:bg-[var(--bg2)]" data-testid={`admin-crawler-task-${task.id}`}>
                  <td className="px-4 py-3 text-[var(--text)]">{task.type}</td>
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
    </div>
  )
}
