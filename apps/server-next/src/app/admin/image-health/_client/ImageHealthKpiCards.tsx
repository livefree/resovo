'use client'

/**
 * ImageHealthKpiCards.tsx — 健康概览 KPI 卡片组（高信息密度版）
 *
 * 3 卡（替代旧「视频总数 / Poster 覆盖率 / Backdrop 覆盖率 / 近7日破损」4 卡）：
 *   ① 图片正常视频：已发布 / 全部 两口径的「封面 ok 数 / 视频数」+ 覆盖率
 *      （健康口径 = 封面 poster_status='ok'，与「Poster 覆盖率」同源）
 *   ② 图片覆盖率：封面 / 背景 / 台标 / Banner 4 类，各显示 已发布% / 全部%
 *   ③ 近 7 日新增破损：事件数 + mini 趋势 spark（danger 态）
 *
 * 复用共享 KpiCard（`value: ReactNode` 承载复合密集布局，不改 admin-ui 公开 Props）+ Spark。
 * 颜色零硬编码（仅 design-tokens CSS 变量）；字号用 --font-size-* token。
 */

import type { CSSProperties, ReactElement } from 'react'
import { KpiCard, Spark } from '@resovo/admin-ui'
import type { ImageHealthStats, ImageCoverageScope } from '@/lib/image-health/api'

// ── 布局常量 ──────────────────────────────────────────────────────

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
}

// 卡①：图片正常视频 —— 2 行 × 3 列（scope / 分数 / 覆盖率）
const C1_BODY_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  columnGap: '10px',
  rowGap: '6px',
  alignItems: 'baseline',
}
const C1_SCOPE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  whiteSpace: 'nowrap',
}
const C1_FRACTION_STYLE: CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--fg-default)',
  justifySelf: 'end',
  whiteSpace: 'nowrap',
}
const C1_SEP_STYLE: CSSProperties = {
  fontWeight: 400,
  color: 'var(--fg-muted)',
  margin: '0 2px',
}
const C1_PCT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--fg-muted)',
  justifySelf: 'end',
  whiteSpace: 'nowrap',
}

// 卡②：图片覆盖率 —— 表头 + 4 行 × 3 列（类型 / 已发布% / 全部%）
const C2_BODY_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr 1fr',
  columnGap: '12px',
  rowGap: '5px',
  alignItems: 'baseline',
}
const C2_HEAD_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  fontWeight: 500,
  letterSpacing: '0.5px',
  color: 'var(--fg-muted)',
  justifySelf: 'end',
  whiteSpace: 'nowrap',
}
const C2_TYPE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  whiteSpace: 'nowrap',
}
const C2_PUB_PCT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm-tight)',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--fg-default)',
  justifySelf: 'end',
}
const C2_ALL_PCT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm-tight)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--fg-muted)',
  justifySelf: 'end',
}

// ── 工具 ──────────────────────────────────────────────────────────

/** 覆盖率百分比（分母为 0 → '—'，不除零） */
function fmtPct(ok: number, total: number): string {
  if (total <= 0) return '—'
  return `${((ok / total) * 100).toFixed(1)}%`
}

// 卡②的 4 类图片：label + scope 字段访问器
const COVERAGE_KINDS: ReadonlyArray<{ readonly label: string; readonly key: keyof Omit<ImageCoverageScope, 'videoCount'> }> = [
  { label: '封面', key: 'posterOk' },
  { label: '背景', key: 'backdropOk' },
  { label: '台标', key: 'logoOk' },
  { label: 'Banner', key: 'bannerOk' },
]

// ── 卡①内容：图片正常视频 ──────────────────────────────────────────

function ScopeLine({ label, ok, total }: { label: string; ok: number; total: number }): ReactElement {
  return (
    <>
      <span style={C1_SCOPE_STYLE} data-kpi-scope={label}>{label}</span>
      <span style={C1_FRACTION_STYLE} data-kpi-fraction={label}>
        {ok.toLocaleString()}
        <span style={C1_SEP_STYLE}>/</span>
        {total.toLocaleString()}
      </span>
      <span style={C1_PCT_STYLE}>{fmtPct(ok, total)}</span>
    </>
  )
}

function HealthyVideosValue({ published, all }: { published: ImageCoverageScope; all: ImageCoverageScope }): ReactElement {
  // KpiCard 把 value 包进 <p>，根用 <span>（phrasing content）避免 <div> 非法嵌套
  return (
    <span style={C1_BODY_STYLE}>
      <ScopeLine label="已发布" ok={published.posterOk} total={published.videoCount} />
      <ScopeLine label="全部" ok={all.posterOk} total={all.videoCount} />
    </span>
  )
}

// ── 卡②内容：图片覆盖率（4 类 × 已发布/全部）───────────────────────

function CoverageValue({ published, all }: { published: ImageCoverageScope; all: ImageCoverageScope }): ReactElement {
  // 根用 <span>（display:grid）避免 KpiCard <p> 内 <div> 非法嵌套；行用 display:contents 透传入网格
  return (
    <span style={C2_BODY_STYLE}>
      <span aria-hidden="true" />
      <span style={C2_HEAD_STYLE}>已发布</span>
      <span style={C2_HEAD_STYLE}>全部</span>
      {COVERAGE_KINDS.map(({ label, key }) => (
        <span key={label} style={{ display: 'contents' }} data-kpi-coverage-row={label}>
          <span style={C2_TYPE_STYLE}>{label}</span>
          <span style={C2_PUB_PCT_STYLE}>{fmtPct(published[key], published.videoCount)}</span>
          <span style={C2_ALL_PCT_STYLE}>{fmtPct(all[key], all.videoCount)}</span>
        </span>
      ))}
    </span>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function ImageHealthKpiCards({ stats }: { stats: ImageHealthStats }): ReactElement {
  const { published, all } = stats
  const trendCounts = stats.brokenTrend?.map((p) => p.count) ?? []

  const healthyAria =
    `图片正常视频：已发布 ${published.posterOk} / ${published.videoCount}（${fmtPct(published.posterOk, published.videoCount)}）；` +
    `全部 ${all.posterOk} / ${all.videoCount}（${fmtPct(all.posterOk, all.videoCount)}）`

  const coverageAria =
    '图片覆盖率（已发布 / 全部）：' +
    COVERAGE_KINDS.map(
      ({ label, key }) =>
        `${label} ${fmtPct(published[key], published.videoCount)} / ${fmtPct(all[key], all.videoCount)}`,
    ).join('；')

  return (
    <div style={GRID_STYLE} data-image-health-kpi-cards>
      <KpiCard
        label="图片正常视频"
        value={<HealthyVideosValue published={published} all={all} />}
        ariaLabel={healthyAria}
        testId="kpi-healthy-videos"
      />
      <KpiCard
        label="图片覆盖率"
        value={<CoverageValue published={published} all={all} />}
        ariaLabel={coverageAria}
        testId="kpi-coverage"
      />
      <KpiCard
        label="近 7 日新增破损"
        value={stats.brokenLast7Days.toLocaleString()}
        variant={stats.brokenLast7Days > 0 ? 'is-danger' : 'default'}
        spark={
          trendCounts.length > 0
            ? <Spark data={trendCounts} variant="line" color="var(--state-error-fg)" />
            : undefined
        }
        testId="kpi-broken-7d"
      />
    </div>
  )
}
