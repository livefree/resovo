'use client'

/**
 * VideoPlaysAnalyticsView.tsx — Dashboard「视频播放」tab 内容（ADR-217 / SEQ-20260624-02 STATS-07-B）
 *
 * 消费 STATS-07-A 三只读端点（daily-only），呈现后台运营三视图：
 *   - overview：5 KpiCard（总播放 / 总观看秒 / 均观看秒 / 匿名 / 登录）
 *   - trend：inline SVG 折线（恒 N 点 zero-fill，零图表库依赖，镜像 AnalyticsView AreaChart）
 *   - top-videos：admin-ui 一体化 DataTable（server mode 直渲全行，禁 v1 三件套，D-217-10）
 *
 * 关键约束（ADR-217 语义守卫，Codex 卡审 LOW-9）：
 *   - top-videos 合计**不与** overview/trend 对账（D-217-6 刻意不同口径）
 *   - 今日桶 partial/mutable（D-217-2），UI 不暗示今日数值闭合稳定
 *   - avgWatchSeconds=0 展示为 `0` 非 NaN/空
 *   - anon/logged 是播放次数拆分、含 ephemeral 匿名播放（非 UV）
 *
 * 取数 stale guard（Codex 卡审 MEDIUM-4）：requestSeqRef 自增，Promise.all 原子取三视图，
 *   仅当回调序号 == 最新时 setState；快速切 period 旧响应不覆盖新、三视图不混 period。
 */

import React, { useState, useEffect, useCallback, useRef, useId } from 'react'
import {
  KpiCard,
  LoadingState,
  ErrorState,
  PageHeader,
  DataTable,
} from '@resovo/admin-ui'
import type { TableColumn, TableQuerySnapshot } from '@resovo/admin-ui'
import {
  getVideoPlaysOverview,
  getVideoPlaysTrend,
  getTopVideos,
} from '@/lib/video-plays/api'
import type {
  VideoPlaysPeriod,
  VideoPlaysOverview,
  VideoPlaysTrendPoint,
  VideoPlaysTopVideo,
} from '@resovo/types'

// ── 常量 ──────────────────────────────────────────────────────────

const PERIOD_LABEL: Record<VideoPlaysPeriod, string> = {
  '7d': '7 天',
  '30d': '30 天',
  '90d': '90 天',
}

const TOP_VIDEOS_LIMIT = 20

function fmtInt(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '0'
}

function fmtAvg(n: number): string {
  // avg 除零保护：service 已保证 totalPlays=0 → 0；此处再防 NaN/Infinity 展示（Codex LOW-9）
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '0'
}

// ── styles（CSS 变量，零硬编码色）──────────────────────────────────

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

const KPI_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
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

// ── DataTable 静态 query（top-videos 固定 ≤limit 只读列表、零交互；
//    server mode 直渲全行 + pagination 隐藏 → 不走 client 默认 pageSize 切片，Codex HIGH-3）──

const STATIC_TABLE_QUERY: TableQuerySnapshot = {
  pagination: { page: 1, pageSize: TOP_VIDEOS_LIMIT },
  sort: { field: undefined, direction: 'asc' },
  filters: new Map(),
  columns: new Map(),
  selection: { selectedKeys: new Set(), mode: 'page' },
}

function noopQueryChange(): void {
  /* top-videos 无交互（无排序/过滤/分页）；DataTable 必填 prop 的惰性回调 */
}

const TOP_VIDEO_COLUMNS: readonly TableColumn<VideoPlaysTopVideo>[] = [
  { id: 'shortId', header: 'Short ID', accessor: (r) => r.shortId, width: 140, enableSorting: false, filterable: false },
  { id: 'title', header: '标题', accessor: (r) => r.title, width: 320, minWidth: 160, enableSorting: false, filterable: false },
  {
    id: 'plays',
    header: '播放数',
    accessor: (r) => r.plays,
    cell: (ctx) => fmtInt(ctx.row.plays),
    width: 120,
    enableSorting: false,
    filterable: false,
  },
  {
    id: 'watchSeconds',
    header: '观看秒数',
    accessor: (r) => r.watchSeconds,
    cell: (ctx) => fmtInt(ctx.row.watchSeconds),
    width: 140,
    enableSorting: false,
    filterable: false,
  },
]

// ── trend SVG（镜像 AnalyticsView AreaChart；零图表库）─────────────
//   退化态（Codex MEDIUM-5）：plot padding、全 0 画可见 flat baseline 不压边界、
//   <title> 含 period + 点数 + 首尾 date、polyline 带 data-video-plays-trend-line。

function TrendChart({
  gradientId,
  periodLabel,
  points,
}: {
  readonly gradientId: string
  readonly periodLabel: string
  readonly points: readonly VideoPlaysTrendPoint[]
}) {
  const w = 700
  const h = 200
  const pad = 24 // plot padding：基线不贴边
  const values = points.map((p) => p.plays)
  const maxVal = Math.max(...values, 1) // 全 0 时 maxVal=1 → y 落在 baseline（h-pad），可见非压边
  const n = values.length
  const firstDate = points[0]?.date ?? '—'
  const lastDate = points[n - 1]?.date ?? '—'

  const x = (i: number) => pad + i * ((w - pad * 2) / Math.max(n - 1, 1))
  const y = (v: number) => h - pad - (v / maxVal) * (h - pad * 2)
  const coords = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', height: 200, display: 'block' }}
      role="img"
      aria-label={`视频播放每日趋势（近 ${periodLabel}，${n} 天，${firstDate} 至 ${lastDate}）`}
      data-video-plays-trend-chart
    >
      <title>{`视频播放每日趋势 · 近 ${periodLabel} · ${n} 天 · ${firstDate} ~ ${lastDate}`}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-default)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent-default)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[pad, h / 2, h - pad].map((gy) => (
        <line key={gy} x1={pad} x2={w - pad} y1={gy} y2={gy} stroke="var(--border-subtle)" strokeWidth="1" />
      ))}
      {n > 1 && (
        <polyline points={`${x(0).toFixed(1)},${h - pad} ${coords} ${x(n - 1).toFixed(1)},${h - pad}`} fill={`url(#${gradientId})`} />
      )}
      <polyline
        points={coords}
        fill="none"
        stroke="var(--accent-default)"
        strokeWidth="2"
        data-video-plays-trend-line
      />
    </svg>
  )
}

// ── overview KpiCard 组（5 指标）──────────────────────────────────

function OverviewCards({ overview }: { readonly overview: VideoPlaysOverview }) {
  return (
    <div style={KPI_GRID} data-video-plays-overview>
      <KpiCard label="总播放数" value={fmtInt(overview.totalPlays)} />
      <KpiCard label="总观看秒数" value={fmtInt(overview.totalWatchSeconds)} />
      <KpiCard label="均观看秒数 / 次" value={fmtAvg(overview.avgWatchSeconds)} />
      <KpiCard label="匿名播放" value={fmtInt(overview.anonPlays)} />
      <KpiCard label="登录播放" value={fmtInt(overview.loggedInPlays)} />
    </div>
  )
}

// ── main view ─────────────────────────────────────────────────────

interface ViewData {
  readonly overview: VideoPlaysOverview
  readonly trend: readonly VideoPlaysTrendPoint[]
  readonly topVideos: readonly VideoPlaysTopVideo[]
}

export function VideoPlaysAnalyticsView() {
  const [period, setPeriod] = useState<VideoPlaysPeriod>('7d')
  const [data, setData] = useState<ViewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const requestSeqRef = useRef(0)
  const gradientId = useId().replace(/:/g, '-')
  // 标题周期文案消费已加载数据的 overview.period 回显（D-217 / Codex LOW-2）；
  // 切换 pending 期沿用上次已加载 period，与展示数据一致（select 自身用本地 period state）
  const periodLabel = PERIOD_LABEL[data?.overview.period ?? period]

  const loadData = useCallback((p: VideoPlaysPeriod) => {
    const seq = ++requestSeqRef.current
    setLoading(true)
    setError(undefined)
    Promise.all([getVideoPlaysOverview(p), getVideoPlaysTrend(p), getTopVideos(p, TOP_VIDEOS_LIMIT)])
      .then(([overview, trend, topVideos]) => {
        if (seq !== requestSeqRef.current) return // stale：更晚的请求已发起，丢弃旧响应（不混 period）
        setData({ overview, trend, topVideos })
      })
      .catch((e: unknown) => {
        if (seq !== requestSeqRef.current) return
        setData(null) // 失败不留旧 period 数据冒充新
        setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (seq === requestSeqRef.current) setLoading(false)
      })
  }, [])

  useEffect(() => { loadData(period) }, [loadData, period])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-video-plays-view>
      <PageHeader
        title="视频播放分析"
        actions={
          <select
            style={SELECT_STYLE}
            value={period}
            onChange={(e) => setPeriod(e.target.value as VideoPlaysPeriod)}
            aria-label="时间范围"
            data-video-plays-period-select
          >
            <option value="7d">7 天</option>
            <option value="30d">30 天</option>
            <option value="90d">90 天</option>
          </select>
        }
      />

      {loading && <LoadingState variant="skeleton" />}
      {!loading && error && (
        <ErrorState error={error} title="加载视频播放分析失败" onRetry={() => loadData(period)} />
      )}

      {!loading && !error && data && (
        <>
          <OverviewCards overview={data.overview} />

          <div style={CARD} data-video-plays-card="trend">
            <header style={CARD_HEAD}>
              <h2 style={CARD_TITLE}>每日播放趋势 · 近 {periodLabel}</h2>
            </header>
            <div style={CARD_BODY}>
              <TrendChart gradientId={gradientId} periodLabel={periodLabel} points={data.trend} />
            </div>
          </div>

          <div style={CARD} data-video-plays-card="top-videos">
            <header style={CARD_HEAD}>
              <h2 style={CARD_TITLE}>热门视频 · 近 {periodLabel}（前 {TOP_VIDEOS_LIMIT}）</h2>
            </header>
            <div style={CARD_BODY}>
              <DataTable<VideoPlaysTopVideo>
                rows={data.topVideos}
                columns={TOP_VIDEO_COLUMNS}
                rowKey={(r) => r.shortId}
                mode="server"
                query={STATIC_TABLE_QUERY}
                onQueryChange={noopQueryChange}
                totalRows={data.topVideos.length}
                pagination={{ hidden: true }}
                toolbar={{ hidden: true }}
                columnTriggerVisibility="never"
                emptyState={<div style={{ padding: '24px', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm)' }}>近 {periodLabel}暂无播放数据</div>}
                data-testid="video-plays-top-videos-table"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
