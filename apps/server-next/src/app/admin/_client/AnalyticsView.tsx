'use client'

/**
 * AnalyticsView.tsx — Dashboard Analytics tab 内容（CHG-DESIGN-09）
 *
 * 真源：docs/designs/backend_design_v2.1/app/screens-3.jsx:499-569 AnalyticsView
 *   - page__head：标题 + sub + period select + 导出报表 btn
 *   - 4 KPI：视频总数 / 已上架 / 待审·暂存 / 源可达率（KpiCard + Spark）
 *   - 2fr/1fr：采集任务量折线面积图（SVG）+ 源类型分布（进度条列表）
 *   - 爬虫最近任务 card + table（§6.9 7 列）
 *
 * 数据策略：全 mock（deterministic）；follow-up `STATS-EXTEND-ANALYTICS` 接入真端点
 * 图表：SVG inline，无外部图表库
 */

import React, { useState, useId } from 'react'
import { KpiCard, Spark, Pill } from '@resovo/admin-ui'

// ── local types ────────────────────────────────────────────────────

interface AnalyticsKpi {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly deltaText: string
  readonly deltaDir: 'up' | 'down' | 'flat'
  readonly variant: 'default' | 'is-ok' | 'is-warn' | 'is-danger'
  readonly sparkData: readonly number[]
  readonly sparkColor: string
}

interface SourceType {
  readonly label: string
  readonly pct: number
  readonly color: string
}

interface CrawlerTask {
  readonly id: string
  readonly site: string
  readonly status: 'ok' | 'danger' | 'warn'
  readonly statusLabel: string
  readonly start: string
  readonly end: string
  readonly videos: number
  readonly sources: number
  readonly dur: number
}

// ── mock data (deterministic) ──────────────────────────────────────

const KPIS: readonly AnalyticsKpi[] = [
  {
    id: 'video-total',
    label: '视频总数',
    value: '695',
    deltaText: '↑ +47 7d',
    deltaDir: 'up',
    variant: 'default',
    sparkData: [620, 638, 651, 662, 670, 680, 695],
    sparkColor: 'var(--accent-default)',
  },
  {
    id: 'published',
    label: '已上架',
    value: '13',
    deltaText: '↑ +3 今日',
    deltaDir: 'up',
    variant: 'is-ok',
    sparkData: [8, 9, 10, 10, 11, 12, 13],
    sparkColor: 'var(--state-success-fg)',
  },
  {
    id: 'pending-staging',
    label: '待审 / 暂存',
    value: '484 / 23',
    deltaText: '较昨日 +18',
    deltaDir: 'flat',
    variant: 'is-warn',
    sparkData: [430, 450, 462, 470, 478, 480, 484],
    sparkColor: 'var(--state-warning-fg)',
  },
  {
    id: 'source-rate',
    label: '源可达率',
    value: '98.7%',
    deltaText: '↑ 0.3pt',
    deltaDir: 'up',
    variant: 'is-ok',
    sparkData: [98.4, 98.5, 98.6, 98.5, 98.7, 98.6, 98.7],
    sparkColor: 'var(--state-success-fg)',
  },
] as const

// 28 点 deterministic wave（对应设计稿 wave(120, 40, 28)）
const CHART_POINTS: readonly number[] = [
  120, 135, 148, 158, 155, 143, 130, 119, 113, 118,
  130, 145, 157, 161, 156, 145, 133, 122, 114, 110,
  115, 127, 142, 155, 161, 158, 148, 138,
] as const

const SOURCE_TYPES: readonly SourceType[] = [
  { label: 'm3u8 (HLS)', pct: 78, color: 'var(--state-success-fg)' },
  { label: 'mp4',        pct: 12, color: 'var(--state-info-fg)' },
  { label: 'embed iframe', pct: 7, color: 'var(--state-warning-fg)' },
  { label: '其他',        pct: 3,  color: 'var(--fg-disabled)' },
] as const

const CRAWLER_TASKS: readonly CrawlerTask[] = [
  { id: 'ct-1', site: 'iyf.tv',     status: 'ok',     statusLabel: '成功',   start: '2 分钟前',  end: '1 分钟前',  videos: 55, sources: 138, dur: 53 },
  { id: 'ct-2', site: 'agedm.org',  status: 'ok',     statusLabel: '成功',   start: '9 分钟前',  end: '8 分钟前',  videos: 51, sources: 129, dur: 61 },
  { id: 'ct-3', site: 'mxdm5.com',  status: 'ok',     statusLabel: '成功',   start: '16 分钟前', end: '15 分钟前', videos: 46, sources: 117, dur: 69 },
  { id: 'ct-4', site: 'btnull.org', status: 'warn',   statusLabel: '运行中', start: '23 分钟前', end: '—',          videos: 38, sources: 95,  dur: 0 },
  { id: 'ct-5', site: 'mokit.tv',   status: 'danger', statusLabel: '失败',   start: '44 分钟前', end: '43 分钟前', videos: 0,  sources: 0,   dur: 90 },
  { id: 'ct-6', site: 'voflix.cc',  status: 'ok',     statusLabel: '成功',   start: '51 分钟前', end: '50 分钟前', videos: 23, sources: 57,  dur: 77 },
] as const

// ── styles ────────────────────────────────────────────────────────

const PAGE_HEAD: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
}

const HEAD_TITLE: React.CSSProperties = {
  margin: 0,
  fontSize: '20px',
  fontWeight: 700,
  color: 'var(--fg-default)',
  lineHeight: 1.3,
}

const HEAD_SUB: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: '12px',
  color: 'var(--fg-muted)',
}

const HEAD_ACTIONS: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexShrink: 0,
}

const SELECT_STYLE: React.CSSProperties = {
  height: '28px',
  padding: '0 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: '12px',
  cursor: 'pointer',
}

const BTN_STYLE: React.CSSProperties = {
  height: '28px',
  padding: '0 12px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: '12px',
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
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const CARD_BODY: React.CSSProperties = {
  padding: '14px',
  flex: 1,
}

// ── sub-renderers ─────────────────────────────────────────────────

function AreaChart({ gradientId }: { readonly gradientId: string }) {
  const w = 700
  const h = 200
  const n = CHART_POINTS.length
  const pts = CHART_POINTS
    .map((v, i) => `${i * (w / (n - 1))},${h - v}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', height: 200, display: 'block' }}
      aria-label="采集任务量折线面积图（7 天）"
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
    </svg>
  )
}

function SourceDistribution() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {SOURCE_TYPES.map(({ label, pct, color }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
            <span style={{ color: 'var(--fg-default)' }}>{label}</span>
            <span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{pct}%</span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'inherit' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function CrawlerTaskTable() {
  const TH: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '11px',
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
    fontSize: '12px',
    borderBottom: '1px solid var(--border-subtle)',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
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
          {CRAWLER_TASKS.map((task) => (
            <tr key={task.id}>
              <td style={TD}><strong style={{ fontWeight: 600 }}>{task.site}</strong></td>
              <td style={TD}><Pill variant={task.status}>{task.statusLabel}</Pill></td>
              <td style={{ ...TD, color: 'var(--fg-muted)', fontSize: '11px' }}>{task.start}</td>
              <td style={{ ...TD, color: 'var(--fg-muted)', fontSize: '11px' }}>{task.end}</td>
              <td style={{ ...TD, textAlign: 'right' }}>
                {task.videos > 0
                  ? <strong style={{ color: 'var(--state-success-fg)', fontWeight: 600 }}>+{task.videos}</strong>
                  : <span style={{ color: 'var(--fg-disabled)' }}>—</span>}
              </td>
              <td style={{ ...TD, textAlign: 'right' }}>
                {task.sources > 0
                  ? <strong style={{ color: 'var(--accent-default)', fontWeight: 600 }}>+{task.sources}</strong>
                  : <span style={{ color: 'var(--fg-disabled)' }}>—</span>}
              </td>
              <td style={{ ...TD, textAlign: 'right', color: 'var(--fg-muted)' }}>
                {task.dur > 0 ? `${task.dur}s` : '—'}
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

export function AnalyticsView() {
  const [period, setPeriod] = useState<Period>('7d')
  const gradientId = useId().replace(/:/g, '-')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-analytics-view>
      <header style={PAGE_HEAD} data-page-head>
        <div>
          <h1 style={HEAD_TITLE}>数据看板</h1>
          <p style={HEAD_SUB}>视频 · 源 · 用户 · 采集任务 — 多维度运营观测</p>
        </div>
        <div style={HEAD_ACTIONS}>
          <select
            style={SELECT_STYLE}
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            aria-label="时间范围"
          >
            <option value="7d">7 天</option>
            <option value="30d">30 天</option>
            <option value="90d">90 天</option>
          </select>
          <button type="button" style={BTN_STYLE} disabled title="功能开发中（follow-up STATS-EXTEND-ANALYTICS）">
            导出报表
          </button>
        </div>
      </header>

      <div style={KPI_GRID} data-analytics-kpi-grid>
        {KPIS.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            variant={kpi.variant}
            dataSource="mock"
            delta={{ text: kpi.deltaText, direction: kpi.deltaDir }}
            spark={
              <Spark
                data={kpi.sparkData}
                color={kpi.sparkColor}
                variant="line"
                width={60}
                height={18}
              />
            }
          />
        ))}
      </div>

      <div style={CHARTS_GRID}>
        <div style={CARD} data-analytics-card="chart">
          <header style={CARD_HEAD}>
            <h2 style={CARD_TITLE}>采集任务量 · 7 天</h2>
          </header>
          <div style={CARD_BODY}>
            <AreaChart gradientId={gradientId} />
          </div>
        </div>

        <div style={CARD} data-analytics-card="source-types">
          <header style={CARD_HEAD}>
            <h2 style={CARD_TITLE}>源类型分布</h2>
          </header>
          <div style={CARD_BODY}>
            <SourceDistribution />
          </div>
        </div>
      </div>

      <div style={CARD} data-analytics-card="crawler-tasks">
        <header style={CARD_HEAD}>
          <h2 style={CARD_TITLE}>爬虫最近任务</h2>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--fg-muted)' }}>实时</span>
        </header>
        <CrawlerTaskTable />
      </div>
    </div>
  )
}
