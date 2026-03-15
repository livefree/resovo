/**
 * AdminAnalyticsDashboard.tsx — 数据看板组件
 * ADMIN-05: 显示运营统计数据
 */

'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import type { AnalyticsData } from '@/api/routes/admin/analytics'

// ── StatCard ──────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  accent,
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
      <p className="mb-1 text-xs text-[var(--muted)] uppercase tracking-wider">{title}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function AdminAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<{ data: AnalyticsData }>('/admin/analytics')
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-[var(--muted)]">加载中…</p>
  }

  if (error || !data) {
    return <p className="text-red-400">{error ?? '加载失败'}</p>
  }

  const failRatePct = (data.sources.failRate * 100).toFixed(1)

  return (
    <div data-testid="analytics-dashboard" className="space-y-8">
      {/* ── 视频统计 ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          视频
        </h2>
        <div className="grid grid-cols-3 gap-4" data-testid="analytics-videos">
          <StatCard title="视频总数" value={data.videos.total} />
          <StatCard title="已上架" value={data.videos.published} accent />
          <StatCard title="待审/下架" value={data.videos.pending} />
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

      {/* ── 用户统计 ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          用户
        </h2>
        <div className="grid grid-cols-3 gap-4" data-testid="analytics-users">
          <StatCard title="注册用户总数" value={data.users.total} />
          <StatCard title="今日新增" value={data.users.todayNew} accent />
          <StatCard title="已封禁" value={data.users.banned} />
        </div>
      </section>

      {/* ── 待处理队列 ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          待处理事项
        </h2>
        <div className="grid grid-cols-2 gap-4" data-testid="analytics-queues">
          <StatCard
            title="待审投稿"
            value={data.queues.submissions}
            sub={data.queues.submissions > 0 ? '需要处理' : '全部处理完毕'}
            accent={data.queues.submissions > 0}
          />
          <StatCard
            title="待审字幕"
            value={data.queues.subtitles}
            sub={data.queues.subtitles > 0 ? '需要处理' : '全部处理完毕'}
            accent={data.queues.subtitles > 0}
          />
        </div>
      </section>

      {/* ── 爬虫状态快照 ────────────────────────────────────────── */}
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
              {data.crawlerTasks.recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[var(--muted)]">
                    暂无爬虫任务记录
                  </td>
                </tr>
              )}
              {data.crawlerTasks.recent.map((task) => (
                <tr key={task.id} className="bg-[var(--bg)] hover:bg-[var(--bg2)]">
                  <td className="px-4 py-3 text-[var(--text)]">{task.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        task.status === 'done'
                          ? 'bg-green-900/30 text-green-400'
                          : task.status === 'failed'
                            ? 'bg-red-900/30 text-red-400'
                            : task.status === 'running'
                              ? 'bg-blue-900/30 text-blue-400'
                              : 'bg-yellow-900/30 text-yellow-400'
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
                    {new Date(task.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
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
