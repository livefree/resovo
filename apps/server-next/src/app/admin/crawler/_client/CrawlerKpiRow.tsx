'use client'

/**
 * CrawlerKpiRow.tsx — 采集页 KPI 行（5 张 KpiCard）
 *
 * 真源：M-SN-7-redo-01-contract.md §1.1 + reference.md §5.6
 * 数据：GET /admin/crawler/kpi（REDO-01-B / ADR-122 §3.1）
 *
 * 形态：grid repeat(5, 1fr) gap 12；KpiCard variant 映射「站点 / 运行中 / 失败 / 本批视频量 / 平均时长」
 */

import { type CSSProperties } from 'react'
import { KpiCard } from '@resovo/admin-ui'
import type { CrawlerKpiResponse } from '@/lib/crawler/api'

const ROW_STYLE: CSSProperties = {
  display: 'grid',
  // ADR-155 D-155-5 EP-1B2-LAYOUT：grid auto-fit 适应容器宽度自动 wrap
  // - 独立使用时（容器宽 1200px+）：1 行 5 列（minmax 140 让单卡不会过窄）
  // - 概览区窄宽（KpiRow 占 SummaryCard 右侧 flex:1 ≈ 720px）：wrap 为 3+2 两行
  // - 浏览器窄屏（< 900px）：wrap 为 2+2+1
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '12px',
}

export interface CrawlerKpiRowProps {
  /** GET /admin/crawler/kpi 聚合数据；null 时渲染 `—` 占位 */
  readonly kpi: CrawlerKpiResponse | null
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remain = Math.round(seconds % 60)
  return remain === 0 ? `${minutes}min` : `${minutes}min ${remain}s`
}

function formatNumber(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US')
}

export function CrawlerKpiRow({ kpi }: CrawlerKpiRowProps) {
  const dataSource = kpi ? 'live' : undefined
  const live = kpi != null

  return (
    <div style={ROW_STYLE} data-crawler-kpi-row>
      <KpiCard
        label="站点"
        value={live ? formatNumber(kpi!.totalSites) : '—'}
        variant="default"
        delta={live ? { text: `${kpi!.healthySites} 健康`, direction: 'up' } : undefined}
        dataSource={dataSource}
        testId="crawler-kpi-total"
      />
      <KpiCard
        label="运行中"
        value={live ? formatNumber(kpi!.runningSites) : '—'}
        variant="is-warn"
        delta={live ? { text: '实时', direction: 'flat' } : undefined}
        dataSource={dataSource}
        testId="crawler-kpi-running"
      />
      <KpiCard
        label="失败"
        value={live ? formatNumber(kpi!.failedSites) : '—'}
        variant="is-danger"
        delta={live ? { text: '≥3 次连失', direction: 'flat' } : undefined}
        dataSource={dataSource}
        testId="crawler-kpi-failed"
      />
      <KpiCard
        label="本批视频量"
        value={live ? formatNumber(kpi!.batchVideoCount) : '—'}
        variant="is-ok"
        delta={
          live
            ? {
                text: `${kpi!.batchVideoDelta >= 0 ? '+' : ''}${kpi!.batchVideoDelta} 今日`,
                direction: kpi!.batchVideoDelta >= 0 ? 'up' : 'down',
              }
            : undefined
        }
        dataSource={dataSource}
        testId="crawler-kpi-batch"
      />
      <KpiCard
        label="平均时长"
        value={live ? formatDuration(kpi!.avgDurationSeconds) : '—'}
        variant="default"
        delta={live ? { text: '/ 站点', direction: 'flat' } : undefined}
        dataSource={dataSource}
        testId="crawler-kpi-avg-duration"
      />
    </div>
  )
}
