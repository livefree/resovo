'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AdminCrawlerPanel } from '@/components/admin/AdminCrawlerPanel'
import { CrawlerSiteManager } from '@/components/admin/system/crawler-site/CrawlerSiteManager'

type CrawlerTab = 'sites' | 'tasks'

export function AdminCrawlerTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryTab = searchParams.get('tab')
  const queryRunId = searchParams.get('runId')
  const initialTab: CrawlerTab = queryTab === 'tasks' ? 'tasks' : 'sites'
  const [tab, setTab] = useState<CrawlerTab>(initialTab)

  const taskRunId = useMemo(() => {
    if (!queryRunId) return ''
    return queryRunId.trim()
  }, [queryRunId])

  useEffect(() => {
    setTab(queryTab === 'tasks' ? 'tasks' : 'sites')
  }, [queryTab])

  function switchTab(nextTab: CrawlerTab) {
    setTab(nextTab)
    const next = new URLSearchParams(searchParams.toString())
    if (nextTab === 'tasks') {
      next.set('tab', 'tasks')
    } else {
      next.delete('tab')
      next.delete('runId')
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
      <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-1 w-fit">
        <button
          type="button"
          onClick={() => switchTab('sites')}
          data-testid="admin-crawler-tab-sites"
          className={`rounded px-4 py-2 text-sm transition-colors ${
            tab === 'sites'
              ? 'bg-[var(--accent)] text-black'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          采集控制台
        </button>
        <button
          type="button"
          onClick={() => switchTab('tasks')}
          data-testid="admin-crawler-tab-tasks"
          className={`rounded px-4 py-2 text-sm transition-colors ${
            tab === 'tasks'
              ? 'bg-[var(--accent)] text-black'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          采集任务记录
        </button>
      </div>

      <div>
        {tab === 'sites' && (
          <div data-testid="admin-crawler-tab-panel-sites">
            <p className="mb-4 text-sm text-[var(--muted)]">
              管理爬虫使用的外部苹果CMS源站，统一执行单站/批量/全站采集，并维护自动采集配置。配置文件来源的源站需在「配置文件」页面中修改。
            </p>
            <CrawlerSiteManager />
          </div>
        )}
        {tab === 'tasks' && (
          <div data-testid="admin-crawler-tab-panel-tasks">
            <p className="mb-4 text-sm text-[var(--muted)]">
              查看采集任务执行记录、日志与失败原因。自动采集配置已迁移至「采集控制台」Tab。
            </p>
            <div className="mb-4 rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--muted)]">
              自动采集配置唯一入口为「采集控制台」。
              <button
                type="button"
                onClick={() => switchTab('sites')}
                className="ml-2 text-[var(--accent)] hover:underline"
                data-testid="admin-crawler-go-control-center"
              >
                前往配置
              </button>
            </div>
            <AdminCrawlerPanel initialRunId={taskRunId} onRunIdChange={syncRunId} />
          </div>
        )}
      </div>
    </section>
  )
}
