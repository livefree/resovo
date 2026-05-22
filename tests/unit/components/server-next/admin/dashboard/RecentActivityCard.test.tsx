/**
 * RecentActivityCard.test.tsx — CHG-SN-8-GAPS-DASH-ACTIVITY
 *
 * 仅覆盖 dataSource prop 视觉差异（mock 显「示例数据」chip / live 不显）。
 * 行内容渲染交由集成测试覆盖。
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RecentActivityCard } from '../../../../../../apps/server-next/src/components/admin/dashboard/RecentActivityCard'
import type { DashboardActivityItem } from '../../../../../../apps/server-next/src/lib/dashboard-data'

const SAMPLE_ITEMS: readonly DashboardActivityItem[] = [
  { id: 'a1', who: '系统', what: '采集完成 12 视频', when: '刚刚', severity: 'info' },
]

describe('RecentActivityCard · dataSource 视觉警示', () => {
  it('dataSource="mock" → 头部渲染「示例数据」chip', () => {
    const { container } = render(<RecentActivityCard items={SAMPLE_ITEMS} dataSource="mock" />)
    const chip = container.querySelector('[data-mock-chip="activities"]')
    expect(chip).not.toBeNull()
    expect(chip?.textContent).toBe('示例数据')
  })

  it('dataSource="live" → 不渲染 chip', () => {
    const { container } = render(<RecentActivityCard items={SAMPLE_ITEMS} dataSource="live" />)
    expect(container.querySelector('[data-mock-chip="activities"]')).toBeNull()
  })

  it('dataSource 缺省 → 默认 live → 不渲染 chip', () => {
    const { container } = render(<RecentActivityCard items={SAMPLE_ITEMS} />)
    expect(container.querySelector('[data-mock-chip="activities"]')).toBeNull()
  })
})
