/**
 * LoginSessionsTab.test.tsx — 登录会话 Tab 单元测试（CHG-SN-7-REDO-03-B）
 *
 * 占位 Tab 覆盖：
 *   1. 渲染不崩溃 + testid 存在
 *   2. 登录会话标题可见
 *   3. 三个计划字段组全部渲染
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoginSessionsTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/LoginSessionsTab'

describe('LoginSessionsTab', () => {
  it('1. 渲染不崩溃 + testid', () => {
    render(<LoginSessionsTab />)
    expect(screen.getByTestId('login-sessions-tab')).not.toBeNull()
    expect(screen.getByTestId('login-sessions-card')).not.toBeNull()
  })

  it('2. 登录会话标题可见', () => {
    const { container } = render(<LoginSessionsTab />)
    expect(container.textContent).toContain('登录会话')
  })

  it('3. 三个计划字段组全部渲染', () => {
    const { container } = render(<LoginSessionsTab />)
    expect(container.textContent).toContain('会话超时')
    expect(container.textContent).toContain('活跃会话')
    expect(container.textContent).toContain('多设备策略')
  })
})
