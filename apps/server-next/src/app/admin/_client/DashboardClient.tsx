'use client'

/**
 * DashboardClient.tsx — Dashboard 8 卡片浏览态（CHG-DESIGN-07 7C 步骤 4）
 *
 * 真源：reference.md §5.1 Dashboard 4 行布局蓝图
 *   - row1: grid 1.4fr 1fr gap 12 → AttentionCard + WorkflowCard
 *   - row2: grid repeat(4, 1fr) gap 12 → 4 张 MetricKpiCard
 *   - row3: grid 1fr 1fr gap 12 → RecentActivityCard + SiteHealthCard
 *   - 顶部 page__head（问候式 title + 最后采集 sub + 全站全量采集 / 进入审核台）
 *
 * 数据流：
 *   - getModerationStats() 拉真端点（live） → buildDashboardStats() 派生 5 类卡片数据
 *   - moderationStats null（loading / error）→ DashboardStats 全 mock + dataSource='mock'
 *   - 接口字段缺失 → fallback mock + 标 data-source="mock"（reference §5.1.4 教训直接落地）
 *
 * 反 CHG-SN-3-08 假绿模式：
 *   - 不渲染 StatCard 占位（已删除）
 *   - 不渲染 `'—'` 破折号（DashboardStats 始终是非破折号 string/number）
 *   - 7C 自动化 regression gate 守门
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ErrorState, LoadingState } from '@resovo/admin-ui'
import { getModerationStats, type ModerationStats } from '@/lib/videos/api'
import { buildDashboardStats, type DashboardStats } from '@/lib/dashboard-data'
import { AttentionCard } from '@/components/admin/dashboard/AttentionCard'
import { WorkflowCard } from '@/components/admin/dashboard/WorkflowCard'
import { MetricKpiCardRow } from '@/components/admin/dashboard/MetricKpiCardRow'
import { RecentActivityCard } from '@/components/admin/dashboard/RecentActivityCard'
import { SiteHealthCard } from '@/components/admin/dashboard/SiteHealthCard'
import { AnalyticsView } from './AnalyticsView'

// ── types ─────────────────────────────────────────────────────────

type TabId = 'overview' | 'analytics'

// ── styles ────────────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '20px 24px',
}

const TAB_BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: '2px',
  borderBottom: '1px solid var(--border-subtle)',
  paddingBottom: 0,
}

const HEAD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  paddingTop: '4px',
}

const HEAD_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: '20px',
  fontWeight: 700,
  color: 'var(--fg-default)',
  lineHeight: 1.3,
}

const HEAD_SUB_STYLE: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: '12px',
  color: 'var(--fg-muted)',
}

const HEAD_ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexShrink: 0,
}

const HEAD_BTN_STYLE: React.CSSProperties = {
  height: '28px',
  padding: '0 12px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  font: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
}

const HEAD_BTN_PRIMARY_STYLE: React.CSSProperties = {
  ...HEAD_BTN_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  border: '1px solid var(--accent-default)',
  fontWeight: 500,
}

const ROW1_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr 1fr',
  gap: '12px',
}

const ROW3_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
}


function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    border: 0,
    borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
    fontWeight: active ? 600 : 400,
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '-1px',
  }
}

// ── component ─────────────────────────────────────────────────────

export function DashboardClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab: TabId = (searchParams.get('tab') as TabId) === 'analytics' ? 'analytics' : 'overview'

  const [stats, setStats] = useState<ModerationStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<Error | undefined>()

  const loadStats = useCallback(() => {
    setStatsLoading(true)
    setStatsError(undefined)
    getModerationStats()
      .then(setStats)
      .catch((e: unknown) => setStatsError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  // 派生 DashboardStats（live + mock 混合）
  // stats null（加载中或失败）→ buildDashboardStats(null) 返全 mock
  // stats 有效 → 部分 live 派生（pendingCount → KPI 待审/暂存 + Workflow 待审段）
  const dashboardStats: DashboardStats = useMemo(() => buildDashboardStats(stats), [stats])

  const switchTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'overview') params.delete('tab')
    else params.set('tab', tab)
    router.push(`/admin${params.size > 0 ? `?${params}` : ''}`)
  }

  return (
    <div style={PAGE_STYLE} data-dashboard-client data-testid="dashboard-page">
      <div style={TAB_BAR_STYLE} data-dashboard-tabs>
        <button style={tabBtnStyle(activeTab === 'overview')} onClick={() => switchTab('overview')} data-tab="overview">概览</button>
        <button style={tabBtnStyle(activeTab === 'analytics')} onClick={() => switchTab('analytics')} data-tab="analytics">分析</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <header style={HEAD_STYLE} data-page-head>
            <div>
              <h1 style={HEAD_TITLE_STYLE}>早上好，Yan — 今天有 {dashboardStats.kpis[1].value} 待处理</h1>
              <p style={HEAD_SUB_STYLE} data-page-head-sub>{dashboardStats.headSub}</p>
            </div>
            <div style={HEAD_ACTIONS_STYLE} data-page-head-actions>
              <button type="button" style={HEAD_BTN_STYLE} data-page-action="full-crawl">全站全量采集</button>
              <button type="button" style={HEAD_BTN_PRIMARY_STYLE} data-page-action="enter-moderation">进入审核台</button>
            </div>
          </header>

          {/* loading / error 兜底；正常路径渲染 4 行布局（dashboardStats 始终非空） */}
          {statsLoading && stats === null && <LoadingState variant="skeleton" />}
          {statsError && stats === null && (
            <ErrorState error={statsError} title="加载统计失败" onRetry={loadStats} />
          )}

          {(!statsLoading || stats !== null) && !statsError && (
            <>
              <div style={ROW1_STYLE} data-dashboard-row="1">
                <AttentionCard items={dashboardStats.attentions} />
                <WorkflowCard segments={dashboardStats.workflow} />
              </div>

              <MetricKpiCardRow kpis={dashboardStats.kpis} />

              <div style={ROW3_STYLE} data-dashboard-row="3">
                <RecentActivityCard items={dashboardStats.activities} />
                <SiteHealthCard sites={dashboardStats.sites} />
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'analytics' && <AnalyticsView />}
    </div>
  )
}
