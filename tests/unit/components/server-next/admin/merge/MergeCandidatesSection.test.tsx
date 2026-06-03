/**
 * MergeCandidatesSection.test.tsx — CHG-VIR-9-C（拆自 MergeClient 的待审候选 Segment）
 *
 * 范围（CHG-VIR-9-D 默认翻 identity + 折叠组 candidateIds 后更新）：
 *  1. 默认 source=identity（9-D 翻转）→ listCandidates 收到 source:'identity' + minScore 控件隐藏
 *  2. toggle 切「实时聚合」→ listCandidates 收到 source:'legacy' + minScore 控件可见
 *  3. 降级回显：默认 identity 返回 source=legacy → 提示条渲染
 *  4. identity group（candidateId 存在）展开 → 「拒绝候选」按钮渲染
 *  5. 拒绝候选 → rejectIdentityCandidate 调用 + success toast + 列表刷新
 *  6. identity group「执行合并」→ mergeVideos 透传 candidateIds（confirm 语义 / D-178-3 + 9-D 数组化）
 *  7. legacy group（无 candidateId）展开 → 无拒绝按钮 + mergeVideos 不带 candidateId(s)
 *  8. 折叠组（N=3 多 pair）→ candidateIds 全锚点 + EvidencePanel 逐 pair 拒绝按钮（D-105a-18）
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
  it('1. 默认 source=identity（CHG-VIR-9-D 翻转）：listCandidates 收到 identity + minScore 控件隐藏', async () => {
    listCandidatesMock.mockResolvedValueOnce(IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    expect(listCandidatesMock).toHaveBeenCalledWith(expect.objectContaining({ source: 'identity' }))
    expect(screen.queryByText('minScore')).toBeNull()
    expect(screen.queryByTestId('merge-source-fallback-note')).toBeNull()
  })

  it('2. toggle 切「实时聚合」：listCandidates 收到 source legacy + minScore 控件可见', async () => {
    listCandidatesMock.mockResolvedValue(LEGACY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByRole('tab', { name: '实时聚合' }))
    await waitFor(() => {
      expect(listCandidatesMock).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'legacy', page: 1 }))
    })
    expect(screen.getByText('minScore')).not.toBeNull()
  })

  it('3. 降级回显：默认 identity 返回 source=legacy → 提示条渲染', async () => {
    listCandidatesMock.mockResolvedValue(LEGACY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
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

  it('6. identity group「执行合并」：mergeVideos 透传 candidateIds（confirm 语义 / 9-D 数组化）', async () => {
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
        candidateIds: ['cand-uuid-0001'],
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
    expect(mergeVideosMock.mock.calls[0][0]).not.toHaveProperty('candidateIds')
  })

  // ── CHG-VIR-9-D / D-105a-18：折叠组（N=3 连通分量）─────────────────

  const CLUSTER_GROUP = {
    groupKey: 'vid-a|vid-b|vid-c',
    titleNormalized: '復仇者聯盟',
    year: 2019,
    type: 'movie' as const,
    score: 0.7,
    recommendedTargetVideoId: 'vid-b',
    videos: [
      ...LEGACY_GROUP.videos,
      { id: 'vid-c', title: 'Avengers C', titleNormalized: '復仇者聯盟', year: 2019, type: 'movie' as const,
        createdAt: '2025-03-01T00:00:00Z', sourceCount: 2, sourceSiteKeys: ['youku'] },
    ],
    candidateIds: ['cand-uuid-0001', 'cand-uuid-0002', 'cand-uuid-0003'],
    identity: {
      identityScore: 0.85,
      strongNegativeReasons: [],
      blockingReasons: ['core_title_key_equal'],
      autoMergeBlocked: false,
      pairs: [
        { leftVideoId: 'vid-a', rightVideoId: 'vid-b', identityScore: 0.91,
          strongNegativeReasons: [], blockingReasons: ['core_title_key_equal'],
          evidence: [], autoMergeBlocked: false, candidateId: 'cand-uuid-0001' },
        { leftVideoId: 'vid-b', rightVideoId: 'vid-c', identityScore: 0.88,
          strongNegativeReasons: [], blockingReasons: ['core_title_key_equal'],
          evidence: [], autoMergeBlocked: false, candidateId: 'cand-uuid-0002' },
        { leftVideoId: 'vid-a', rightVideoId: 'vid-c', identityScore: 0.85,
          strongNegativeReasons: [], blockingReasons: ['core_title_key_equal'],
          evidence: [], autoMergeBlocked: false, candidateId: 'cand-uuid-0003' },
      ],
      scorerVersion: 'v1',
    },
  }
  const CLUSTER_RES = { data: [CLUSTER_GROUP], total: 3, page: 1, limit: 20, source: 'identity' as const }

  it('8a. 折叠组「执行合并」：mergeVideos 透传全部 K 个 candidateIds', async () => {
    listCandidatesMock.mockResolvedValue(CLUSTER_RES)
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-9d',
      targetVideo: { id: 'vid-b', title: 'Avengers B', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-02-01T00:00:00Z',
        sourceCount: 10, sourceSiteKeys: ['iqiyi'] },
    })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByRole('button', { name: /执行合并/ }))
    fireEvent.click(screen.getByRole('button', { name: /执行合并/ }))
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledWith(expect.objectContaining({
        sourceVideoIds: ['vid-a', 'vid-c'],
        targetVideoId: 'vid-b',
        candidateIds: ['cand-uuid-0001', 'cand-uuid-0002', 'cand-uuid-0003'],
      }))
    })
  })

  it('8c. 折叠组超单次 merge 上限（N=12 > 11）：执行合并禁用 + 提示渲染（Codex review FIX）', async () => {
    const manyVideos = Array.from({ length: 12 }, (_, i) => ({
      id: `vid-${i}`, title: `V${i}`, titleNormalized: '復仇者聯盟', year: 2019, type: 'movie' as const,
      createdAt: '2025-01-01T00:00:00Z', sourceCount: 1, sourceSiteKeys: ['iqiyi'],
    }))
    const bigGroup = {
      ...CLUSTER_GROUP,
      groupKey: manyVideos.map((v) => v.id).sort().join('|'),
      recommendedTargetVideoId: 'vid-0',
      videos: manyVideos,
    }
    listCandidatesMock.mockResolvedValue({ data: [bigGroup], total: 11, page: 1, limit: 20, source: 'identity' as const })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByTestId('merge-limit-note'))
    const mergeBtn = screen.getByRole('button', { name: /执行合并/ }) as HTMLButtonElement
    expect(mergeBtn.disabled).toBe(true)
    fireEvent.click(mergeBtn)
    expect(mergeVideosMock).not.toHaveBeenCalled()
  })

  it('8b. 折叠组逐 pair 拒绝：EvidencePanel 行内按钮 → rejectIdentityCandidate(对应 pair id)', async () => {
    listCandidatesMock.mockResolvedValue(CLUSTER_RES)
    rejectIdentityCandidateMock.mockResolvedValueOnce({ candidateId: 'cand-uuid-0002', status: 'rejected', decisionId: 'dec-2' })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    // 多 pair 折叠组：candidateId 单数未填 → 整行「拒绝候选」按钮不渲染
    await waitFor(() => screen.getByTestId('evidence-panel'))
    expect(screen.queryByTestId('candidate-reject')).toBeNull()
    // 展开逐对明细 → 每 pair 一个「拒绝此对」按钮
    fireEvent.click(screen.getByText(/逐对证据明细/))
    await waitFor(() => screen.getByTestId('pair-reject-cand-uuid-0002'))
    fireEvent.click(screen.getByTestId('pair-reject-cand-uuid-0002'))
    await waitFor(() => {
      expect(rejectIdentityCandidateMock).toHaveBeenCalledWith('cand-uuid-0002', '合并工作台人工拒绝')
    })
  })
})
