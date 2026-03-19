/**
 * tests/unit/components/admin/dashboard/AnalyticsCards.test.tsx
 * CHG-25: AnalyticsCards 数据正确渲染
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalyticsCards } from '@/components/admin/dashboard/AnalyticsCards'
import type { AnalyticsData } from '@/api/routes/admin/analytics'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getAnalytics: vi.fn(),
  },
}))

const MOCK_DATA: AnalyticsData = {
  videos: { total: 120, published: 90, pending: 30 },
  sources: { total: 200, active: 180, inactive: 20, failRate: 0.1 },
  users: { total: 500, todayNew: 12, banned: 3 },
  queues: { submissions: 5, subtitles: 2 },
  crawlerTasks: {
    recent: [
      { id: 't1', type: 'bilibili', status: 'done', created_at: '2026-03-18T00:00:00Z', finished_at: '2026-03-18T00:05:00Z' },
      { id: 't2', type: 'iqiyi', status: 'running', created_at: '2026-03-18T01:00:00Z', finished_at: null },
      { id: 't3', type: 'youku', status: 'failed', created_at: '2026-03-18T02:00:00Z', finished_at: null },
      { id: 't4', type: 'mango', status: 'pending', created_at: '2026-03-18T03:00:00Z', finished_at: null },
      { id: 't5', type: 'sohu', status: 'done', created_at: '2026-03-18T04:00:00Z', finished_at: '2026-03-18T04:10:00Z' },
      { id: 't6', type: 'letv', status: 'done', created_at: '2026-03-18T05:00:00Z', finished_at: '2026-03-18T05:10:00Z' },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AnalyticsCards', () => {
  it('渲染 6 张统计卡片', () => {
    render(<AnalyticsCards initialData={MOCK_DATA} />)
    const cards = screen.getAllByTestId('analytics-stat-card')
    // 6 summary + 3 sources = 9 cards total
    expect(cards.length).toBeGreaterThanOrEqual(6)
  })

  it('显示视频总数', () => {
    render(<AnalyticsCards initialData={MOCK_DATA} />)
    const values = screen.getAllByTestId('analytics-stat-value').map((el) => el.textContent)
    expect(values).toContain('120')
  })

  it('显示已发布视频数', () => {
    render(<AnalyticsCards initialData={MOCK_DATA} />)
    const values = screen.getAllByTestId('analytics-stat-value').map((el) => el.textContent)
    expect(values).toContain('90')
  })

  it('显示用户总数', () => {
    render(<AnalyticsCards initialData={MOCK_DATA} />)
    const values = screen.getAllByTestId('analytics-stat-value').map((el) => el.textContent)
    expect(values).toContain('500')
  })

  it('显示今日新增用户', () => {
    render(<AnalyticsCards initialData={MOCK_DATA} />)
    const values = screen.getAllByTestId('analytics-stat-value').map((el) => el.textContent)
    expect(values).toContain('12')
  })

  it('待处理事项卡片显示 submissions + subtitles 合计', () => {
    render(<AnalyticsCards initialData={MOCK_DATA} />)
    const values = screen.getAllByTestId('analytics-stat-value').map((el) => el.textContent)
    expect(values).toContain('7')  // 5 + 2
  })

  it('失效率百分比正确格式化', () => {
    render(<AnalyticsCards initialData={MOCK_DATA} />)
    const values = screen.getAllByTestId('analytics-stat-value').map((el) => el.textContent)
    expect(values).toContain('10.0%')
  })

  it('爬虫任务表格最多显示 5 条', () => {
    render(<AnalyticsCards initialData={MOCK_DATA} />)
    const table = screen.getByTestId('analytics-crawler-tasks')
    // The mock data has 6 tasks; only 5 should be shown
    const rows = table.querySelectorAll('tbody tr')
    expect(rows.length).toBe(5)
  })

  it('爬虫任务状态使用 StatusBadge 渲染', () => {
    render(<AnalyticsCards initialData={MOCK_DATA} />)
    // StatusBadge renders data-testid="status-badge-<status>"
    // done → published (2 tasks, but only 5 shown so both are in view)
    expect(screen.getAllByTestId('status-badge-published').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('status-badge-active').length).toBeGreaterThanOrEqual(1)   // running → active
    expect(screen.getAllByTestId('status-badge-banned').length).toBeGreaterThanOrEqual(1)   // failed → banned
    expect(screen.getAllByTestId('status-badge-pending').length).toBeGreaterThanOrEqual(1)  // pending → pending
  })
})
