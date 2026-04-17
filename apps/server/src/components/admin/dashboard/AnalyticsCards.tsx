/**
 * AnalyticsCards.tsx — 数据看板卡片（Client Component，30 秒自动刷新）
 * CHG-25: 展示 6 张核心统计卡片，每 30 秒轮询刷新
 * CHG-338: 改为首屏客户端拉数（移除 x-internal-secret SSR prefetch），initialData 改为可选
 */

'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { QueueAlerts } from '@/components/admin/dashboard/QueueAlerts'
import type { AnalyticsData } from '@/types/contracts/v1/admin'
import type { BadgeStatus } from '@/components/admin/StatusBadge'

const REFRESH_INTERVAL_MS = 30_000

// ── 任务状态到 BadgeStatus 映射 ─────────────────────────────────

const TASK_STATUS_MAP: Record<string, BadgeStatus> = {
  running: 'active',
  done: 'published',
  failed: 'banned',
  pending: 'pending',
  queued: 'pending',
}

// ── StatCard ──────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  accent = false,
}: {
  title: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-5"
      data-testid="analytics-stat-card"
    >
      <p className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">{title}</p>
      <p
        className={`text-3xl font-bold ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}
        data-testid="analytics-stat-value"
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

// ── 骨架屏 ────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-8" data-testid="analytics-skeleton">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-[var(--bg3)]" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-[var(--bg3)]" />
        ))}
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

interface AnalyticsCardsProps {
  initialData?: AnalyticsData | null
}

export function AnalyticsCards({ initialData }: AnalyticsCardsProps) {
  const [data, setData] = useState<AnalyticsData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    let cancelled = false

    // 若无初始数据，首屏立即拉数
    if (!initialData) {
      apiClient
        .getAnalytics()
        .then((res) => {
          if (!cancelled) {
            setData(res.data)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false)
        })
    }

    // 每 30 秒轮询刷新
    const intervalId = setInterval(() => {
      apiClient
        .getAnalytics()
        .then((res) => {
          if (!cancelled) setData(res.data)
        })
        .catch(() => {
          // 静默失败：保留上次数据，不打断页面
        })
    }, REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [initialData])

  if (loading) {
    return <AnalyticsSkeleton />
  }

  if (!data) {
    return (
      <p className="text-sm text-red-400" data-testid="analytics-error">
        数据加载失败，请刷新页面重试
      </p>
    )
  }

  const failRatePct = (data.sources.failRate * 100).toFixed(1)
  const pendingTotal = data.queues.submissions + data.queues.subtitles
  const recentTasks = data.crawlerTasks.recent.slice(0, 5)

  return (
    <div data-testid="analytics-cards" className="space-y-8">
      <QueueAlerts queues={data.queues} />

      {/* ── 核心统计卡片（6 张） ─────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-3 gap-4" data-testid="analytics-summary-cards">
          <StatCard title="视频总数" value={data.videos.total} />
          <StatCard title="已发布" value={data.videos.published} accent />
          <StatCard title="待审核" value={data.videos.pending} />
          <StatCard title="注册用户" value={data.users.total} />
          <StatCard title="今日新增" value={data.users.todayNew} accent />
          <StatCard
            title="待处理事项"
            value={pendingTotal}
            sub={pendingTotal > 0 ? `投稿 ${data.queues.submissions} · 字幕 ${data.queues.subtitles}` : '全部处理完毕'}
            accent={pendingTotal > 0}
          />
        </div>
      </section>

      {/* ── 播放源统计 ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          播放源
        </h2>
        <div className="grid grid-cols-3 gap-4" data-testid="analytics-sources">
          <StatCard title="播放源总数" value={data.sources.total} />
          <StatCard title="有效" value={data.sources.active} accent />
          <StatCard
            title="失效率"
            value={`${failRatePct}%`}
            sub={`失效 ${data.sources.inactive} 条`}
          />
        </div>
      </section>

      {/* ── 爬虫最近任务（最近 5 条）──────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          爬虫最近任务
        </h2>
        <div
          className="overflow-x-auto rounded-lg border border-[var(--border)]"
          data-testid="analytics-crawler-tasks"
        >
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg2)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left">资源站</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">开始时间</th>
                <th className="px-4 py-3 text-left">结束时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--subtle)]">
              {recentTasks.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[var(--muted)]">
                    暂无爬虫任务记录
                  </td>
                </tr>
              )}
              {recentTasks.map((task) => (
                <tr key={task.id} className="bg-[var(--bg)] hover:bg-[var(--bg2)]">
                  <td className="px-4 py-3 text-[var(--text)]">{task.type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={TASK_STATUS_MAP[task.status] ?? 'inactive'}
                      data-testid={`task-status-${task.id}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {new Date(task.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {task.finished_at ? new Date(task.finished_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
