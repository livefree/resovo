'use client'

import { useCrawlerMonitor } from '@/components/admin/system/crawler-site/hooks/useCrawlerMonitor'
import type { CrawlerSite } from '@/types'
import { CrawlerSiteOverviewStats } from '@/components/admin/system/crawler-site/components/CrawlerSiteOverviewStats'
import { CrawlerSystemStatusStrip } from '@/components/admin/system/crawler-site/components/CrawlerSystemStatusStrip'
import { AutoCrawlSettingsPanel } from '@/components/admin/system/crawler-site/components/AutoCrawlSettingsPanel'
import { CrawlerRunPanel } from '@/components/admin/system/crawler-site/components/CrawlerRunPanel'
import { AdminHoverHint } from '@/components/admin/shared/feedback/AdminHoverHint'

interface AutoCrawlConfigSnapshot {
  globalEnabled: boolean
  defaultMode: 'incremental' | 'full'
  perSiteOverrides: Record<string, { enabled: boolean; mode: 'inherit' | 'incremental' | 'full' }>
}

interface CrawlerConsoleMonitorSectionProps {
  sites: CrawlerSite[]
  onAutoConfigChange: (next: AutoCrawlConfigSnapshot | null) => void
}

export function CrawlerConsoleMonitorSection({
  sites,
  onAutoConfigChange,
}: CrawlerConsoleMonitorSectionProps) {
  const {
    overview,
    systemStatus,
    runningRuns,
    recentRuns,
    pauseRun,
    resumeRun,
    cancelRun,
    stopAll,
    setFreezeEnabled,
    stopAllPending,
    freezeSwitchPending,
  } = useCrawlerMonitor()

  return (
    <>
      <CrawlerSiteOverviewStats data={overview} />
      <CrawlerSystemStatusStrip
        data={systemStatus}
        stopAllPending={stopAllPending}
        freezeSwitchPending={freezeSwitchPending}
        onStopAll={() => { void stopAll() }}
        onSetFreezeEnabled={(enabled) => { void setFreezeEnabled(enabled) }}
      />
      <AutoCrawlSettingsPanel sites={sites} onConfigChange={onAutoConfigChange} />
      <section className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2" data-testid="crawler-run-monitor-header">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">采集批次状态</h3>
          <AdminHoverHint text="任务运行中的监控与控制区域（暂停 / 恢复 / 中止）。" />
        </div>
      </section>
      <CrawlerRunPanel
        title="当前任务（运行/排队/暂停）"
        emptyText="当前没有运行中的采集任务"
        runs={runningRuns}
        onCancel={(runId) => { void cancelRun(runId) }}
        onPause={(runId) => { void pauseRun(runId) }}
        onResume={(runId) => { void resumeRun(runId) }}
      />
      <CrawlerRunPanel
        title="最近结果"
        emptyText="暂无最近完成任务"
        runs={recentRuns.slice(0, 8)}
        onCancel={(runId) => { void cancelRun(runId) }}
        onPause={(runId) => { void pauseRun(runId) }}
        onResume={(runId) => { void resumeRun(runId) }}
      />
    </>
  )
}
