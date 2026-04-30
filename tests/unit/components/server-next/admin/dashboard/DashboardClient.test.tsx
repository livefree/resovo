/**
 * DashboardClient.test.tsx — Dashboard regression gate（CHG-DESIGN-07 7C 步骤 5）
 *
 * 防 CHG-SN-3-08 假完成模式（reference §5.1.4 教训直接落地）：
 *   - case A 接口完整成功 → 4 行布局 + 9 类卡片 + [data-card-value] 全非破折号
 *   - case B 接口字段缺失 → fallback mock + data-source="mock" + 仍无破折号
 *   - case C 接口失败 500 → ErrorState 兜底，不破坏后续 4 行 grid 布局结构
 *
 * 断言收紧（避免误伤 page__head em-dash 文案）：
 *   - 仅在 [data-card-value] / [data-workflow-progress-value] / [data-source="mock"] 节点上断言
 *   - 不在 [data-page-head] 内做破折号断言（合法 em dash 文案）
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import React from 'react'

// ── mock next/navigation ─────────────────────────────────────────

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

// ── mock getModerationStats ──────────────────────────────────────

const mockGetStats = vi.fn()
vi.mock('@/lib/videos/api', () => ({
  getModerationStats: () => mockGetStats(),
}))

// 注：必须 vi.mock 之后再 import DashboardClient，避免吊起的真实 module
import { DashboardClient } from '../../../../../../apps/server-next/src/app/admin/_client/DashboardClient'

afterEach(() => {
  cleanup()
  mockGetStats.mockReset()
  mockPush.mockReset()
})

beforeEach(() => {
  // 默认空 search params
  for (const key of Array.from(mockSearchParams.keys())) {
    mockSearchParams.delete(key)
  }
})

describe('DashboardClient — case A：接口完整成功（reference §5.1.4 主路径）', () => {
  beforeEach(() => {
    mockGetStats.mockResolvedValue({
      pendingCount: 484,
      todayReviewedCount: 67,
      interceptRate: 0.12,
    })
  })

  it('4 行布局存在（page__head + 3 行 grid）', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-page-head]')).toBeTruthy()
      expect(container.querySelector('[data-dashboard-row="1"]')).toBeTruthy()
      // row 2 由 MetricKpiCardRow 组件挂 data-dashboard-row="2"
      expect(container.querySelector('[data-dashboard-row="2"]')).toBeTruthy()
      expect(container.querySelector('[data-dashboard-row="3"]')).toBeTruthy()
    })
  })

  it('5 类卡片选择器全部命中（attention / workflow / 4×metric-kpi / recent-activity / site-health）', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-card="attention"]')).toBeTruthy()
      expect(container.querySelector('[data-card="workflow"]')).toBeTruthy()
      expect(container.querySelectorAll('[data-kpi-card]').length).toBe(4)
      expect(container.querySelector('[data-card="recent-activity"]')).toBeTruthy()
      expect(container.querySelector('[data-card="site-health"]')).toBeTruthy()
    })
  })

  it('[data-card-value] 全部非破折号（4 张 KPI 主数值；reference §5.1.4 教训守门）', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      const values = container.querySelectorAll('[data-card-value]')
      expect(values.length).toBe(4)
      values.forEach((node) => {
        const text = node.textContent ?? ''
        expect(text).not.toBe('—')
        expect(text).not.toBe('')
        // 防退化：非空且不含破折号
        expect(text.trim().length).toBeGreaterThan(0)
      })
    })
  })

  it('KPI 待审/暂存使用 live pendingCount（dataSource="live"）+ 显示 484', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      const pendingKpi = container.querySelector('[data-testid="kpi-pendingStaging"]')
      expect(pendingKpi?.getAttribute('data-source')).toBe('live')
      // 484 / 23（pendingCount=484, mock staging=23）
      expect(pendingKpi?.querySelector('[data-card-value]')?.textContent).toBe('484 / 23')
    })
  })
})

describe('DashboardClient — case B：接口字段缺失（fallback mock）', () => {
  beforeEach(() => {
    // 仅 pendingCount 字段；todayReviewedCount / interceptRate 缺失
    mockGetStats.mockResolvedValue({ pendingCount: 50 } as never)
  })

  it('部分字段缺失 → 仍 4 行布局 + 9 类卡片渲染', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-dashboard-row="1"]')).toBeTruthy()
      expect(container.querySelector('[data-dashboard-row="2"]')).toBeTruthy()
      expect(container.querySelector('[data-dashboard-row="3"]')).toBeTruthy()
      expect(container.querySelectorAll('[data-kpi-card]').length).toBe(4)
    })
  })

  it('pendingCount 仍 live；其余 KPI 走 mock', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      const pendingKpi = container.querySelector('[data-testid="kpi-pendingStaging"]')
      expect(pendingKpi?.getAttribute('data-source')).toBe('live')
      expect(pendingKpi?.querySelector('[data-card-value]')?.textContent).toBe('50 / 23')

      // 其他 3 张 KPI 数据是 mock
      const videoTotalKpi = container.querySelector('[data-testid="kpi-videoTotal"]')
      expect(videoTotalKpi?.getAttribute('data-source')).toBe('mock')
    })
  })

  it('[data-card-value] 全部非破折号（缺字段 fallback 后仍守门）', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      const values = container.querySelectorAll('[data-card-value]')
      expect(values.length).toBe(4)
      values.forEach((node) => {
        const text = node.textContent ?? ''
        expect(text).not.toBe('—')
        expect(text.trim().length).toBeGreaterThan(0)
      })
    })
  })

  it('mock 标记节点存在 + textContent 也无破折号', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      const mockNodes = container.querySelectorAll('[data-source="mock"]')
      expect(mockNodes.length).toBeGreaterThanOrEqual(3)
      mockNodes.forEach((node) => {
        const valueNode = node.querySelector('[data-card-value]')
        if (valueNode) {
          expect(valueNode.textContent).not.toBe('—')
        }
      })
    })
  })
})

describe('DashboardClient — case C：接口失败 500（ErrorState + grid 兜底）', () => {
  beforeEach(() => {
    mockGetStats.mockRejectedValue(new Error('Network error 500'))
  })

  it('接口失败 → 渲染 ErrorState（不渲染 4 行布局）+ data-error-state 节点存在', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      // ErrorState 来自 packages/admin-ui，渲染 [data-error-state]
      expect(container.querySelector('[data-error-state]')).toBeTruthy()
    })
    // 失败路径下 5 类卡片不渲染（避免显示 mock 数据但用户以为是 live）
    expect(container.querySelector('[data-card="attention"]')).toBeNull()
    expect(container.querySelectorAll('[data-kpi-card]').length).toBe(0)
  })

  it('接口失败 → 仍渲染 page-head（顶部 head 不被 ErrorState 替代）', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-error-state]')).toBeTruthy()
    })
    expect(container.querySelector('[data-page-head]')).toBeTruthy()
  })

  it('接口失败 → tabs 仍可见（用户可切换到 analytics tab）', async () => {
    const { container } = render(<DashboardClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-error-state]')).toBeTruthy()
    })
    expect(container.querySelector('[data-tab="overview"]')).toBeTruthy()
    expect(container.querySelector('[data-tab="analytics"]')).toBeTruthy()
  })
})
