/**
 * MetricKpiCardRow.tsx — Dashboard 第 2 行：4 张 MetricKpiCard（CHG-DESIGN-07 7C）
 *
 * 真源：reference.md §5.1.2 4 张 KPI 表 + §5.1 row2 grid repeat(4, 1fr) gap 12
 *
 * 数据来源：dashboard-data.ts buildDashboardStats() → DashboardStats.kpis
 * 共享组件：packages/admin-ui KpiCard + Spark
 */
import React from 'react'
import { KpiCard, Spark } from '@resovo/admin-ui'
import type { DashboardKpi } from '@/lib/dashboard-data'

const ROW_STYLE: React.CSSProperties = {
  display: 'grid',
  // 设计稿硬约束：repeat(4, 1fr) gap 12；不允许 auto-fill / minmax 折行
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '12px',
}

export interface MetricKpiCardRowProps {
  readonly kpis: readonly [DashboardKpi, DashboardKpi, DashboardKpi, DashboardKpi]
}

export function MetricKpiCardRow({ kpis }: MetricKpiCardRowProps) {
  return (
    <div style={ROW_STYLE} data-dashboard-row="2" data-dashboard-kpi-row>
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.key}
          label={kpi.label}
          value={kpi.value}
          variant={kpi.variant}
          delta={{ text: kpi.deltaText, direction: kpi.deltaDirection }}
          spark={<Spark data={kpi.sparkData} color={kpi.sparkColor} ariaLabel={`${kpi.label} 7 天趋势`} />}
          dataSource={kpi.dataSource}
          ariaLabel={typeof kpi.value === 'string' ? `${kpi.label}: ${kpi.value}` : kpi.label}
          testId={`kpi-${kpi.key}`}
        />
      ))}
    </div>
  )
}
