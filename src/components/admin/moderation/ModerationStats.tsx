/**
 * ModerationStats.tsx — 审核台顶部统计板（CHG-221）
 * 显示：待审数量 / 今日已审 / 拦截率
 */

'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface ModerationStats {
  pendingCount: number
  todayReviewedCount: number
  interceptRate: number | null
}

interface StatCardProps {
  label: string
  value: string
  sublabel?: string
  testId: string
}

function StatCard({ label, value, sublabel, testId }: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-5 py-4"
      data-testid={testId}
    >
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-semibold text-[var(--text)]">{value}</p>
      {sublabel && <p className="text-xs text-[var(--muted)]">{sublabel}</p>}
    </div>
  )
}

export function ModerationStats() {
  const [stats, setStats] = useState<ModerationStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiClient.get<ModerationStats>('/admin/videos/moderation-stats')
        setStats(res)
      } catch (_err) {
        // fetch failed: stats remain null, component shows dashes
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4" data-testid="moderation-stats-loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-[var(--bg3)]" />
        ))}
      </div>
    )
  }

  const pendingValue = stats ? String(stats.pendingCount) : '—'
  const reviewedValue = stats ? String(stats.todayReviewedCount) : '—'
  const interceptValue =
    stats?.interceptRate != null ? `${(stats.interceptRate * 100).toFixed(1)}%` : '—'

  return (
    <div className="grid grid-cols-3 gap-4" data-testid="moderation-stats">
      <StatCard
        label="待审核视频"
        value={pendingValue}
        sublabel="待人工处理"
        testId="moderation-stat-pending"
      />
      <StatCard
        label="今日已审核"
        value={reviewedValue}
        sublabel="今日操作数"
        testId="moderation-stat-today"
      />
      <StatCard
        label="拦截率"
        value={interceptValue}
        sublabel="拒绝 / 全部已审"
        testId="moderation-stat-intercept"
      />
    </div>
  )
}
