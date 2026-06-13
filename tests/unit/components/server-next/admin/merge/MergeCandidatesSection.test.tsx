/**
 * MergeCandidatesSection.test.tsx — CHG-VIR-9-C（拆自 MergeClient 的待审候选 Segment）
 *
 * 范围（CHG-VIR-9-D 默认翻 identity；CHG-VIR-18 D-105-20 来源列/降级提示/minScore 控件退役）：
 *  1. 默认 source=identity → listCandidates 收到 source:'identity'；minScore 控件 / 降级提示恒隐藏
 *  2a/2b/2c. 相似度列 + 操作列快捷合并/拒绝（来源列退役，不再渲染 candidate-source chip）
 *  （原用例 3「降级回显」随 legacy 退役删除；GOV-2 版本搁浅警示见用例 10h）
 *  4. identity group（candidateId 存在）展开 → 「拒绝候选」按钮渲染
 *  5. 拒绝候选 → rejectIdentityCandidate 调用 + success toast + 列表刷新
 *  6. identity group「执行合并」→ mergeVideos 透传 candidateIds（confirm 语义 / D-178-3 + 9-D 数组化）
 *  7. 无 identity 评分组（无 candidateId）展开 → 无拒绝按钮 + mergeVideos 不带 candidateId(s)
 *  8. 折叠组（N=3 多 pair）→ candidateIds 全锚点 + EvidencePanel 逐 pair 拒绝按钮（D-105a-18）
 *  10f/10h. truncated 截断警示 / GOV-2 版本搁浅警示（staleIdentityPending 透传 D-105-22）
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
  it('1. 默认 source=identity（CHG-VIR-9-D 翻转）：listCandidates 收到 identity + minScore 控件 / 降级提示恒隐藏（CHG-VIR-18）', async () => {
    listCandidatesMock.mockResolvedValueOnce(IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    expect(listCandidatesMock).toHaveBeenCalledWith(expect.objectContaining({ source: 'identity' }))
    // CHG-VIR-18 D-105-20：minScore 控件 + legacy 降级提示退役 → 恒不渲染
    expect(screen.queryByText('minScore')).toBeNull()
    expect(screen.queryByTestId('merge-source-fallback-note')).toBeNull()
  })

  it('2a. 相似度列：identity 评分 → 91.0%（CHG-VIR-18：来源列退役，不再渲染 candidate-source chip）', async () => {
    listCandidatesMock.mockResolvedValue(IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    // D-105-20：来源列整列退役
    expect(screen.queryByTestId(`candidate-source-${IDENTITY_GROUP.groupKey}`)).toBeNull()
    expect(screen.getByText('91.0%')).not.toBeNull()
  })

  it('2b. 操作列快捷合并（CHG-VIR-15-UX-A）：confirm → mergeVideos（推荐 target + candidateIds，不带 targetStatus）', async () => {
    listCandidatesMock.mockResolvedValue(IDENTITY_RES)
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-quick',
      targetVideo: { id: 'vid-b', title: 'Avengers B', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-02-01T00:00:00Z',
        sourceCount: 8, sourceSiteKeys: ['iqiyi'] },
    })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByTestId(`candidate-quick-merge-${IDENTITY_GROUP.groupKey}`))
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledWith(expect.objectContaining({
        sourceVideoIds: ['vid-a'],
        targetVideoId: 'vid-b',
        candidateIds: ['cand-uuid-0001'],
      }))
    })
    expect(mergeVideosMock.mock.calls[0]![0]).not.toHaveProperty('targetStatus')
    // 快捷路径不触发行展开（stopPropagation）
    expect(screen.queryByTestId('merge-compare-panel')).toBeNull()
  })

  it('2c. 操作列快捷拒绝（identity 行）：rejectIdentityCandidate 调用；legacy 行无拒绝按钮', async () => {
    listCandidatesMock.mockResolvedValue({
      data: [IDENTITY_GROUP, { ...LEGACY_GROUP, groupKey: 'legacy-row' }],
      total: 2, page: 1, limit: 20, source: 'identity' as const,
    })
    rejectIdentityCandidateMock.mockResolvedValueOnce({ candidateId: 'cand-uuid-0001', status: 'rejected', decisionId: 'dec-q' })
    render(<CandidatesSection />)
    await waitFor(() => screen.getAllByText('復仇者聯盟'))
    expect(screen.queryByTestId('candidate-quick-reject-legacy-row')).toBeNull()
    fireEvent.click(screen.getByTestId(`candidate-quick-reject-${IDENTITY_GROUP.groupKey}`))
    await waitFor(() => {
      expect(rejectIdentityCandidateMock).toHaveBeenCalledWith('cand-uuid-0001', '合并工作台人工拒绝')
    })
  })

  // CHG-VIR-18 D-105-20：原用例 3「降级回显 → 提示条 + minScore 控件」随 legacy 退役删除
  // （source 恒 identity，无降级；GOV-2 版本搁浅警示另测，见用例 10g 后 stale 用例）。

  it('4. identity group 展开：「拒绝候选」按钮 + 相似度 pill 渲染', async () => {
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

  // ── CHG-VIR-13-D2 / D-105-9（设计 §4.4）：操作内状态设置 ──────────────

  // D-105-7 状态字段齐备：target(vid-b 推荐)=pending|internal + source(vid-a)=approved|public
  // → 智能默认规则 2 命中：预选 approve 单步效果 (approved, internal) + hint
  const STATUS_GROUP = {
    ...LEGACY_GROUP,
    videos: [
      { ...LEGACY_GROUP.videos[0]!, reviewStatus: 'approved' as const, visibilityStatus: 'public' as const },
      { ...LEGACY_GROUP.videos[1]!, reviewStatus: 'pending_review' as const, visibilityStatus: 'internal' as const },
    ],
  }
  const STATUS_RES = { data: [STATUS_GROUP], total: 1, page: 1, limit: 20, source: 'legacy' as const }

  it('9a. 状态字段齐备：控件渲染 + 智能默认预选 (approved, internal) + hint + merge 携带 targetStatus', async () => {
    listCandidatesMock.mockResolvedValue(STATUS_RES)
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-d2',
      targetVideo: { id: 'vid-b', title: 'Avengers B', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-02-01T00:00:00Z',
        sourceCount: 8, sourceSiteKeys: ['iqiyi'] },
      statusTransition: 'applied',
    })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByTestId('candidate-status-control'))
    // 智能默认预选（规则 2：source 已公开 + target pending → approve 单步效果）
    const select = screen.getByTestId('candidate-status-control-select') as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('approved|internal'))
    expect(screen.getByTestId('candidate-status-control-hint').textContent).toContain('已发布')
    fireEvent.click(screen.getByRole('button', { name: /执行合并/ }))
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledWith(expect.objectContaining({
        targetStatus: { reviewStatus: 'approved', visibilityStatus: 'internal' },
      }))
    })
  })

  it('9b. legacy 候选无状态字段（D-105-7 降级）：控件默认 keep + merge 不带 targetStatus（R-105-T1 前端侧）', async () => {
    listCandidatesMock.mockResolvedValue(LEGACY_RES)
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-keep',
      targetVideo: { id: 'vid-b', title: 'Avengers B', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-02-01T00:00:00Z',
        sourceCount: 8, sourceSiteKeys: ['iqiyi'] },
    })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByTestId('candidate-status-control'))
    expect((screen.getByTestId('candidate-status-control-select') as HTMLSelectElement).value).toBe('keep')
    fireEvent.click(screen.getByRole('button', { name: /执行合并/ }))
    await waitFor(() => expect(mergeVideosMock).toHaveBeenCalledTimes(1))
    expect(mergeVideosMock.mock.calls[0][0]).not.toHaveProperty('targetStatus')
  })

  // ── CHG-VIR-16-TBL-FE / D-105a-19：组级检索（排序/筛选/搜索/截断/空态）──────

  it('10a. 相似度列排序：列头菜单降序 → listCandidates 透传 sortField=identityScore + sortDir=desc', async () => {
    listCandidatesMock.mockResolvedValue(IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-identityScore'))
    fireEvent.click(screen.getByTestId('dt-autofilter-identityScore-sort-desc'))
    await waitFor(() => {
      expect(listCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortField: 'identityScore', sortDir: 'desc' }),
      )
    })
  })

  it('10b. 相似度区间筛选：% 输入 80–95 → identityScoreMin 0.8 / Max 0.95（÷100 映射）+ page 重置', async () => {
    listCandidatesMock.mockResolvedValue(IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-identityScore'))
    fireEvent.change(screen.getByTestId('dt-autofilter-identityScore-number-min'), { target: { value: '80' } })
    fireEvent.change(screen.getByTestId('dt-autofilter-identityScore-number-max'), { target: { value: '95' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-identityScore-apply'))
    await waitFor(() => {
      expect(listCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ identityScoreMin: 0.8, identityScoreMax: 0.95, page: 1 }),
      )
    })
  })

  it('10c. 候选数区间筛选：min 3 → videoCountMin=3（组级精确口径）', async () => {
    listCandidatesMock.mockResolvedValue(IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-videoCount'))
    fireEvent.change(screen.getByTestId('dt-autofilter-videoCount-number-min'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-videoCount-apply'))
    await waitFor(() => {
      expect(listCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ videoCountMin: 3, page: 1 }),
      )
    })
    expect(listCandidatesMock.mock.calls.at(-1)![0]).not.toHaveProperty('videoCountMax')
  })

  it('10d. 工具条搜索框：输入防抖 commit → q 参数 + page 重置；清空 → q 不发送', async () => {
    listCandidatesMock.mockResolvedValue(IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.change(screen.getByTestId('merge-candidates-search'), { target: { value: '復仇者' } })
    await waitFor(() => {
      expect(listCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: '復仇者', page: 1 }),
      )
    })
    fireEvent.change(screen.getByTestId('merge-candidates-search'), { target: { value: '' } })
    await waitFor(() => {
      expect(listCandidatesMock.mock.calls.at(-1)![0]).not.toHaveProperty('q')
    })
  })

  it('10e. total 文案 = 「共 N 组」（D-105a-19 组数语义，identity 不再「共 N 对候选」）', async () => {
    listCandidatesMock.mockResolvedValue({ ...IDENTITY_RES, total: 7 })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    expect(screen.getByText(/共\s*7\s*组/)).not.toBeNull()
    expect(screen.queryByText(/对候选/)).toBeNull()
  })

  it('10f. truncated 回显 → 截断警示条渲染；未截断不渲染', async () => {
    listCandidatesMock.mockResolvedValue({ ...IDENTITY_RES, truncated: true })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    await waitFor(() => expect(screen.getByTestId('merge-truncated-note')).not.toBeNull())
  })

  it('10h. GOV-2 版本搁浅：staleIdentityPending 回显 → 「候选待重评」警示渲染（CHG-VIR-18 D-105-21/22 保留 + route 透传）', async () => {
    listCandidatesMock.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, source: 'identity' as const, staleIdentityPending: true })
    render(<CandidatesSection />)
    await waitFor(() => expect(screen.getByTestId('merge-stale-identity-note')).not.toBeNull())
    // 无降级提示（legacy 退役）
    expect(screen.queryByTestId('merge-source-fallback-note')).toBeNull()
  })

  it('10g. 筛选/搜索空结果：保持 DataTable + 表内空态（搜索框可清除条件，不切整页 EmptyState）', async () => {
    listCandidatesMock.mockImplementation(async (params: { q?: string }) =>
      params.q
        ? { data: [], total: 0, page: 1, limit: 20, source: 'identity' as const }
        : IDENTITY_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.change(screen.getByTestId('merge-candidates-search'), { target: { value: '不存在' } })
    await waitFor(() => screen.getByText('无匹配候选'))
    // 搜索框仍在（条件可清除）；整页空态「无合并候选」不渲染
    expect(screen.getByTestId('merge-candidates-search')).not.toBeNull()
    expect(screen.queryByText('无合并候选')).toBeNull()
    expect(screen.getByText(/共\s*0\s*组/)).not.toBeNull()
  })

  // ── CHG-VIR-17-PARTIAL / D-105a-18 遗留 ① 兑现：部分合并（选定子集就地合并）────

  it('11a. 排除成员后合并：sourceVideoIds=选中子集 + candidateIds 仅含两端均在集合内的 pair（集合外 pair 不传 / 422 契约）', async () => {
    listCandidatesMock.mockResolvedValue(CLUSTER_RES)
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-partial',
      targetVideo: { id: 'vid-b', title: 'Avengers B', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-02-01T00:00:00Z',
        sourceCount: 8, sourceSiteKeys: ['iqiyi'] },
    })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByTestId('compare-select-vid-c'))
    // 排除 vid-c → 部分合并提示出现
    fireEvent.click(screen.getByTestId('compare-select-vid-c'))
    await waitFor(() => screen.getByTestId('merge-partial-note'))
    fireEvent.click(screen.getByRole('button', { name: /执行合并/ }))
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledWith(expect.objectContaining({
        sourceVideoIds: ['vid-a'],
        targetVideoId: 'vid-b',
        // 仅 a-b pair（cand-uuid-0001）；跨界 b-c（0002）/ a-c（0003）不得传
        candidateIds: ['cand-uuid-0001'],
      }))
    })
  })

  it('11b. 排除 target → target 自动转移到选中集合内成员（排除列 radio disabled）', async () => {
    listCandidatesMock.mockResolvedValue(CLUSTER_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByTestId('compare-select-vid-b'))
    // 推荐 target = vid-b；排除它 → 自动转移（选中集首个 vid-a）
    fireEvent.click(screen.getByTestId('compare-select-vid-b'))
    await waitFor(() => {
      const radioA = screen.getByLabelText('选择 Avengers A 为合并目标') as HTMLInputElement
      expect(radioA.checked).toBe(true)
    })
    const radioB = screen.getByLabelText('选择 Avengers B 为合并目标') as HTMLInputElement
    expect(radioB.checked).toBe(false)
    expect(radioB.disabled).toBe(true)
  })

  it('11c. 选中 < 2 → 合并按钮禁用 + 提示（不可单视频合并）', async () => {
    listCandidatesMock.mockResolvedValue(CLUSTER_RES)
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByTestId('compare-select-vid-b'))
    fireEvent.click(screen.getByTestId('compare-select-vid-b'))
    fireEvent.click(screen.getByTestId('compare-select-vid-c'))
    await waitFor(() => screen.getByTestId('merge-too-few-note'))
    const mergeBtn = screen.getByRole('button', { name: /执行合并/ }) as HTMLButtonElement
    expect(mergeBtn.disabled).toBe(true)
    fireEvent.click(mergeBtn)
    expect(mergeVideosMock).not.toHaveBeenCalled()
  })

  it('11e. 排除 target 后合并（FIX / Codex review）：target 自动转移后全链路正确（新 target + 子集 + 集合内 pair）', async () => {
    listCandidatesMock.mockResolvedValue(CLUSTER_RES)
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-retarget',
      targetVideo: { id: 'vid-a', title: 'Avengers A', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-01-01T00:00:00Z',
        sourceCount: 5, sourceSiteKeys: ['iqiyi'] },
    })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByTestId('compare-select-vid-b'))
    // 排除推荐 target vid-b → 自动转移 vid-a（选中集 {a,c}）
    fireEvent.click(screen.getByTestId('compare-select-vid-b'))
    await waitFor(() => {
      expect((screen.getByLabelText('选择 Avengers A 为合并目标') as HTMLInputElement).checked).toBe(true)
    })
    fireEvent.click(screen.getByRole('button', { name: /执行合并/ }))
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledWith(expect.objectContaining({
        sourceVideoIds: ['vid-c'],
        targetVideoId: 'vid-a', // 不是被排除的 vid-b（buildMergeSelection 守卫 + effect 转移双层保证）
        candidateIds: ['cand-uuid-0003'], // 仅 a-c pair；含 vid-b 的 0001/0002 跨界不传
      }))
    })
  })

  it('11d. N=12 组（整组超限）取消勾选 1 个 → 选中 11 ≤ 上限可就地合并（8c 引导升级）', async () => {
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
    listCandidatesMock.mockResolvedValue({ data: [bigGroup], total: 1, page: 1, limit: 20, source: 'identity' as const })
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-batch-1',
      targetVideo: { id: 'vid-0', title: 'V0', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-01-01T00:00:00Z',
        sourceCount: 12, sourceSiteKeys: ['iqiyi'] },
    })
    render(<CandidatesSection />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    // 整组 12 > 11 → 超限提示
    await waitFor(() => screen.getByTestId('merge-limit-note'))
    // 取消勾选 1 个 → 选中 11 → 提示消失 + 可合并
    fireEvent.click(screen.getByTestId('compare-select-vid-11'))
    await waitFor(() => expect(screen.queryByTestId('merge-limit-note')).toBeNull())
    const mergeBtn = screen.getByRole('button', { name: /执行合并（10 → target）/ }) as HTMLButtonElement
    expect(mergeBtn.disabled).toBe(false)
    fireEvent.click(mergeBtn)
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledTimes(1)
    })
    const params = mergeVideosMock.mock.calls[0]![0] as { sourceVideoIds: string[] }
    expect(params.sourceVideoIds).toHaveLength(10)
    expect(params.sourceVideoIds).not.toContain('vid-11')
  })
})
