/**
 * ApiWebhookTab.test.tsx — API·Webhook Tab 单元测试（CHG-SN-7-REDO-03-C）
 *
 * 覆盖：
 *   1. 渲染不崩溃 + testid
 *   2. 两个 card 存在（webhook + keys）
 *   3. API Key 管理 advisory 文字
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApiWebhookTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/ApiWebhookTab'

describe('ApiWebhookTab', () => {
  it('1. 渲染不崩溃 + testid', () => {
    render(<ApiWebhookTab />)
    expect(screen.getByTestId('api-webhook-tab')).not.toBeNull()
  })

  it('2. 两个 card 存在（webhook + keys）', () => {
    render(<ApiWebhookTab />)
    expect(screen.getByTestId('api-webhook-card-webhook')).not.toBeNull()
    expect(screen.getByTestId('api-webhook-card-keys')).not.toBeNull()
  })

  it('3. API Key advisory 文字含 ADR-127', () => {
    const { container } = render(<ApiWebhookTab />)
    expect(container.textContent).toContain('ADR-127')
    expect(container.textContent).toContain('API Key 管理')
  })
})
