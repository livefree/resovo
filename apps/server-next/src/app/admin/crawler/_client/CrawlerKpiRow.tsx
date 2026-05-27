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

// W3-FIX HOTFIX-F：@livefree 实测反馈 — 窗口变窄时不要折叠为多行，改横向滚动保持单行 5 KpiCard
const ROW_WRAPPER_STYLE: CSSProperties = {
  // 容器横向滚动：宽度不够时显示滚动条而非 wrap
  overflowX: 'auto',
  minWidth: 0,  // 让外层 grid 1fr 真正可压缩到滚动
}

const ROW_STYLE: CSSProperties = {
  display: 'grid',
  // HOTFIX-F：固定 5 列（每列 minmax(140px, 1fr) / 总 minWidth ≈ 700px+gap）
  // - 容器宽 ≥ 760px：5 列均分填满
  // - 容器宽 < 760px：grid 不收缩到 < 5×140px=700px，外层 wrapper overflowX 触发横滚
  gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))',
  gap: '12px',
  // 防 grid 列收缩到 0 让 KpiCard 内容裁掉
  minWidth: 'min-content',
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
    <div style={ROW_WRAPPER_STYLE} data-crawler-kpi-row-wrapper>
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
    </div>
  )
}
