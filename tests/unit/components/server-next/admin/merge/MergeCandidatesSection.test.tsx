/**
 * MergeCandidatesSection.test.tsx — CHG-VIR-9-C（拆自 MergeClient 的待审候选 Segment）
 *
 * 范围（7 用例）：
 *  1. 默认 source=legacy → listCandidates 收到 source:'legacy' + minScore 控件可见
 *  2. toggle 切「多证据」→ listCandidates 收到 source:'identity' + minScore 控件隐藏
 *  3. 降级回显：请求 identity 返回 source=legacy → 提示条渲染
 *  4. identity group（candidateId 存在）展开 → 「拒绝候选」按钮渲染
 *  5. 拒绝候选 → rejectIdentityCandidate 调用 + success toast + 列表刷新
 *  6. identity group「执行合并」→ mergeVideos 透传 candidateId（confirm 语义 / D-178-3）
 *  7. legacy group（无 candidateId）展开 → 无拒绝按钮 + mergeVideos 不带 candidateId
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listCandidatesMock = vi.fn()
const mergeVideosMock = vi.fn()
const unmergeVideosMock = vi.fn()
const rejectIdentityCandidateMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../../../../../../apps/server-next/src/lib/merge/api', () => ({
  listCandidates: (...args: unknown[]) => listCandidatesMock(...args),
  mergeVideos: (...args: unknown[]) => mergeVideosMock(...args),
  unmergeVideos: (...args: unknown[]) => unmergeVideosMock(...args),
  splitVideo: vi.fn(),
  listAudit: vi.fn(),
}))

vi.mock('../../../../../../apps/server-next/src/lib/identity/api', () => ({
  rejectIdentityCandidate: (...args: unknown[]) => rejectIdentityCandidateMock(...args),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'tid' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

// mock api-client（identity/api 经 @ alias 引用；保留 ApiClientError 供 describeError instanceof）
vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => {
  class MockApiClientError extends Error {
    public readonly code: string
    public readonly status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.code = code
      this.status = status
      this.name = 'ApiClientError'
    }
  }
  return {
    ApiClientError: MockApiClientError,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  }
})

import { CandidatesSection } from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeCandidatesSection'

// ── fixtures ──────────────────────────────────────────────────────

const LEGACY_GROUP = {
  groupKey: '復仇者聯盟|2019|movie',
  titleNormalized: '復仇者聯盟',
  year: 2019,
  type: 'movie' as const,
  score: 0.85,
  recommendedTargetVideoId: 'vid-b',
  videos: [
    { id: 'vid-a', title: 'Avengers A', titleNormalized: '復仇者聯盟', year: 2019, type: 'movie' as const,
      createdAt: '2025-01-01T00:00:00Z', sourceCount: 3, sourceSiteKeys: ['iqiyi', 'youku'] },
    { id: 'vid-b', title: 'Avengers B', titleNormalized: '復仇者聯盟', year: 2019, type: 'movie' as const,
      createdAt: '2025-02-01T00:00:00Z', sourceCount: 5, sourceSiteKeys: ['iqiyi', 'bilibili'] },
  ],
}

const IDENTITY_GROUP = {
  ...LEGACY_GROUP,
  groupKey: 'vid-a|vid-b',
  candidateId: 'cand-uuid-0001',
  identity: {
    identityScore: 0.91,
    strongNegativeReasons: [],
    blockingReasons: ['core_title_key_equal'],
    autoMergeBlocked: false,
    pairs: [{
      leftVideoId: 'vid-a', rightVideoId: 'vid-b', identityScore: 0.91,
      strongNegativeReasons: [], blockingReasons: ['core_title_key_equal'],
      evidence: [], autoMergeBlocked: false,
    }],
    scorerVersion: 'v1',
  },
}

const LEGACY_RES = { data: [LEGACY_GROUP], total: 1, page: 1, limit: 20, source: 'legacy' as const }
const IDENTITY_RES = { data: [IDENTITY_GROUP], total: 1, page: 1, limit: 20, source: 'identity' as const }

beforeEach(() => {
  listCandidatesMock.mockReset()
  mergeVideosMock.mockReset()
  unmergeVideosMock.mockReset()
  rejectIdentityCandidateMock.mockReset()
  toastPushMock.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('MergeCandidatesSection (CHG-VIR-9-C)', () => {
  it('1. 默认 source=legacy：listCandidates 收到 source legacy + minScore 控件可见', async () => {
    listCandidatesMock.mockResolvedValueOnce(LEGACY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    expect(listCandidatesMock).toHaveBeenCalledWith(expect.objectContaining({ source: 'legacy' }))
    expect(screen.getByText('minScore')).not.toBeNull()
    expect(screen.queryByTestId('merge-source-fallback-note')).toBeNull()
  })

  it('2. toggle 切「多证据」：listCandidates 收到 source identity + minScore 控件隐藏', async () => {
    listCandidatesMock.mockResolvedValue(IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByRole('tab', { name: '多证据' }))
    await waitFor(() => {
      expect(listCandidatesMock).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'identity', page: 1 }))
    })
    expect(screen.queryByText('minScore')).toBeNull()
  })

  it('3. 降级回显：请求 identity 返回 source=legacy → 提示条渲染', async () => {
    listCandidatesMock.mockResolvedValue(LEGACY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByRole('tab', { name: '多证据' }))
    await waitFor(() => {
      expect(screen.getByTestId('merge-source-fallback-note')).not.toBeNull()
    })
  })

  it('4. identity group 展开：「拒绝候选」按钮 + 身份分 pill 渲染', async () => {
    listCandidatesMock.mockResolvedValueOnce(IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => {
      expect(screen.getByTestId('candidate-reject')).not.toBeNull()
      expect(screen.getByTestId('identity-pill').textContent).toContain('91.0%')
    })
  })

  it('5. 拒绝候选：rejectIdentityCandidate 调用 + success toast + 列表刷新', async () => {
    listCandidatesMock.mockResolvedValue(IDENTITY_RES)
    rejectIdentityCandidateMock.mockResolvedValueOnce({ candidateId: 'cand-uuid-0001', status: 'rejected', decisionId: 'dec-1' })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByTestId('candidate-reject'))
    const callsBefore = listCandidatesMock.mock.calls.length
    fireEvent.click(screen.getByTestId('candidate-reject'))
    await waitFor(() => {
      expect(rejectIdentityCandidateMock).toHaveBeenCalledWith('cand-uuid-0001', '合并工作台人工拒绝')
    })
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'success', title: '已拒绝候选' }))
      expect(listCandidatesMock.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('6. identity group「执行合并」：mergeVideos 透传 candidateId（confirm 语义）', async () => {
    listCandidatesMock.mockResolvedValue(IDENTITY_RES)
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-9c',
      targetVideo: { id: 'vid-b', title: 'Avengers B', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-02-01T00:00:00Z',
        sourceCount: 8, sourceSiteKeys: ['iqiyi'] },
    })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByRole('button', { name: /执行合并/ }))
    fireEvent.click(screen.getByRole('button', { name: /执行合并/ }))
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledWith(expect.objectContaining({
        sourceVideoIds: ['vid-a'],
        targetVideoId: 'vid-b',
        candidateId: 'cand-uuid-0001',
      }))
    })
  })

  it('7. legacy group：无拒绝按钮 + mergeVideos 不带 candidateId', async () => {
    listCandidatesMock.mockResolvedValue(LEGACY_RES)
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-legacy',
      targetVideo: { id: 'vid-b', title: 'Avengers B', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-02-01T00:00:00Z',
        sourceCount: 8, sourceSiteKeys: ['iqiyi'] },
    })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByRole('button', { name: /执行合并/ }))
    expect(screen.queryByTestId('candidate-reject')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /执行合并/ }))
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledTimes(1)
    })
    expect(mergeVideosMock.mock.calls[0][0]).not.toHaveProperty('candidateId')
  })
})
