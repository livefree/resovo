'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AdminCrawlerPanel } from '@/components/admin/AdminCrawlerPanel'
import { CrawlerConfigTab } from '@/components/admin/system/crawler-site/components/CrawlerConfigTab'
import { CrawlerAdvancedTab } from '@/components/admin/system/crawler-site/components/CrawlerAdvancedTab'

type CrawlerTab = 'config' | 'tasks' | 'advanced'
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
  if (input === 'advanced') return 'advanced'
  // 兼容旧 query：tab=sites
  return 'config'
}

const PAGE_TITLE_TOOLTIP =
  '统一管理采集源站配置、任务审计与高级策略。当前页面采用三 Tab 结构，按工作流切换「采集配置」「任务记录」「高级设置」。'

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
    } else if (nextTab === 'advanced') {
      next.set('tab', 'advanced')
      next.delete('runId')
      next.delete('taskStatus')
    } else {
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
          onClick={() => switchTab('config')}
          data-testid="admin-crawler-tab-sites"
          data-tab-id="admin-crawler-tab-config"
          title="采集源站配置与实时进度面板"
          className={`rounded px-4 py-2 text-sm transition-colors ${
            tab === 'config'
              ? 'bg-[var(--accent)] text-black'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          采集配置
        </button>
        <button
          type="button"
          onClick={() => switchTab('tasks')}
          data-testid="admin-crawler-tab-tasks"
          title="历史采集任务与日志审计"
          className={`rounded px-4 py-2 text-sm transition-colors ${
            tab === 'tasks'
              ? 'bg-[var(--accent)] text-black'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          任务记录
        </button>
        <button
          type="button"
          onClick={() => switchTab('advanced')}
          data-testid="admin-crawler-tab-advanced"
          title="自动采集策略与自定义任务设置"
          className={`rounded px-4 py-2 text-sm transition-colors ${
            tab === 'advanced'
              ? 'bg-[var(--accent)] text-black'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          高级设置
        </button>
        </div>
      </div>

      <div>
        {tab === 'config' && (
          <div data-testid="admin-crawler-tab-panel-sites" data-tab-panel-id="admin-crawler-tab-panel-config">
            <CrawlerConfigTab />
          </div>
        )}
        {tab === 'tasks' && (
          <div data-testid="admin-crawler-tab-panel-tasks">
            <AdminCrawlerPanel initialRunId={taskRunId} initialStatusFilter={taskStatusFilter} onRunIdChange={syncRunId} />
          </div>
        )}
        {tab === 'advanced' && (
          <div data-testid="admin-crawler-tab-panel-advanced">
            <CrawlerAdvancedTab />
          </div>
        )}
      </div>
    </section>
  )
}
