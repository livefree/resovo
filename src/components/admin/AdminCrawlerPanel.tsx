/**
 * AdminCrawlerPanel.tsx — 爬虫管理面板
 * CHG-36: 源站卡片 + 单站触发 + 自动采集开关 + 任务记录展示
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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

interface SiteStatus {
  key: string
  name: string
  apiUrl: string
  disabled: boolean
  weight: number
  lastCrawledAt: string | null
  lastCrawlStatus: 'ok' | 'failed' | 'running' | null
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

function CrawlStatusDot({ status }: { status: SiteStatus['lastCrawlStatus'] }) {
  if (!status) return <span className="inline-block h-2 w-2 rounded-full bg-[var(--muted)]" title="从未采集" />
  const map: Record<NonNullable<SiteStatus['lastCrawlStatus']>, string> = {
    ok:      'bg-green-500',
    failed:  'bg-red-500',
    running: 'bg-blue-400 animate-pulse',
  }
  const labels: Record<NonNullable<SiteStatus['lastCrawlStatus']>, string> = {
    ok:      '上次采集成功',
    failed:  '上次采集失败',
    running: '采集中',
  }
  return <span className={`inline-block h-2 w-2 rounded-full ${map[status]}`} title={labels[status]} />
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

  const [sites, setSites] = useState<SiteStatus[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)
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

  // 加载源站状态
  const fetchSites = useCallback(async () => {
    setSitesLoading(true)
    try {
      const res = await apiClient.get<{ data: SiteStatus[] }>('/admin/crawler/sites-status')
      setSites(res.data)
    } catch {
      // 非阻塞
    } finally {
      setSitesLoading(false)
    }
  }, [])

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
  useEffect(() => { fetchSites() }, [fetchSites])
  useEffect(() => { fetchAutoCrawl() }, [fetchAutoCrawl])

  // 触发采集（全局或单站）
  async function handleTrigger(type: 'full-crawl' | 'incremental-crawl', siteKey?: string) {
    const key = siteKey ?? 'all'
    setTriggering(key)
    try {
      await apiClient.post('/admin/crawler/tasks', { type, siteKey })
      await Promise.all([fetchTasks(), fetchSites()])
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
          onClick={() => { fetchTasks(); fetchSites() }}
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

      {/* ── 源站状态卡片 ────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">
          源站状态（{sites.filter((s) => !s.disabled).length} 个启用，{sites.length} 个共计）
        </h2>
        {sitesLoading ? (
          <p className="text-sm text-[var(--muted)]">加载中…</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            暂无源站。请前往
            <Link href="/admin/crawler#site-manager" className="ml-1 text-[var(--accent)] underline">视频源配置</Link>
            添加采集源站。
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <div
                key={site.key}
                className={`rounded-lg border p-3 text-sm ${
                  site.disabled
                    ? 'border-[var(--subtle)] opacity-50'
                    : 'border-[var(--border)] bg-[var(--bg)]'
                }`}
                data-testid={`admin-crawler-site-${site.key}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <CrawlStatusDot status={site.lastCrawlStatus} />
                  <span className="truncate font-medium text-[var(--text)]" title={site.name}>
                    {site.name}
                  </span>
                  {site.disabled && (
                    <span className="ml-auto shrink-0 rounded bg-[var(--subtle)] px-1.5 py-0.5 text-xs text-[var(--muted)]">
                      已禁用
                    </span>
                  )}
                </div>
                <p className="mb-2 truncate text-xs text-[var(--muted)]">{site.apiUrl}</p>
                {site.lastCrawledAt && (
                  <p className="mb-2 text-xs text-[var(--muted)]">
                    上次：{new Date(site.lastCrawledAt).toLocaleString()}
                  </p>
                )}
                {!site.disabled && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleTrigger('incremental-crawl', site.key)}
                      disabled={triggering !== null}
                      className="rounded bg-[var(--bg2)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-50"
                    >
                      {triggering === site.key ? '触发中…' : '增量'}
                    </button>
                    <button
                      onClick={() => handleTrigger('full-crawl', site.key)}
                      disabled={triggering !== null}
                      className="rounded bg-[var(--bg2)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-50"
                    >
                      {triggering === site.key ? '触发中…' : '全量'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

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
