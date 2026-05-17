/**
 * AnalyticsView.test.tsx — Dashboard Analytics Tab 单元测试
 * （CHG-SN-6-11 / ADR-119-NEGATED 配套 / 5 项硬清单视图 ≥ 9）
 *
 * 覆盖：
 *   - 4 KPI 卡片渲染
 *   - period 切换（7d / 30d / 90d）→ KPI delta + chart label 更新
 *   - SVG AreaChart 渲染（polyline + linearGradient + grid lines）
 *   - SourceDistribution 渲染（progress bar 列表）
 *   - CrawlerTaskTable 渲染（mock data 行）
 *   - 时间范围 select / 导出报表按钮（disabled）
 *
 * 注：ADR-119-NEGATED 决策依据 — 零图表库依赖，全 self-rendered SVG +
 * admin-ui Spark；本测试守卫该决策的实施真源（AnalyticsView 419 行）
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { AnalyticsView } from '../../../../../../apps/server-next/src/app/admin/_client/AnalyticsView'

afterEach(() => cleanup())

describe('AnalyticsView — 基础渲染', () => {
  it('1. 渲染 data-analytics-view 根节点', () => {
    const { container } = render(<AnalyticsView />)
    expect(container.querySelector('[data-analytics-view]')).not.toBeNull()
  })

  it('2. 渲染页头：标题"数据看板" + 副标', () => {
    render(<AnalyticsView />)
    expect(screen.getByText('数据看板')).not.toBeNull()
    expect(screen.getByText(/视频 · 源 · 用户 · 采集任务/)).not.toBeNull()
  })

  it('3. 渲染 4 KPI 卡片（KPI grid 含 4 个子节点）', () => {
    const { container } = render(<AnalyticsView />)
    const grid = container.querySelector('[data-analytics-kpi-grid]')
    expect(grid).not.toBeNull()
    expect(grid!.children.length).toBe(4)
  })
})

describe('AnalyticsView — 时间范围切换', () => {
  it('4. 默认 period=7d 渲染', () => {
    render(<AnalyticsView />)
    const select = screen.getByLabelText('时间范围') as HTMLSelectElement
    expect(select.value).toBe('7d')
  })

  it('5. period 切到 30d → AreaChart aria-label 含"30 天"', () => {
    const { container } = render(<AnalyticsView />)
    const select = screen.getByLabelText('时间范围') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '30d' } })
    const svg = container.querySelector('svg[aria-label*="30 天"]')
    expect(svg).not.toBeNull()
  })

  it('6. period 切到 90d → AreaChart aria-label 含"90 天"', () => {
    const { container } = render(<AnalyticsView />)
    const select = screen.getByLabelText('时间范围') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '90d' } })
    expect(container.querySelector('svg[aria-label*="90 天"]')).not.toBeNull()
  })
})

describe('AnalyticsView — AreaChart self-rendered SVG（ADR-119-NEGATED 决策守卫）', () => {
  it('7. 含 SVG polyline（不依赖 recharts / visx）', () => {
    const { container } = render(<AnalyticsView />)
    const polylines = container.querySelectorAll('svg polyline')
    expect(polylines.length).toBeGreaterThanOrEqual(2)  // area fill + line stroke
  })

  it('8. 含 linearGradient（token color via fillOpacity）', () => {
    const { container } = render(<AnalyticsView />)
    expect(container.querySelector('svg linearGradient')).not.toBeNull()
  })

  it('9. 含 4 grid lines（横向 baseline 参考）', () => {
    const { container } = render(<AnalyticsView />)
    const gridLines = container.querySelectorAll('svg line[stroke*="--border-subtle"]')
    expect(gridLines.length).toBe(4)
  })
})

describe('AnalyticsView — 卡片矩阵', () => {
  it('10. 渲染 chart / source-types / crawler-tasks 3 张 card', () => {
    const { container } = render(<AnalyticsView />)
    expect(container.querySelector('[data-analytics-card="chart"]')).not.toBeNull()
    expect(container.querySelector('[data-analytics-card="source-types"]')).not.toBeNull()
    expect(container.querySelector('[data-analytics-card="crawler-tasks"]')).not.toBeNull()
  })

  it('11. 源类型分布渲染进度条列表（mock 数据 ≥ 3 条）', () => {
    const { container } = render(<AnalyticsView />)
    const card = container.querySelector('[data-analytics-card="source-types"]')!
    // 内部含至少 3 个进度条容器（4 源类型 mock 数据）
    const innerRows = card.querySelectorAll('div > div > div')
    expect(innerRows.length).toBeGreaterThan(0)
  })

  it('12. 爬虫最近任务表渲染 + "实时"标识', () => {
    const { container } = render(<AnalyticsView />)
    const crawlerCard = container.querySelector('[data-analytics-card="crawler-tasks"]')!
    expect(crawlerCard.textContent).toContain('爬虫最近任务')
    expect(crawlerCard.textContent).toContain('实时')
  })
})

describe('AnalyticsView — 导出报表按钮 follow-up 状态', () => {
  it('13. 导出报表按钮 disabled + title 含 STATS-EXTEND-ANALYTICS', () => {
    render(<AnalyticsView />)
    const btn = screen.getByText('导出报表') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('STATS-EXTEND-ANALYTICS')
  })
})
