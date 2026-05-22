/**
 * SourcesReplaceTip.test.tsx — CHG-SN-8-FUP-SOURCES-DEAD-BTN
 *
 * 范围（2 用例）：
 *  1. 按钮点击 → 「一键替换」提示 Modal 渲染
 *  2. 点击「我知道了」→ Modal 关闭
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  listVideoGroups: vi.fn(() => new Promise(() => {})),
  getVideoGroupStats: vi.fn(() => new Promise(() => {})),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/sources',
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: vi.fn(() => 'tid'), dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { SourcesClient } from '../../../../../../apps/server-next/src/app/admin/sources/_client/SourcesClient'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('SourcesClient · 一键替换最相似 URL 提示 Modal (CHG-SN-8-FUP-SOURCES-DEAD-BTN)', () => {
  it('1. 按钮点击 → 提示 Modal 渲染', async () => {
    render(<SourcesClient />)
    const btn = await waitFor(() => screen.getByTestId('sources-replace-similar-btn'))
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('一键替换最相似 URL')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByTestId('sources-replace-tip-modal')).not.toBeNull()
    })
    expect(screen.getByText(/筹备中/)).not.toBeNull()
    expect(screen.getByText(/当前替代路径/)).not.toBeNull()
  })

  it('2. 点击「我知道了」→ Modal 关闭', async () => {
    render(<SourcesClient />)
    const btn = await waitFor(() => screen.getByTestId('sources-replace-similar-btn'))
    fireEvent.click(btn)
    const dismissBtn = await waitFor(() => screen.getByTestId('sources-replace-tip-dismiss'))
    fireEvent.click(dismissBtn)
    await waitFor(() => {
      expect(screen.queryByTestId('sources-replace-tip-modal')).toBeNull()
    })
  })
})
