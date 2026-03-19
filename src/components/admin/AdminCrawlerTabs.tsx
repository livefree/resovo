'use client'

import { useState } from 'react'
import { AdminCrawlerPanel } from '@/components/admin/AdminCrawlerPanel'
import { CrawlerSiteManager } from '@/components/admin/system/CrawlerSiteManager'

type CrawlerTab = 'sites' | 'tasks'

export function AdminCrawlerTabs() {
  const [tab, setTab] = useState<CrawlerTab>('sites')

  return (
    <section className="space-y-4" data-testid="admin-crawler-tabs">
      <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('sites')}
          data-testid="admin-crawler-tab-sites"
          className={`rounded px-4 py-2 text-sm transition-colors ${
            tab === 'sites'
              ? 'bg-[var(--accent)] text-black'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          视频源配置
        </button>
        <button
          type="button"
          onClick={() => setTab('tasks')}
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
              管理爬虫使用的外部苹果CMS源站，并在列表内执行单站采集。配置文件来源的源站需在「配置文件」页面中修改。
            </p>
            <CrawlerSiteManager />
          </div>
        )}
        {tab === 'tasks' && (
          <div data-testid="admin-crawler-tab-panel-tasks">
            <p className="mb-4 text-sm text-[var(--muted)]">
              查看采集任务执行记录，并执行全站全量/增量采集。
            </p>
            <AdminCrawlerPanel />
          </div>
        )}
      </div>
    </section>
  )
}
