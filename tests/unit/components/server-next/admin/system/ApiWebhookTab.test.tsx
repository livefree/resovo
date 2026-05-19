/**
 * ApiWebhookTab.test.tsx — API·Webhook Tab 单元测试（CHG-SN-7-REDO-03-B）
 *
 * 占位 Tab 覆盖：
 *   1. 渲染不崩溃 + testid 存在
 *   2. API Key 标题可见
 *   3. 三个计划字段组全部渲染
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApiWebhookTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/ApiWebhookTab'

describe('ApiWebhookTab', () => {
  it('1. 渲染不崩溃 + testid', () => {
    render(<ApiWebhookTab />)
    expect(screen.getByTestId('api-webhook-tab')).not.toBeNull()
    expect(screen.getByTestId('api-webhook-card-keys')).not.toBeNull()
  })

  it('2. API Key 标题可见', () => {
    const { container } = render(<ApiWebhookTab />)
    expect(container.textContent).toContain('API Key')
  })

  it('3. 三个计划字段组全部渲染', () => {
    const { container } = render(<ApiWebhookTab />)
    expect(container.textContent).toContain('API Key 管理')
    expect(container.textContent).toContain('Webhook 端点')
    expect(container.textContent).toContain('事件订阅')
  })
})
