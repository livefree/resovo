/**
 * TabSimilar.test.tsx — CHG-SN-8-04-VIEW W1 反例 #3 闭合 + CHG-VIR-9-C identity 消费
 *
 * 范围（10 用例）：
 *  1. loading state → LoadingState 渲染
 *  2. 成功召回（legacy）→ 列表渲染 + 行级 score pill + 「发起合并」按钮
 *  3. 「发起合并」点击（legacy 行）→ router.push 携带 candidate_a/b/from 三参数（无 candidate_id）
 *  4. 空召回 → EmptyState「未找到类似视频」
 *  5. 网络错误 → ErrorState + 重试
 *  6. identity 行 → 相似度 pill + 拦截原因 chips + 拒绝按钮
 *  7. identity 行「发起合并」→ 深链追加 candidate_id
 *  8. 拒绝 → rejectIdentityCandidate 调用 + 行本地移除 + success toast
 *  9. 降级回显：请求 identity 返回 legacy → 提示条渲染
 * 10. source toggle 切 legacy → listSimilarVideos 收到 source:'legacy'
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listSimilarVideosMock = vi.fn()
const rejectIdentityCandidateMock = vi.fn()
const routerPushMock = vi.fn()
const toastPushMock = vi.fn()

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

vi.mock('../../../../../../apps/server-next/src/lib/identity/api', () => ({
  rejectIdentityCandidate: (...args: unknown[]) => rejectIdentityCandidateMock(...args),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'test-toast-id' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

import { TabSimilar } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/RightPane/TabSimilar'

// ── fixtures ──────────────────────────────────────────────────────

const LEGACY_ITEMS = [
  { id: 'v1', title: '银河护卫队 2', type: 'movie', year: 2017, country: 'US', genres: ['action'], coverUrl: null, metaScore: 85, reviewStatus: 'approved', isPublished: true, similarityScore: 78 },
  { id: 'v2', title: '复仇者联盟', type: 'movie', year: 2012, country: 'US', genres: ['action'], coverUrl: null, metaScore: 90, reviewStatus: 'approved', isPublished: true, similarityScore: 65 },
]

const IDENTITY_ITEM = {
  id: 'v9', title: '某动画 第二季', type: 'anime', year: 2024, country: 'JP', genres: ['anime'],
  coverUrl: null, metaScore: 70, reviewStatus: 'approved', isPublished: true,
  similarityScore: 87,
  candidateId: 'cand-uuid-0001',
  identityScore: 0.87,
  strongNegativeReasons: ['season_mismatch'],
  status: 'pending' as const,
}

beforeEach(() => {
  listSimilarVideosMock.mockReset()
  rejectIdentityCandidateMock.mockReset()
  routerPushMock.mockReset()
  toastPushMock.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('TabSimilar (CHG-SN-8-04-VIEW · ADR-137 / CHG-VIR-9-C identity)', () => {
  it('1. loading state：初次渲染显示 LoadingState（promise pending）', () => {
    listSimilarVideosMock.mockImplementation(() => new Promise(() => {}))
    const { container } = render(<TabSimilar videoId="target-id" />)
    // LoadingState 渲染（不强制 testid，仅断言不出现错误或空 state）
    expect(container.querySelector('[data-testid="tab-similar-error"]')).toBeNull()
    expect(container.querySelector('[data-testid="tab-similar-empty"]')).toBeNull()
    expect(container.querySelector('[data-testid="tab-similar-list"]')).toBeNull()
  })

  it('2. 成功召回（legacy 来源）：渲染列表 + score pill + 发起合并按钮', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({ items: LEGACY_ITEMS, source: 'legacy' })
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-list'))
    expect(screen.getByTestId('tab-similar-row-v1')).not.toBeNull()
    expect(screen.getByTestId('tab-similar-row-v2')).not.toBeNull()
    expect(screen.getByText('银河护卫队 2')).not.toBeNull()
    expect(screen.getByText('78')).not.toBeNull()
    expect(screen.getByTestId('tab-similar-merge-v1')).not.toBeNull()
    // legacy 行无 candidateId → 无拒绝按钮
    expect(screen.queryByTestId('tab-similar-reject-v1')).toBeNull()
  })

  it('3. 「发起合并」点击（legacy 行）→ router.push 携带 candidate_a/b/from（无 candidate_id）', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({
      // MODUX-P3-3：score≥默认阈值 60（确保行直显，merge 深链为本用例测点）
      items: [{ id: 'sim-1', title: 'X', type: 'movie', year: 2020, country: null, genres: [], coverUrl: null, metaScore: 50, reviewStatus: 'pending_review', isPublished: false, similarityScore: 78 }],
      source: 'legacy',
    })
    render(<TabSimilar videoId="target-uuid" />)
    await waitFor(() => screen.getByTestId('tab-similar-merge-sim-1'))
    fireEvent.click(screen.getByTestId('tab-similar-merge-sim-1'))
    expect(routerPushMock).toHaveBeenCalledWith(
      '/admin/merge?candidate_a=target-uuid&candidate_b=sim-1&from=moderation',
    )
  })

  it('4. 空召回：渲染 EmptyState「未找到类似视频」', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({ items: [], source: 'legacy' })
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

  // ── CHG-VIR-9-C：identity 来源消费 ────────────────────────────────

  it('6. identity 行：相似度 pill + 拦截原因 chips + 拒绝按钮', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({ items: [IDENTITY_ITEM], source: 'identity' })
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-list'))
    expect(screen.getByText('相似度 87%')).not.toBeNull()
    const veto = screen.getByTestId('tab-similar-veto-v9')
    expect(veto.textContent).toContain('季号不一致')
    expect(screen.getByTestId('tab-similar-reject-v9')).not.toBeNull()
  })

  it('7. identity 行「发起合并」→ 深链追加 candidate_id', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({ items: [IDENTITY_ITEM], source: 'identity' })
    render(<TabSimilar videoId="target-uuid" />)
    await waitFor(() => screen.getByTestId('tab-similar-merge-v9'))
    fireEvent.click(screen.getByTestId('tab-similar-merge-v9'))
    expect(routerPushMock).toHaveBeenCalledWith(
      '/admin/merge?candidate_a=target-uuid&candidate_b=v9&from=moderation&candidate_id=cand-uuid-0001',
    )
  })

  it('8. 拒绝：rejectIdentityCandidate 调用 + 行本地移除 + success toast', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({ items: [IDENTITY_ITEM], source: 'identity' })
    rejectIdentityCandidateMock.mockResolvedValueOnce({ candidateId: 'cand-uuid-0001', status: 'rejected', decisionId: 'dec-1' })
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-reject-v9'))
    fireEvent.click(screen.getByTestId('tab-similar-reject-v9'))
    await waitFor(() => {
      expect(rejectIdentityCandidateMock).toHaveBeenCalledWith('cand-uuid-0001', '审核台类似 Tab 人工拒绝')
    })
    // 行本地移除 → 列表为空 → EmptyState
    await waitFor(() => {
      expect(screen.queryByTestId('tab-similar-row-v9')).toBeNull()
    })
    expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'success', title: '已拒绝候选' }))
  })

  it('9. 降级回显：请求 identity 返回 legacy → 提示条渲染', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({ items: LEGACY_ITEMS, source: 'legacy' })
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-list'))
    // 默认请求 source=identity；服务端回显 legacy → 降级提示
    expect(listSimilarVideosMock).toHaveBeenCalledWith('target-id', expect.objectContaining({ source: 'identity' }))
    expect(screen.getByTestId('tab-similar-fallback-note')).not.toBeNull()
  })

  it('10. source toggle 切「实时算法」→ listSimilarVideos 收到 source=legacy（无降级提示）', async () => {
    listSimilarVideosMock.mockResolvedValue({ items: LEGACY_ITEMS, source: 'legacy' })
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-list'))
    fireEvent.click(screen.getByRole('tab', { name: '实时算法' }))
    await waitFor(() => {
      expect(listSimilarVideosMock).toHaveBeenLastCalledWith('target-id', expect.objectContaining({ source: 'legacy' }))
    })
    // 请求与回显一致 → 无降级提示
    expect(screen.queryByTestId('tab-similar-fallback-note')).toBeNull()
  })

  // ── MODUX-P3-3：相关度阈值折叠 + 合并为主操作 ────────────────────────

  const MIXED_ITEMS = [
    { id: 'hi', title: '高相关片', type: 'movie', year: 2020, country: 'US', genres: ['action'], coverUrl: null, metaScore: 80, reviewStatus: 'approved', isPublished: true, similarityScore: 78 },
    { id: 'lo', title: '低相关片', type: 'movie', year: 1999, country: null, genres: [], coverUrl: null, metaScore: 40, reviewStatus: 'pending_review', isPublished: false, similarityScore: 50 },
  ]

  it('11. 默认阈值 60：低相关行折叠（不直显）+ 展开器；点击展开后可见', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({ items: MIXED_ITEMS, source: 'legacy' })
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-list'))
    // 高相关（78≥60）直显；低相关（50<60）折叠
    expect(screen.getByTestId('tab-similar-row-hi')).not.toBeNull()
    expect(screen.queryByTestId('tab-similar-row-lo')).toBeNull()
    const toggle = screen.getByTestId('tab-similar-low-toggle')
    expect(toggle.textContent).toContain('显示 1 条低相关候选')
    // 展开 → 低相关行可见
    fireEvent.click(toggle)
    expect(screen.getByTestId('tab-similar-row-lo')).not.toBeNull()
  })

  it('12. 阈值切「全部」→ 低相关行直显、无折叠展开器', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({ items: MIXED_ITEMS, source: 'legacy' })
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-list'))
    expect(screen.queryByTestId('tab-similar-row-lo')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '全部' }))
    // 阈值 0 → 全部直显，无展开器
    expect(screen.getByTestId('tab-similar-row-lo')).not.toBeNull()
    expect(screen.queryByTestId('tab-similar-low-toggle')).toBeNull()
  })

  it('13. 「发起合并」为主操作（AdminButton data-variant=primary）', async () => {
    listSimilarVideosMock.mockResolvedValueOnce({ items: [MIXED_ITEMS[0]], source: 'legacy' })
    render(<TabSimilar videoId="target-id" />)
    await waitFor(() => screen.getByTestId('tab-similar-merge-hi'))
    // AdminButton 用 inline style + data-variant（非 className）表达 variant
    expect(screen.getByTestId('tab-similar-merge-hi').getAttribute('data-variant')).toBe('primary')
  })
})
