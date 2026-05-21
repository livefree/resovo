/**
 * TabSimilar.test.tsx — CHG-SN-8-04-VIEW W1 反例 #3 闭合
 *
 * 范围（5 用例）：
 *  1. loading state → LoadingState 渲染
 *  2. 成功召回 → 列表渲染 + 行级 score pill + 「发起合并」按钮
 *  3. 「发起合并」点击 → router.push 携带 candidate_a/b/from 三参数
 *  4. 空召回 → EmptyState「未找到类似视频」
 *  5. 网络错误 → ErrorState + 重试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listSimilarVideosMock = vi.fn()
const routerPushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => routerPushMock(...args),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock('../../../../../../apps/server-next/src/lib/moderation/api', () => ({
  listSimilarVideos: (...args: unknown[]) => listSimilarVideosMock(...args),
}))

import { TabSimilar } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/RightPane/TabSimilar'

beforeEach(() => {
  listSimilarVideosMock.mockReset()
  routerPushMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TabSimilar (CHG-SN-8-04-VIEW · ADR-137)', () => {
  it('1. loading state：初次渲染显示 LoadingState（promise pending）', () => {
    listSimilarVideosMock.mockImplementation(() => new Promise(() => {}))
    const { container } = render(<TabSimilar videoId="target-id" />)
    // LoadingState 渲染（不强制 testid，仅断言不出现错误或空 state）
    expect(container.querySelector('[data-testid="tab-similar-error"]')).toBeNull()
    expect(container.querySelector('[data-testid="tab-similar-empty"]')).toBeNull()
    expect(container.querySelector('[data-testid="tab-similar-list"]')).toBeNull()
  })

  it('2. 成功召回：渲染列表 + score pill + 发起合并按钮', async () => {
    listSimilarVideosMock.mockResolvedValueOnce([
      { id: 'v1', title: '银河护卫队 2', type: 'movie', year: 2017, country: 'US', genres: ['action'], coverUrl: null, metaScore: 85, reviewStatus: 'approved', isPublished: true, similarityScore: 78 },
      { id: 'v2', title: '复仇者联盟', type: 'movie', year: 2012, country: 'US', genres: ['action'], coverUrl: null, metaScore: 90, reviewStatus: 'approved', isPublished: true, similarityScore: 65 },
    ])
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-list'))
    expect(screen.getByTestId('tab-similar-row-v1')).not.toBeNull()
    expect(screen.getByTestId('tab-similar-row-v2')).not.toBeNull()
    expect(screen.getByText('银河护卫队 2')).not.toBeNull()
    expect(screen.getByText('78')).not.toBeNull()
    expect(screen.getByTestId('tab-similar-merge-v1')).not.toBeNull()
  })

  it('3. 「发起合并」点击 → router.push 携带 candidate_a/b/from 三参数', async () => {
    listSimilarVideosMock.mockResolvedValueOnce([
      { id: 'sim-1', title: 'X', type: 'movie', year: 2020, country: null, genres: [], coverUrl: null, metaScore: 50, reviewStatus: 'pending_review', isPublished: false, similarityScore: 40 },
    ])
    render(<TabSimilar videoId="target-uuid" />)
    await waitFor(() => screen.getByTestId('tab-similar-merge-sim-1'))
    fireEvent.click(screen.getByTestId('tab-similar-merge-sim-1'))
    expect(routerPushMock).toHaveBeenCalledWith(
      '/admin/merge?candidate_a=target-uuid&candidate_b=sim-1&from=moderation',
    )
  })

  it('4. 空召回：渲染 EmptyState「未找到类似视频」', async () => {
    listSimilarVideosMock.mockResolvedValueOnce([])
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-empty'))
    expect(screen.getByText('未找到类似视频')).not.toBeNull()
  })

  it('5. 网络错误：渲染 ErrorState（含错误标题 + message）', async () => {
    listSimilarVideosMock.mockRejectedValueOnce(new Error('network 500'))
    render(<TabSimilar videoId="target-id" />)
    const err = await waitFor(() => screen.getByTestId('tab-similar-error'))
    // 「召回失败」标题 + message 都应在容器内
    expect(err.textContent).toContain('召回失败')
    expect(err.textContent).toContain('network 500')
  })
})
