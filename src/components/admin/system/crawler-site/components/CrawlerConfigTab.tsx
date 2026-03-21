'use client'

import { CrawlerSiteOverviewStats } from '@/components/admin/system/crawler-site/components/CrawlerSiteOverviewStats'
import { CrawlerRunPanel } from '@/components/admin/system/crawler-site/components/CrawlerRunPanel'
import { CrawlerSiteManager } from '@/components/admin/system/crawler-site/CrawlerSiteManager'
import { useCrawlerMonitor } from '@/components/admin/system/crawler-site/hooks/useCrawlerMonitor'

function noop() {
  // 采集配置页仅展示监控，不在此面板执行批次控制。
}

export function CrawlerConfigTab() {
  const { overview, runningRuns } = useCrawlerMonitor({ showToast: noop })

  return (
    <div className="space-y-4" data-testid="crawler-config-tab">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">实时采集监控</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          统计数据与运行进度局部刷新，不影响下方源站表格的筛选、排序、列宽和滚动位置。
        </p>
      </section>
      <CrawlerSiteOverviewStats data={overview} />
      <CrawlerRunPanel
        title="当前运行批次"
        emptyText="当前没有运行中的采集任务"
        runs={runningRuns}
        onCancel={noop}
        onPause={noop}
        onResume={noop}
        enableControls={false}
      />
      <CrawlerSiteManager />
    </div>
  )
}

