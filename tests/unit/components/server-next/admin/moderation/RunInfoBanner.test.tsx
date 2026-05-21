/**
 * RunInfoBanner.test.tsx — CHG-SN-8-03 W1 金票 ② 软深链 banner
 *
 * 范围（4 用例）：
 *  - 渲染 runId 短 ID
 *  - 渲染软深链说明文案
 *  - 「清除筛选」按钮点击触发 onDismiss
 *  - data-testid 完整可被父组件 query
 */

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { RunInfoBanner } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/RunInfoBanner'

describe('RunInfoBanner (CHG-SN-8-03)', () => {
  it('1. 渲染 runId 短 ID（前 8 位）', () => {
    render(<RunInfoBanner runId="run-abcdef1234567890" onDismiss={() => {}} />)
    expect(screen.getByText(/run-abcd/)).not.toBeNull()
  })

  it('2. 渲染软深链说明文案', () => {
    render(<RunInfoBanner runId="run-xxx" onDismiss={() => {}} />)
    expect(
      screen.getByText(/新增视频按创建时间排在队列顶部/),
    ).not.toBeNull()
  })

  it('3. 「清除筛选」按钮点击 → 触发 onDismiss', () => {
    const dismissSpy = vi.fn()
    render(<RunInfoBanner runId="run-xxx" onDismiss={dismissSpy} />)
    const btn = screen.getByTestId('moderation-run-info-clear')
    fireEvent.click(btn)
    expect(dismissSpy).toHaveBeenCalledTimes(1)
  })

  it('4. data-testid 完整：banner + clear button', () => {
    render(<RunInfoBanner runId="run-xxx" onDismiss={() => {}} />)
    expect(screen.getByTestId('moderation-run-info-banner')).not.toBeNull()
    expect(screen.getByTestId('moderation-run-info-clear')).not.toBeNull()
  })
})
