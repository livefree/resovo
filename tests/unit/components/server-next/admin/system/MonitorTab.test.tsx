/**
 * MonitorTab.test.tsx — SettingsContainer MonitorTab 单元测试（CHG-SN-6-03）
 *
 * 覆盖（≥ 9 用例硬清单，quality-gates §7 第 1 项）：
 *   1. 渲染基础：data-testid + grid
 *   2. 全局 enabled 标识 ON
 *   3. 全局 enabled 标识 OFF
 *   4. 4 scheduler 卡片渲染（chinese label 映射）
 *   5. scheduler enabled 状态 badge（运行中/已停止）
 *   6. intervalMs 人话格式化（s / m / h）
 *   7. Loading state（初始 skeleton）
 *   8. Error state + retry 按钮
 *   9. refresh 按钮触发重新加载
 *   10. 未知 scheduler name 兜底为原 name（label 映射缺失）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getSchedulerStatusMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/system/api', () => ({
  getSchedulerStatus: (...args: unknown[]) => getSchedulerStatusMock(...args),
}))

import { MonitorTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/MonitorTab'

const STATUS_ALL_ON = {
  enabled: true,
  schedulers: [
    { name: 'auto-publish-staging',     enabled: true,  intervalMs: 5000 },
    { name: 'verify-published-sources', enabled: true,  intervalMs: 60000 },
    { name: 'verify-staging-sources',   enabled: true,  intervalMs: 60000 },
    { name: 'reconcile-search-index',   enabled: true,  intervalMs: 3600000 },
  ],
}

const STATUS_GLOBAL_OFF = {
  enabled: false,
  schedulers: [
    { name: 'auto-publish-staging',     enabled: false, intervalMs: 5000 },
    { name: 'verify-published-sources', enabled: false, intervalMs: 60000 },
    { name: 'verify-staging-sources',   enabled: false, intervalMs: 60000 },
    { name: 'reconcile-search-index',   enabled: false, intervalMs: 3600000 },
  ],
}

const STATUS_UNKNOWN_NAME = {
  enabled: true,
  schedulers: [
    { name: 'future-experimental-scheduler', enabled: true, intervalMs: 30000 },
  ],
}

beforeEach(() => {
  getSchedulerStatusMock.mockReset()
})

describe('MonitorTab', () => {
  it('1. 渲染基础：scheduler grid + 4 卡片', async () => {
    getSchedulerStatusMock.mockResolvedValueOnce(STATUS_ALL_ON)
    render(<MonitorTab />)
    await waitFor(() => {
      expect(screen.getByTestId('monitor-tab')).not.toBeNull()
      expect(screen.getByTestId('monitor-scheduler-grid')).not.toBeNull()
    })
  })

  it('2. 全局 enabled=true 显示"全局调度：已启用"', async () => {
    getSchedulerStatusMock.mockResolvedValueOnce(STATUS_ALL_ON)
    render(<MonitorTab />)
    await waitFor(() => {
      const badge = screen.getByTestId('monitor-global-status')
      expect(badge.dataset.monitorEnabled).toBe('true')
      expect(badge.textContent).toContain('已启用')
    })
  })

  it('3. 全局 enabled=false 显示"全局调度：已禁用"', async () => {
    getSchedulerStatusMock.mockResolvedValueOnce(STATUS_GLOBAL_OFF)
    render(<MonitorTab />)
    await waitFor(() => {
      const badge = screen.getByTestId('monitor-global-status')
      expect(badge.dataset.monitorEnabled).toBe('false')
      expect(badge.textContent).toContain('已禁用')
    })
  })

  it('4. 4 scheduler 卡片中文 label 映射全部命中', async () => {
    getSchedulerStatusMock.mockResolvedValueOnce(STATUS_ALL_ON)
    render(<MonitorTab />)
    await waitFor(() => {
      expect(screen.getByText('Staging 自动发布')).not.toBeNull()
      expect(screen.getByText('Published 源验证')).not.toBeNull()
      expect(screen.getByText('Staging 源验证')).not.toBeNull()
      expect(screen.getByText('搜索索引重建')).not.toBeNull()
    })
  })

  it('5. scheduler enabled badge：全部"运行中"', async () => {
    getSchedulerStatusMock.mockResolvedValueOnce(STATUS_ALL_ON)
    render(<MonitorTab />)
    await waitFor(() => {
      const runningBadges = screen.getAllByText(/运行中/)
      expect(runningBadges.length).toBe(4)
    })
  })

  it('6. scheduler enabled=false → "已停止" badge', async () => {
    getSchedulerStatusMock.mockResolvedValueOnce(STATUS_GLOBAL_OFF)
    render(<MonitorTab />)
    await waitFor(() => {
      const stoppedBadges = screen.getAllByText(/已停止/)
      expect(stoppedBadges.length).toBe(4)
    })
  })

  it('7. intervalMs 格式化：5000ms → 5s / 60000 → 1m / 3600000 → 1.0h', async () => {
    getSchedulerStatusMock.mockResolvedValueOnce(STATUS_ALL_ON)
    render(<MonitorTab />)
    await waitFor(() => {
      expect(screen.getByText(/调度间隔：5s/)).not.toBeNull()
      expect(screen.getAllByText(/调度间隔：1m/).length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText(/调度间隔：1\.0h/)).not.toBeNull()
    })
  })

  it('8. Loading state（pending fetch）', async () => {
    getSchedulerStatusMock.mockReturnValueOnce(new Promise(() => {})) // pending
    const { container } = render(<MonitorTab />)
    expect(container.querySelector('[data-testid="monitor-tab"]')).not.toBeNull()
    // loading skeleton 渲染（admin-ui LoadingState；非 grid）
    expect(container.querySelector('[data-testid="monitor-scheduler-grid"]')).toBeNull()
  })

  it('9. Error state：fetch 失败 → ErrorState 显示', async () => {
    getSchedulerStatusMock.mockRejectedValueOnce(new Error('scheduler 500'))
    render(<MonitorTab />)
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('10. refresh 按钮触发重新加载', async () => {
    getSchedulerStatusMock.mockResolvedValue(STATUS_ALL_ON)
    render(<MonitorTab />)
    await waitFor(() => screen.getByTestId('monitor-refresh'))
    const initialCalls = getSchedulerStatusMock.mock.calls.length
    fireEvent.click(screen.getByTestId('monitor-refresh'))
    await waitFor(() => {
      expect(getSchedulerStatusMock.mock.calls.length).toBeGreaterThan(initialCalls)
    })
  })

  it('11. 未知 scheduler name 兜底为原 name（label 映射缺失）', async () => {
    getSchedulerStatusMock.mockResolvedValueOnce(STATUS_UNKNOWN_NAME)
    render(<MonitorTab />)
    await waitFor(() => {
      // 未知 name 直接显示（label 缺失走 name 兜底；同时 name 也在 meta 行显示，故 ≥ 1 匹配）
      expect(screen.getAllByText('future-experimental-scheduler').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('12. data-scheduler-enabled attribute 反查（e2e / playwright 选择器友好）', async () => {
    getSchedulerStatusMock.mockResolvedValueOnce(STATUS_ALL_ON)
    const { container } = render(<MonitorTab />)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-scheduler-enabled="true"]').length).toBe(4)
      expect(container.querySelectorAll('[data-scheduler-enabled="false"]').length).toBe(0)
    })
  })
})
