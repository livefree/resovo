'use client'

import { useEffect, useRef } from 'react'
import { CrawlerSiteManager } from '@/components/admin/system/crawler-site/CrawlerSiteManager'
import { useCrawlerMonitor } from '@/components/admin/system/crawler-site/hooks/useCrawlerMonitor'
import type { CrawlerRunSummary } from '@/components/admin/system/crawler-site/hooks/useCrawlerMonitor'
import { AdminHoverHint } from '@/components/admin/shared/feedback/AdminHoverHint'
import { useAdminToast } from '@/components/admin/shared/feedback/useAdminToast'

function noop() {}

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
  const { runs } = useCrawlerMonitor({ showToast: noop })
  const { toast, showToast } = useAdminToast({ durationMs: 4000 })
  const latestRun = runs[0] ?? null

  const total          = typeof latestRun?.summary?.total          === 'number' ? latestRun.summary.total          : 0
  const done           = typeof latestRun?.summary?.done           === 'number' ? latestRun.summary.done           : 0
  const failed         = typeof latestRun?.summary?.failed         === 'number' ? latestRun.summary.failed         : 0
  const videosUpserted = typeof latestRun?.summary?.videosUpserted === 'number' ? latestRun.summary.videosUpserted : 0
  const durationSec    = latestRun ? runDurationSec(latestRun) : 0

  // 采集完成通知
  const prevRunRef = useRef<{ id: string; status: string } | null>(null)
  useEffect(() => {
    if (!latestRun) return
    const prev = prevRunRef.current
    const isTerminal = latestRun.status === 'success' || latestRun.status === 'partial_failed' || latestRun.status === 'failed' || latestRun.status === 'cancelled'
    if (prev && prev.id === latestRun.id && isTerminal && prev.status !== latestRun.status) {
      const wasActive = prev.status === 'running' || prev.status === 'queued' || prev.status === 'paused'
      if (wasActive) {
        const ok = latestRun.status === 'success' || latestRun.status === 'partial_failed'
        const label =
          latestRun.status === 'success'         ? '采集完成' :
          latestRun.status === 'partial_failed'  ? '采集部分失败' :
          latestRun.status === 'cancelled'       ? '采集已取消' : '采集失败'
        showToast(label, ok)
      }
    }
    prevRunRef.current = { id: latestRun.id, status: latestRun.status }
  }, [latestRun, showToast])

  return (
    <div className="space-y-4" data-testid="crawler-config-tab">
      {/* 实时采集监控 + 最近一次摘要：同一个框 */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text)]">实时采集监控</h3>
            <AdminHoverHint text="统计数据与运行进度局部刷新，不影响下方源站表格的筛选、排序、列宽和滚动位置。" />
          </div>
          {toast && (
            <span className={`text-xs font-medium ${toast.ok ? 'text-green-400' : 'text-red-400'}`}>
              {toast.msg}
            </span>
          )}
        </div>
        <div className="mt-2">
          {latestRun ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
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
            <p className="text-xs text-[var(--muted)]">暂无采集记录</p>
          )}
        </div>
      </section>

      <CrawlerSiteManager />
    </div>
  )
}
