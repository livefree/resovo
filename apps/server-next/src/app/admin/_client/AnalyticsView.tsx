'use client'

/**
 * AnalyticsView.tsx — Dashboard Analytics tab 内容（CHG-DESIGN-09 / CHG-SN-7-MISC-DASHBOARD-2）
 *
 * 真源：docs/designs/backend_design_v2.1/app/screens-3.jsx:499-569 AnalyticsView
 *   - page__head：标题 + sub + period select + 导出报表 btn
 *   - 4 KPI：视频总数 / 已上架 / 待审·暂存 / 源可达率（KpiCard + Spark）
 *   - 2fr/1fr：采集任务量折线面积图（SVG）+ 源类型分布（进度条列表）
 *   - 爬虫最近任务 card + table（§6.9 7 列）
 *
 * 数据策略（MISC-DASHBOARD-2）：
 *   - KPI / collectTimeline / sourceTypeDistribution / recentTasks 来自 /admin/dashboard/analytics
 *   - 加载中/失败 → LoadingState / ErrorState（不渲染假数据）
 *   - KPI sparkData 仍用静态 mock（历史序列 ADR-127a 阶段再接真端点）
 * 图表：SVG inline，无外部图表库
 */

import React, { useState, useEffect, useCallback, useId } from 'react'
import { KpiCard, Spark, Pill, LoadingState, ErrorState, PageHeader } from '@resovo/admin-ui'
import { getDashboardAnalytics } from '@/lib/dashboard/api'
import type { DashboardAnalyticsPayload, DashboardCrawlerRunBrief, DashboardKpiSnapshot, DashboardSourceTypeStat, DashboardTimelinePoint } from '@resovo/types'

// ── static spark mock（ADR-127a 后替换为真端点）────────────────────

const SPARK_MAP: Record<DashboardKpiSnapshot['key'], { data: readonly number[]; color: string }> = {
  videoTotal:          { data: [620, 638, 651, 662, 670, 680, 695], color: 'var(--accent-default)' },
  pendingStaging:      { data: [430, 450, 462, 470, 478, 480, 484], color: 'var(--state-warning-fg)' },
  sourceReachableRate: { data: [98.4, 98.5, 98.6, 98.5, 98.7, 98.6, 98.7], color: 'var(--state-success-fg)' },
  inactiveSources:     { data: [2050, 2030, 2010, 1990, 1980, 1967, 1939], color: 'var(--state-error-fg)' },
}

// ── styles ────────────────────────────────────────────────────────

// page head：共享 PageHeader 承载（MODUX-P1-1-B，规约 T-9：analytics tab 激活时
// 与 overview 问候 h1 互斥渲染，本标题为 /admin 路由该态下唯一 h1）

const SELECT_STYLE: React.CSSProperties = {
  height: '28px',
  padding: '0 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
  cursor: 'pointer',
}

const BTN_STYLE: React.CSSProperties = {
  height: '28px',
  padding: '0 12px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
  cursor: 'pointer',
}

const KPI_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '12px',
}

const CHARTS_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr',
  gap: '12px',
}

const CARD: React.CSSProperties = {
  background: 'var(--bg-surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const CARD_HEAD: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-subtle)',
}

const CARD_TITLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-sm-tight)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const CARD_BODY: React.CSSProperties = {
  padding: '14px',
  flex: 1,
}

// ── KPI label 映射（后端不返回 label，本地定义）─────────────────────

const KPI_LABELS: Record<DashboardKpiSnapshot['key'], string> = {
  videoTotal:          '视频总数',
  pendingStaging:      '待审 / 暂存',
  sourceReachableRate: '源可达率',
  inactiveSources:     '失效源',
}

// ── 时间格式化（ISO → 本地相对显示）─────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.round(hours / 24)} 天前`
}

// ── 源类型颜色映射 ────────────────────────────────────────────────

const SOURCE_COLOR_MAP: Record<string, string> = {
  'm3u8':   'var(--state-success-fg)',
  'mp4':    'var(--state-info-fg)',
  'embed':  'var(--state-warning-fg)',
  'iframe': 'var(--state-warning-fg)',
}

function sourceColor(type: string): string {
  return SOURCE_COLOR_MAP[type.toLowerCase()] ?? 'var(--fg-disabled)'
}

// ── sub-renderers ─────────────────────────────────────────────────

function AreaChart({
  gradientId,
  periodLabel,
  points,
}: {
  readonly gradientId: string
  readonly periodLabel: string
  readonly points: readonly DashboardTimelinePoint[]
}) {
  const w = 700
  const h = 200

  const values = points.map((p) => p.count)
  const maxVal = Math.max(...values, 1)

  const pts = values
    .map((v, i) => `${i * (w / Math.max(values.length - 1, 1))},${h - (v / maxVal) * (h - 20)}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', height: 200, display: 'block' }}
      aria-label={`采集任务量折线面积图（${periodLabel}）`}
      data-analytics-chart="timeline"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-default)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent-default)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1="0" x2={w} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />
      ))}
      {values.length > 1 && (
        <>
          <polyline
            points={`0,${h} ${pts} ${w},${h}`}
            fill={`url(#${gradientId})`}
          />
          <polyline
            points={pts}
            fill="none"
            stroke="var(--accent-default)"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  )
}

function SourceDistribution({ items }: { readonly items: readonly DashboardSourceTypeStat[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} data-analytics-section="source-types">
      {items.map(({ type, pct }) => (
        <div key={type}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '3px' }}>
            <span style={{ color: 'var(--fg-default)' }}>{type}</span>
            <span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{pct.toFixed(1)}%</span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: sourceColor(type), borderRadius: 'inherit' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function CrawlerTaskTable({ tasks }: { readonly tasks: readonly DashboardCrawlerRunBrief[] }) {
  const TH: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: 'var(--font-size-xxs)',
    fontWeight: 500,
    color: 'var(--fg-muted)',
    textAlign: 'left',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-surface-elevated)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  }
  const TD: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 'var(--font-size-xs)',
    borderBottom: '1px solid var(--border-subtle)',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ overflowX: 'auto' }} data-analytics-section="crawler-tasks">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH}>资源站</th>
            <th style={TH}>状态</th>
            <th style={TH}>开始</th>
            <th style={TH}>结束</th>
            <th style={{ ...TH, textAlign: 'right' }}>新增视频</th>
            <th style={{ ...TH, textAlign: 'right' }}>新增源</th>
            <th style={{ ...TH, textAlign: 'right' }}>耗时</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td style={TD}><strong style={{ fontWeight: 600 }}>{task.site}</strong></td>
              <td style={TD}><Pill variant={task.status}>{task.statusLabel}</Pill></td>
              <td style={{ ...TD, color: 'var(--fg-muted)', fontSize: 'var(--font-size-xxs)' }}>{fmtTime(task.startedAt)}</td>
              <td style={{ ...TD, color: 'var(--fg-muted)', fontSize: 'var(--font-size-xxs)' }}>{fmtTime(task.finishedAt)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>
                {task.videosUpserted > 0
                  ? <strong style={{ color: 'var(--state-success-fg)', fontWeight: 600 }}>+{task.videosUpserted}</strong>
                  : <span style={{ color: 'var(--fg-disabled)' }}>—</span>}
              </td>
              <td style={{ ...TD, textAlign: 'right' }}>
                {task.sourcesUpserted > 0
                  ? <strong style={{ color: 'var(--accent-default)', fontWeight: 600 }}>+{task.sourcesUpserted}</strong>
                  : <span style={{ color: 'var(--fg-disabled)' }}>—</span>}
              </td>
              <td style={{ ...TD, textAlign: 'right', color: 'var(--fg-muted)' }}>
                {task.durationSeconds !== null && task.durationSeconds > 0 ? `${task.durationSeconds}s` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d'

const PERIOD_LABEL: Record<Period, string> = {
  '7d': '7 天',
  '30d': '30 天',
  '90d': '90 天',
}

export function AnalyticsView() {
  const [period, setPeriod] = useState<Period>('7d')
  const [analyticsData, setAnalyticsData] = useState<DashboardAnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const gradientId = useId().replace(/:/g, '-')
  const periodLabel = PERIOD_LABEL[period]

  const loadData = useCallback((p: Period) => {
    setLoading(true)
    setError(undefined)
    getDashboardAnalytics(p)
      .then(setAnalyticsData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData(period) }, [loadData, period])

  const handlePeriodChange = (p: Period) => {
    setPeriod(p)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-analytics-view>
      <PageHeader
        title="数据看板"
        actions={
          <>
            <select
              style={SELECT_STYLE}
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value as Period)}
              aria-label="时间范围"
              data-analytics-period-select
            >
              <option value="7d">7 天</option>
              <option value="30d">30 天</option>
              <option value="90d">90 天</option>
            </select>
            <button type="button" style={BTN_STYLE} disabled title="功能开发中（follow-up STATS-EXTEND-ANALYTICS）">
              导出报表
            </button>
          </>
        }
      />

      {loading && <LoadingState variant="skeleton" />}
      {!loading && error && (
        <ErrorState error={error} title="加载分析数据失败" onRetry={() => loadData(period)} data-analytics-error />
      )}

      {!loading && !error && analyticsData && (
        <>
          <div style={KPI_GRID} data-analytics-kpi-grid>
            {analyticsData.kpis.map((kpi) => {
              const spark = SPARK_MAP[kpi.key]
              return (
                <KpiCard
                  key={kpi.key}
                  label={KPI_LABELS[kpi.key] ?? kpi.key}
                  value={kpi.value}
                  variant={kpi.variant}
                  dataSource="live"
                  delta={{ text: kpi.deltaText, direction: kpi.deltaDirection }}
                  spark={
                    <Spark
                      data={spark?.data ?? []}
                      color={spark?.color ?? 'var(--accent-default)'}
                      variant="line"
                      width={60}
                      height={18}
                    />
                  }
                />
              )
            })}
          </div>

          <div style={CHARTS_GRID}>
            <div style={CARD} data-analytics-card="chart">
              <header style={CARD_HEAD}>
                <h2 style={CARD_TITLE}>采集任务量 · {periodLabel}</h2>
              </header>
              <div style={CARD_BODY}>
                <AreaChart
                  gradientId={gradientId}
                  periodLabel={periodLabel}
                  points={analyticsData.collectTimeline}
                />
              </div>
            </div>

            <div style={CARD} data-analytics-card="source-types">
              <header style={CARD_HEAD}>
                <h2 style={CARD_TITLE}>源类型分布</h2>
              </header>
              <div style={CARD_BODY}>
                <SourceDistribution items={analyticsData.sourceTypeDistribution} />
              </div>
            </div>
          </div>

          <div style={CARD} data-analytics-card="crawler-tasks">
            <header style={CARD_HEAD}>
              <h2 style={CARD_TITLE}>爬虫最近任务</h2>
              <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>实时</span>
            </header>
            <CrawlerTaskTable tasks={analyticsData.recentTasks} />
          </div>
        </>
      )}
    </div>
  )
}
