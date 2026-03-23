'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AdminCrawlerPanel } from '@/components/admin/AdminCrawlerPanel'
import { CrawlerConfigTab } from '@/components/admin/system/crawler-site/components/CrawlerConfigTab'
import { CrawlerAdvancedTab } from '@/components/admin/system/crawler-site/components/CrawlerAdvancedTab'

type CrawlerTab = 'sites' | 'tasks' | 'settings' | 'logs'
type TaskStatusFilter = 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled' | 'timeout' | ''

function parseTaskStatusFilter(input: string | null): TaskStatusFilter {
  if (
    input === 'pending' ||
    input === 'running' ||
    input === 'paused' ||
    input === 'done' ||
    input === 'failed' ||
    input === 'cancelled' ||
    input === 'timeout'
  ) {
    return input
  }
  return ''
}

function parseCrawlerTab(input: string | null): CrawlerTab {
  if (input === 'tasks') return 'tasks'
  if (input === 'settings' || input === 'advanced') return 'settings'
  if (input === 'logs') return 'logs'
  // 兼容旧 query：tab=config / tab=sites → 默认 sites
  return 'sites'
}

const PAGE_TITLE_TOOLTIP =
  '统一管理采集源站配置、控制台任务审计、日志与设置。按工作流切换「站点」「控制台」「日志」「设置」。'

export function AdminCrawlerTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryTab = searchParams.get('tab')
  const queryRunId = searchParams.get('runId')
  const queryTaskStatus = searchParams.get('taskStatus')
  const initialTab: CrawlerTab = parseCrawlerTab(queryTab)
  const [tab, setTab] = useState<CrawlerTab>(initialTab)

  const taskRunId = useMemo(() => {
    if (!queryRunId) return ''
    return queryRunId.trim()
  }, [queryRunId])

  const taskStatusFilter = useMemo(
    () => parseTaskStatusFilter(queryTaskStatus),
    [queryTaskStatus],
  )

  useEffect(() => {
    setTab(parseCrawlerTab(queryTab))
  }, [queryTab])

  function switchTab(nextTab: CrawlerTab) {
    setTab(nextTab)
    const next = new URLSearchParams(searchParams.toString())
    if (nextTab === 'tasks') {
      next.set('tab', 'tasks')
    } else if (nextTab === 'settings') {
      next.set('tab', 'settings')
      next.delete('runId')
      next.delete('taskStatus')
    } else if (nextTab === 'logs') {
      next.set('tab', 'logs')
      next.delete('runId')
      next.delete('taskStatus')
    } else {
      // 'sites' — 默认 tab，清空所有 query
      next.delete('tab')
      next.delete('runId')
      next.delete('taskStatus')
    }
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  function syncRunId(runId: string) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', 'tasks')
    if (runId) {
      next.set('runId', runId)
    } else {
      next.delete('runId')
    }
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <section className="space-y-4" data-testid="admin-crawler-tabs">
      <div className="flex items-center justify-between gap-4">
        <div className="group relative">
          <h1
            className="cursor-help text-2xl font-bold"
            data-testid="admin-crawler-page-title"
          >
            采集控制台
          </h1>
          <div
            className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-[min(720px,90vw)] rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-xs leading-5 text-[var(--muted)] opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100"
            role="tooltip"
            data-testid="admin-crawler-page-title-tooltip"
          >
            {PAGE_TITLE_TOOLTIP}
          </div>
        </div>
        <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-1 w-fit">
          <button
            type="button"
            onClick={() => switchTab('sites')}
            data-testid="admin-crawler-tab-sites"
            title="采集源站管理与单站触发"
            className={`rounded px-4 py-2 text-sm transition-colors ${
              tab === 'sites'
                ? 'bg-[var(--accent)] text-black'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            站点
          </button>
          <button
            type="button"
            onClick={() => switchTab('tasks')}
            data-testid="admin-crawler-tab-tasks"
            title="采集批次与任务审计"
            className={`rounded px-4 py-2 text-sm transition-colors ${
              tab === 'tasks'
                ? 'bg-[var(--accent)] text-black'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            控制台
          </button>
          <button
            type="button"
            onClick={() => switchTab('logs')}
            data-testid="admin-crawler-tab-logs"
            title="采集任务日志"
            className={`rounded px-4 py-2 text-sm transition-colors ${
              tab === 'logs'
                ? 'bg-[var(--accent)] text-black'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            日志
          </button>
          <button
            type="button"
            onClick={() => switchTab('settings')}
            data-testid="admin-crawler-tab-settings"
            title="自动采集策略与爬虫 API 配置"
            className={`rounded px-4 py-2 text-sm transition-colors ${
              tab === 'settings'
                ? 'bg-[var(--accent)] text-black'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            设置
          </button>
        </div>
      </div>

      <div>
        {tab === 'sites' && (
          <div data-testid="admin-crawler-tab-panel-sites">
            <CrawlerConfigTab />
          </div>
        )}
        {tab === 'tasks' && (
          <div data-testid="admin-crawler-tab-panel-tasks">
            <AdminCrawlerPanel initialRunId={taskRunId} initialStatusFilter={taskStatusFilter} onRunIdChange={syncRunId} />
          </div>
        )}
        {tab === 'logs' && (
          <div data-testid="admin-crawler-tab-panel-logs">
            <p className="py-10 text-center text-sm text-[var(--muted)]">日志面板（即将上线）</p>
          </div>
        )}
        {tab === 'settings' && (
          <div data-testid="admin-crawler-tab-panel-settings">
            <CrawlerAdvancedTab />
          </div>
        )}
      </div>
    </section>
  )
}
