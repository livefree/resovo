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
import { ErrorState, LoadingState, useToast } from '@resovo/admin-ui'
import { getModerationStats, type ModerationStats } from '@/lib/videos/api'
import { buildDashboardStats, type DashboardStats } from '@/lib/dashboard-data'
import { getDashboardOverview, getDashboardActivities, type DashboardOverviewPayload, type DashboardActivityRow } from '@/lib/dashboard/api'
import { runCrawlerAll } from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'
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
  fontSize: 'var(--font-size-xl)',
  fontWeight: 700,
  color: 'var(--fg-default)',
  lineHeight: 1.3,
}

const HEAD_SUB_STYLE: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: 'var(--font-size-xs)',
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
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-xs)',
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
    fontSize: 'var(--font-size-sm)',
    cursor: 'pointer',
    marginBottom: '-1px',
  }
}

// ── component ─────────────────────────────────────────────────────

export function DashboardClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const activeTab: TabId = (searchParams.get('tab') as TabId) === 'analytics' ? 'analytics' : 'overview'

  const [stats, setStats] = useState<ModerationStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<Error | undefined>()
  const [overview, setOverview] = useState<DashboardOverviewPayload | null>(null)
  // ADR-141 / CHG-SN-8-FUP-DASH-ACTIVITY-LIVE：activities 真端点拉数据；失败 fallback null → buildDashboardStats 走 mock
  const [activities, setActivities] = useState<readonly DashboardActivityRow[] | null>(null)
  const [fullCrawlRunning, setFullCrawlRunning] = useState(false)

  const loadStats = useCallback(() => {
    setStatsLoading(true)
    setStatsError(undefined)
    Promise.all([
      getModerationStats(),
      getDashboardOverview().catch(() => null),
      getDashboardActivities(10).catch(() => null),
    ])
      .then(([s, ov, act]) => {
        setStats(s)
        setOverview(ov)
        setActivities(act)
      })
      .catch((e: unknown) => setStatsError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  // 派生 DashboardStats：overview 优先（全 live），overview 失败则 fallback 到 moderationStats（部分 live）；
  // activities 优先用真端点 rows（buildDashboardStats 内 mapActivityRow），失败时 fallback mock
  const dashboardStats: DashboardStats = useMemo(
    () => buildDashboardStats(stats, overview, activities),
    [stats, overview, activities],
  )

  // GAPS #G-dashboard-runall：跟齐 CHG-SN-8-01 范式 — 主按钮改增量 + 全量加双重 confirm（输入"全量"防误触）
  const handleIncrementalCrawl = useCallback(async () => {
    if (!window.confirm('确认启动全站增量采集？')) return
    setFullCrawlRunning(true)
    try {
      const result = await runCrawlerAll('incremental')
      toast.push({ title: `全站增量已启动（runId=${result.runId.slice(0, 8)}）`, level: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : '启动采集失败，请重试'
      toast.push({ title: '启动失败', description: msg, level: 'danger' })
    } finally {
      setFullCrawlRunning(false)
    }
  }, [toast])

  const handleFullCrawl = useCallback(async () => {
    if (!window.confirm('确定对全站发起【全量】采集？此操作会创建多个 task，且耗时较长。')) return
    const second = window.prompt('再次确认：请输入"全量"二字以继续；输入其它内容将中止。')
    if (second?.trim() !== '全量') return
    setFullCrawlRunning(true)
    try {
      const result = await runCrawlerAll('full')
      toast.push({ title: `全站全量已启动（runId=${result.runId.slice(0, 8)}）`, level: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : '启动采集失败，请重试'
      toast.push({ title: '启动失败', description: msg, level: 'danger' })
    } finally {
      setFullCrawlRunning(false)
    }
  }, [toast])

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
              {/* GAPS #G-dashboard-runall：增量为主按钮（高频）+ 全量降级 ghost 双重 confirm（低频危险）*/}
              <button type="button" style={HEAD_BTN_STYLE} data-page-action="full-crawl" disabled={fullCrawlRunning} onClick={() => void handleFullCrawl()} title="低频危险：批量重抓所有源（需双重确认）">{fullCrawlRunning ? '采集中…' : '全站全量'}</button>
              <button type="button" style={HEAD_BTN_PRIMARY_STYLE} data-page-action="incremental-crawl" disabled={fullCrawlRunning} onClick={() => void handleIncrementalCrawl()}>全站增量</button>
              <button type="button" style={HEAD_BTN_PRIMARY_STYLE} data-page-action="enter-moderation" onClick={() => router.push('/admin/moderation')}>进入审核台</button>
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
                <RecentActivityCard items={dashboardStats.activities} dataSource={dashboardStats.activitiesDataSource} />
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
