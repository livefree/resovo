/**
 * NotificationsTab.test.tsx — 通知设置 Tab 单元测试（CHG-SN-7-REDO-03-B）
 *
 * 占位 Tab 覆盖：
 *   1. 渲染不崩溃 + testid 存在
 *   2. 渠道 advisory 文字可见
 *   3. 三个计划字段组全部渲染
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationsTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/NotificationsTab'

describe('NotificationsTab', () => {
  it('1. 渲染不崩溃 + testid', () => {
    render(<NotificationsTab />)
    expect(screen.getByTestId('notifications-tab')).not.toBeNull()
    expect(screen.getByTestId('notifications-card-channels')).not.toBeNull()
  })

  it('2. 通知渠道 advisory 字段可见', () => {
    const { container } = render(<NotificationsTab />)
    expect(container.textContent).toContain('通知渠道')
    expect(container.textContent).toContain('Webhook')
  })

  it('3. 三个计划字段组全部渲染', () => {
    const { container } = render(<NotificationsTab />)
    expect(container.textContent).toContain('通知渠道')
    expect(container.textContent).toContain('触发事件')
    expect(container.textContent).toContain('通知频率')
  })
})
