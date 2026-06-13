/**
 * AnalyticsView.test.tsx — Dashboard Analytics Tab 单元测试
 * （CHG-SN-7-MISC-DASHBOARD-2 更新：真端点版本）
 *
 * 覆盖：
 *   - 加载态（LoadingState）
 *   - 错误态（ErrorState）
 *   - 4 KPI 卡片渲染（live 数据）
 *   - period 切换（7d / 30d / 90d）→ 重载数据 + chart label 更新
 *   - SVG AreaChart 渲染（polyline + linearGradient + grid lines）
 *   - SourceDistribution 渲染（进度条列表）
 *   - CrawlerTaskTable 渲染（真实任务行）
 *   - 时间范围 select / 导出报表按钮（disabled）
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'

// ── mock api-client（断开 authStore 依赖链）───────────────────────

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => {
  class MockApiClientError extends Error {
    constructor(msg: string) { super(msg) }
  }
  return {
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    ApiClientError: MockApiClientError,
  }
})

// ── mock dashboard/api ────────────────────────────────────────────

const mockGetAnalytics = vi.fn()
vi.mock('../../../../../../apps/server-next/src/lib/dashboard/api', () => ({
  getDashboardAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
}))

// ── import after mocks ────────────────────────────────────────────

import { AnalyticsView } from '../../../../../../apps/server-next/src/app/admin/_client/AnalyticsView'

// ── deterministic mock response ───────────────────────────────────

const MOCK_ANALYTICS = {
  kpis: [
    { key: 'videoTotal',          value: '695',      deltaText: '↑ +47 今日', deltaDirection: 'up',   variant: 'default'   },
    { key: 'pendingStaging',      value: '484 / 23', deltaText: '→ 持平',     deltaDirection: 'flat', variant: 'is-warn'   },
    { key: 'sourceReachableRate', value: '98.7%',    deltaText: '↑ 健康',     deltaDirection: 'up',   variant: 'is-ok'     },
    { key: 'inactiveSources',     value: '1,939',    deltaText: '↑ 偏多',     deltaDirection: 'up',   variant: 'is-danger' },
  ],
  collectTimeline: [
    { date: '2026-05-13', count: 120 },
    { date: '2026-05-14', count: 135 },
    { date: '2026-05-15', count: 148 },
    { date: '2026-05-16', count: 158 },
    { date: '2026-05-17', count: 143 },
    { date: '2026-05-18', count: 130 },
    { date: '2026-05-19', count: 119 },
  ],
  sourceTypeDistribution: [
    { type: 'm3u8', count: 1000, pct: 78.1 },
    { type: 'mp4',  count: 154,  pct: 12.0 },
    { type: 'embed', count: 90, pct: 7.0 },
    { type: '其他',  count: 38,  pct: 2.9 },
  ],
  recentTasks: [
    { id: 'task-1', site: 'iyf.tv', status: 'ok', statusLabel: '成功', startedAt: '2026-05-19T10:00:00Z', finishedAt: '2026-05-19T10:01:00Z', videosUpserted: 55, sourcesUpserted: 138, durationSeconds: 53 },
    { id: 'task-2', site: 'mokit.tv', status: 'danger', statusLabel: '失败', startedAt: '2026-05-19T09:00:00Z', finishedAt: '2026-05-19T09:01:30Z', videosUpserted: 0, sourcesUpserted: 0, durationSeconds: 90 },
  ],
} as const

afterEach(() => {
  cleanup()
  mockGetAnalytics.mockReset()
})

beforeEach(() => {
  mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS)
})

describe('AnalyticsView — 加载态', () => {
  it('1. 加载中显示 LoadingState（data-loading-state）', () => {
    mockGetAnalytics.mockReturnValue(new Promise(() => { /* never resolves */ }))
    const { container } = render(<AnalyticsView />)
    expect(container.querySelector('[data-loading-state]')).toBeTruthy()
  })

  it('2. 加载成功后不显示 LoadingState', async () => {
    const { container } = render(<AnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-analytics-kpi-grid]')).toBeTruthy())
    expect(container.querySelector('[data-loading-state]')).toBeNull()
  })

  it('3. 接口失败 → 显示 ErrorState（data-error-state 或 [data-analytics-error]）', async () => {
    mockGetAnalytics.mockRejectedValue(new Error('network error'))
    const { container } = render(<AnalyticsView />)
    await waitFor(() =>
      expect(
        container.querySelector('[data-error-state]') ?? container.querySelector('[data-analytics-error]'),
      ).toBeTruthy()
    )
  })
})

describe('AnalyticsView — 基础渲染', () => {
  it('4. 渲染 data-analytics-view 根节点', () => {
    const { container } = render(<AnalyticsView />)
    expect(container.querySelector('[data-analytics-view]')).not.toBeNull()
  })

  it('5. 渲染页头：标题"数据看板"（HDR-DEDUP：装饰副标已删）', async () => {
    const { getByText, queryByText } = render(<AnalyticsView />)
    await waitFor(() => expect(getByText('数据看板')).toBeTruthy())
    // HDR-DEDUP 卡4：装饰性副标题「视频 · 源 · 用户 · 采集任务 — 多维度运营观测」已移除
    expect(queryByText(/视频 · 源 · 用户 · 采集任务/)).toBeNull()
  })

  it('6. 渲染 4 KPI 卡片（KPI grid 含 4 个子节点）', async () => {
    const { container } = render(<AnalyticsView />)
    await waitFor(() => {
      const grid = container.querySelector('[data-analytics-kpi-grid]')
      expect(grid).not.toBeNull()
      expect(grid!.children.length).toBe(4)
    })
  })
})

describe('AnalyticsView — 时间范围切换', () => {
  it('7. 默认 period=7d', async () => {
    const { getByLabelText } = render(<AnalyticsView />)
    const select = getByLabelText('时间范围') as HTMLSelectElement
    expect(select.value).toBe('7d')
  })

  it('8. period 切到 30d → 重载数据 + AreaChart aria-label 含"30 天"', async () => {
    const { container, getByLabelText } = render(<AnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-analytics-kpi-grid]')).toBeTruthy())
    const select = getByLabelText('时间范围') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '30d' } })
    await waitFor(() => expect(container.querySelector('svg[aria-label*="30 天"]')).not.toBeNull())
  })

  it('9. period 切到 90d → AreaChart aria-label 含"90 天"', async () => {
    const { container, getByLabelText } = render(<AnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-analytics-kpi-grid]')).toBeTruthy())
    const select = getByLabelText('时间范围') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '90d' } })
    await waitFor(() => expect(container.querySelector('svg[aria-label*="90 天"]')).not.toBeNull())
  })
})

describe('AnalyticsView — AreaChart self-rendered SVG（ADR-119-NEGATED 决策守卫）', () => {
  it('10. 含 SVG polyline（不依赖 recharts / visx）', async () => {
    const { container } = render(<AnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-analytics-chart="timeline"]')).toBeTruthy())
    const polylines = container.querySelectorAll('svg polyline')
    expect(polylines.length).toBeGreaterThanOrEqual(2)
  })

  it('11. 含 linearGradient（token color via fillOpacity）', async () => {
    const { container } = render(<AnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-analytics-chart="timeline"]')).toBeTruthy())
    expect(container.querySelector('svg linearGradient')).not.toBeNull()
  })

  it('12. 含 4 grid lines（横向 baseline 参考）', async () => {
    const { container } = render(<AnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-analytics-chart="timeline"]')).toBeTruthy())
    const gridLines = container.querySelectorAll('svg line[stroke*="--border-subtle"]')
    expect(gridLines.length).toBe(4)
  })
})

describe('AnalyticsView — 卡片矩阵', () => {
  it('13. 渲染 chart / source-types / crawler-tasks 3 张 card', async () => {
    const { container } = render(<AnalyticsView />)
    await waitFor(() => {
      expect(container.querySelector('[data-analytics-card="chart"]')).not.toBeNull()
      expect(container.querySelector('[data-analytics-card="source-types"]')).not.toBeNull()
      expect(container.querySelector('[data-analytics-card="crawler-tasks"]')).not.toBeNull()
    })
  })

  it('14. 源类型分布渲染进度条列表（≥ 3 条）', async () => {
    const { container } = render(<AnalyticsView />)
    await waitFor(() => {
      const section = container.querySelector('[data-analytics-section="source-types"]')
      expect(section).not.toBeNull()
      const rows = section!.querySelectorAll('div > div')
      expect(rows.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('15. 爬虫最近任务表渲染 + "实时"标识 + 任务行', async () => {
    const { container } = render(<AnalyticsView />)
    await waitFor(() => {
      const section = container.querySelector('[data-analytics-section="crawler-tasks"]')
      expect(section).not.toBeNull()
      const crawlerCard = container.querySelector('[data-analytics-card="crawler-tasks"]')!
      expect(crawlerCard.textContent).toContain('实时')
      // mock data has 2 tasks
      const rows = section!.querySelectorAll('tbody tr')
      expect(rows.length).toBe(2)
    })
  })
})

describe('AnalyticsView — 导出报表按钮 follow-up 状态', () => {
  it('16. 导出报表按钮 disabled + title 含 STATS-EXTEND-ANALYTICS', async () => {
    const { getByText } = render(<AnalyticsView />)
    await waitFor(() => expect(getByText('导出报表')).toBeTruthy())
    const btn = getByText('导出报表') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('STATS-EXTEND-ANALYTICS')
  })
})
