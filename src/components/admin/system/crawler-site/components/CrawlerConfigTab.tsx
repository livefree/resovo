'use client'

import { CrawlerSiteOverviewStats } from '@/components/admin/system/crawler-site/components/CrawlerSiteOverviewStats'
import { CrawlerSiteManager } from '@/components/admin/system/crawler-site/CrawlerSiteManager'
import { useCrawlerMonitor } from '@/components/admin/system/crawler-site/hooks/useCrawlerMonitor'
import type { CrawlerRunSummary } from '@/components/admin/system/crawler-site/hooks/useCrawlerMonitor'
import { AdminHoverHint } from '@/components/admin/shared/feedback/AdminHoverHint'

function noop() {
  // 采集配置页仅展示监控，不在此面板执行批次控制。
}

function labelForTrigger(t: CrawlerRunSummary['triggerType']) {
  if (t === 'single') return '单站'
  if (t === 'batch') return '批量'
  if (t === 'all') return '全站'
  return '定时'
}

function labelForStatus(s: CrawlerRunSummary['status']) {
  if (s === 'queued') return '排队中'
  if (s === 'running') return '运行中'
  if (s === 'paused') return '已暂停'
  if (s === 'success') return '成功'
  if (s === 'partial_failed') return '部分失败'
  if (s === 'cancelled') return '已取消'
  return '失败'
}

function runDurationSec(run: CrawlerRunSummary): number {
  const base = run.startedAt ?? run.createdAt
  const start = new Date(base).getTime()
  if (!Number.isFinite(start)) return 0
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now()
  return Math.max(0, Math.round((end - start) / 1000))
}

function statusColor(s: CrawlerRunSummary['status']) {
  if (s === 'running' || s === 'queued') return 'text-blue-400'
  if (s === 'success') return 'text-green-400'
  if (s === 'partial_failed' || s === 'paused') return 'text-amber-400'
  if (s === 'failed' || s === 'cancelled') return 'text-red-400'
  return 'text-[var(--muted)]'
}

export function CrawlerConfigTab() {
  const { overview, runs } = useCrawlerMonitor({ showToast: noop })
  const latestRun = runs[0] ?? null

  const total          = typeof latestRun?.summary?.total          === 'number' ? latestRun.summary.total          : 0
  const done           = typeof latestRun?.summary?.done           === 'number' ? latestRun.summary.done           : 0
  const failed         = typeof latestRun?.summary?.failed         === 'number' ? latestRun.summary.failed         : 0
  const videosUpserted = typeof latestRun?.summary?.videosUpserted === 'number' ? latestRun.summary.videosUpserted : 0
  const durationSec    = latestRun ? runDurationSec(latestRun) : 0

  return (
    <div className="space-y-4" data-testid="crawler-config-tab">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">实时采集监控</h3>
          <AdminHoverHint text="统计数据与运行进度局部刷新，不影响下方源站表格的筛选、排序、列宽和滚动位置。" />
        </div>
      </section>
      <CrawlerSiteOverviewStats data={overview} />

      {/* 最近一次采集摘要 */}
      {latestRun ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-1.5 text-xs">
          <span className="font-medium text-[var(--text)]">
            {labelForTrigger(latestRun.triggerType)} · {latestRun.mode === 'full' ? '全量' : '增量'}
          </span>
          <span className="text-[var(--muted)]">站点 <span className="text-[var(--text)]">{total}</span></span>
          <span className="text-[var(--muted)]">成功 <span className="text-green-400">{done}</span></span>
          <span className="text-[var(--muted)]">失败 <span className={failed > 0 ? 'text-red-400' : 'text-[var(--text)]'}>{failed}</span></span>
          <span className="text-[var(--muted)]">视频 <span className="text-[var(--text)]">{videosUpserted}</span></span>
          <span className="text-[var(--muted)]">时长 <span className="text-[var(--text)]">{durationSec}s</span></span>
          <span className={`ml-auto font-medium ${statusColor(latestRun.status)}`}>{labelForStatus(latestRun.status)}</span>
        </div>
      ) : (
        <p className="rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-1.5 text-xs text-[var(--muted)]">暂无采集记录</p>
      )}

      <CrawlerSiteManager />
    </div>
  )
}
