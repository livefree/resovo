/**
 * SourcesReplaceTip.test.tsx — SourcesClient 顶栏 action 行为
 *
 * 历史：原覆盖「一键替换最相似 URL」按钮 + 筹备中提示 Modal（CHG-SN-8-FUP-SOURCES-DEAD-BTN）。
 * CHG-SN-9-LINES-VIEW-UNIFY（Wave 3 验收 / 2026-05-28）已移除该占位按钮 + Modal，
 * 替换为「线路别名管理」链接（testid=sources-line-aliases-link）→ router.push('/admin/source-line-aliases')。
 * 本文件随之更新为覆盖新的顶栏 action（旧 testid sources-replace-* 已不存在）。
 *
 * 范围（2 用例）：
 *  1. 顶栏渲染「线路别名管理」链接（不依赖数据加载 / PageHeader action 无条件渲染）
 *  2. 点击 → router.push('/admin/source-line-aliases')
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  listVideoGroups: vi.fn(() => new Promise(() => {})),
  getVideoGroupStats: vi.fn(() => new Promise(() => {})),
  // HOTFIX-PATCH-2B（2026-05-25）：distinct 端点 fetcher mock
  fetchDistinct: vi.fn().mockResolvedValue([]),
}))

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
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

describe('SourcesClient · 顶栏「线路别名管理」action (CHG-SN-9-LINES-VIEW-UNIFY)', () => {
  it('1. 顶栏渲染「线路别名管理」链接', async () => {
    render(<SourcesClient />)
    const btn = await waitFor(() => screen.getByTestId('sources-line-aliases-link'))
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('线路别名管理')
  })

  it('2. 点击 → router.push("/admin/source-line-aliases")', async () => {
    render(<SourcesClient />)
    const btn = await waitFor(() => screen.getByTestId('sources-line-aliases-link'))
    fireEvent.click(btn)
    expect(pushMock).toHaveBeenCalledWith('/admin/source-line-aliases')
  })
})
