/**
 * MergeClient.test.tsx — /admin/merge 视图单元测试（CHG-SN-5-12-PATCH P1 / CHG-SN-7-MISC-MERGE-1/2）
 *
 * 覆盖：
 *   - 渲染基础 + Segment 3 items（待审候选 / 已合并 / 已拆分）
 *   - candidates Loading / Empty / Error state
 *   - candidates 列表渲染 + 行展开 + 推荐 badge（P2-2）
 *   - handleMerge mock api + 成功 toast + STATE_CONFLICT 引导（P0 修复验证）
 *   - handleMerge 成功 + 撤销 action 调 unmergeVideos
 *   - 拆分工作台：PageHeader action 按钮 toggle + videoId 输入 → 加载 sources 失败
 *   - 拆分工作台：type select 11 选项（P2-3）
 *   - 已合并 Segment → listAudit action='merge'
 *   - 已拆分 Segment → listAudit action='split'
 *   - 置信度 pill 已退役：展开后不渲染 confidence-pill（MERGE-2 / CHG-VIR-14-SCORE-UI）
 *   - 影响预览：展开后显示源视频预览区块（MERGE-2）
 *
 * 路径策略：用相对路径 import（与 HomeOpsClient.test.tsx 同范式）避免 @ alias 在测试环境内的解析歧义。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// ── mock api（相对路径与 vi.mock target 一致）─────────────────────

const listCandidatesMock = vi.fn()
const mergeVideosMock = vi.fn()
const unmergeVideosMock = vi.fn()
const splitVideoMock = vi.fn()
const getVideoMatrixMock = vi.fn()
const toastPushMock = vi.fn()

const listAuditMock = vi.fn()

// CHG-SN-8-04-N1 顺手修 pre-existing：CHG-SN-8-08 在 MergeClient 引入 useRouter/useSearchParams 但未补 mock
// CHG-VIR-13-WS：mockSearchString 可变（mode/旧参数升级映射注入）+ replace spy（双向同步断言）
const routerReplaceMock = vi.fn()
let mockSearchString = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: (...args: unknown[]) => routerReplaceMock(...args),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(mockSearchString),
}))

vi.mock('../../../../../../apps/server-next/src/lib/merge/api', () => ({
  listCandidates: (...args: unknown[]) => listCandidatesMock(...args),
  mergeVideos: (...args: unknown[]) => mergeVideosMock(...args),
  unmergeVideos: (...args: unknown[]) => unmergeVideosMock(...args),
  splitVideo: (...args: unknown[]) => splitVideoMock(...args),
  listAudit: (...args: unknown[]) => listAuditMock(...args),
}))

// CHG-VIR-13-B2B：SplitWorkspace/CandidateExpand 经 picker-fetcher 消费 listVideos
vi.mock('../../../../../../apps/server-next/src/lib/videos/api', () => ({
  listVideos: vi.fn(() => Promise.resolve({ data: [], total: 0, page: 1, limit: 20 })),
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  getVideoMatrix: (...args: unknown[]) => getVideoMatrixMock(...args),
  listVideoGroups: vi.fn(),
  getVideoGroupStats: vi.fn(),
  listLineAliases: vi.fn(),
  upsertLineAlias: vi.fn(),
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

// mock api-client（避免 @/stores/authStore @-alias 解析；保留 ApiClientError class 供 instanceof）
// vi.mock 是 hoisted，inline class 定义避免 ReferenceError
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
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import { MergeClient } from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeClient'
import { ApiClientError } from '../../../../../../apps/server-next/src/lib/api-client'

// ── fixtures ──────────────────────────────────────────────────────

const CANDIDATE_GROUP = {
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

const EMPTY_RES = { data: [], total: 0, page: 1, limit: 20 }
const ONE_GROUP_RES = { data: [CANDIDATE_GROUP], total: 1, page: 1, limit: 20 }

beforeEach(() => {
  mockSearchString = ''
  routerReplaceMock.mockReset()
  listCandidatesMock.mockReset()
  mergeVideosMock.mockReset()
  unmergeVideosMock.mockReset()
  splitVideoMock.mockReset()
  getVideoMatrixMock.mockReset()
  toastPushMock.mockReset()
  listAuditMock.mockReset()
})

// ── 测试 ──────────────────────────────────────────────────────────

describe('MergeClient', () => {
  it('渲染基础：PageHeader + Segment 4 区（CHG-VIR-13-WS mode 模型）', async () => {
    listCandidatesMock.mockResolvedValueOnce(EMPTY_RES)
    render(<MergeClient />)
    expect(screen.getByText('合并 / 拆分工作台')).not.toBeNull()
    expect(screen.getByRole('tab', { name: '待审候选' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: '合并工作区' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: '拆分工作区' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: '操作记录' })).not.toBeNull()
    // 旧「拆分工作台」PageHeader toggle 已废除（mode Segment 取代）
    expect(screen.queryByRole('button', { name: '拆分工作台' })).toBeNull()
  })

  it('Empty state：listCandidates 返回空 data', async () => {
    listCandidatesMock.mockResolvedValueOnce(EMPTY_RES)
    render(<MergeClient />)
    await waitFor(() => {
      expect(screen.getByText('无合并候选')).not.toBeNull()
    })
  })

  it('Error state：listCandidates 抛错时显示 ErrorState', async () => {
    listCandidatesMock.mockRejectedValueOnce(new Error('Network down'))
    render(<MergeClient />)
    await waitFor(() => {
      expect(screen.getAllByText(/Network down|加载失败/).length).toBeGreaterThan(0)
    })
  })

  it('mode 双向同步：点击 Segment「拆分工作区」→ router.replace(?mode=split)（CHG-VIR-13-WS）', async () => {
    listCandidatesMock.mockResolvedValueOnce(EMPTY_RES)
    render(<MergeClient />)
    await waitFor(() => screen.getByText('无合并候选'))
    fireEvent.click(screen.getByRole('tab', { name: '拆分工作区' }))
    expect(routerReplaceMock).toHaveBeenCalled()
    expect(String(routerReplaceMock.mock.calls.at(-1)![0])).toContain('mode=split')
  })

  it('mode=split URL 注入 → 渲染拆分工作台（单一活动工作区，候选不渲染）', async () => {
    mockSearchString = 'mode=split'
    render(<MergeClient />)
    // CHG-VIR-13-B2B：手输 uuid 替换为 VideoPicker（选择要拆分的视频）
    expect(await screen.findByText('选择要拆分的视频')).not.toBeNull()
    expect(screen.queryByPlaceholderText('输入要拆分的 videoId (uuid)')).toBeNull()
    expect(listCandidatesMock).not.toHaveBeenCalled()
  })

  it('candidate 列表渲染 + 行展开 + 推荐 badge（P2-2 修复验证）', async () => {
    listCandidatesMock.mockResolvedValueOnce(ONE_GROUP_RES)
    render(<MergeClient />)
    await waitFor(() => {
      expect(screen.getByText('復仇者聯盟')).not.toBeNull()
      // CHG-VIR-14-SCORE-UI：「重合度」列退役 → 列表不再渲染 legacyScore 百分比
      expect(screen.queryByText('85.0%')).toBeNull()
    })
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => {
      // CHG-VIR-13-B2B：推荐 badge 在 MergeComparePanel 列头（aria-label）；标题在矩阵中多处出现
      expect(screen.getByLabelText('推荐合并目标')).not.toBeNull()
      expect(screen.getAllByText('Avengers B').length).toBeGreaterThan(0)
    })
  })

  it('handleMerge STATE_CONFLICT 引导（P0 修复验证 — 用 err.code 而非 message 匹配）', async () => {
    listCandidatesMock.mockResolvedValue(ONE_GROUP_RES)
    const conflictErr = new ApiClientError('STATE_CONFLICT', 'source 与 target 视频存在重复 3 条', 409)
    mergeVideosMock.mockRejectedValueOnce(conflictErr)

    render(<MergeClient />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByRole('button', { name: /执行合并/ }))
    fireEvent.click(screen.getByRole('button', { name: /执行合并/ }))

    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger',
        title: '合并失败',
        description: expect.stringContaining('建议先到 /admin/sources'),
      }))
    })
  })

  it('handleMerge 成功 toast + 撤销 action 调 unmergeVideos', async () => {
    listCandidatesMock.mockResolvedValue(ONE_GROUP_RES)
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-123',
      targetVideo: { id: 'vid-b', title: 'Avengers B', titleNormalized: '復仇者聯盟',
        year: 2019, type: 'movie', createdAt: '2025-02-01T00:00:00Z',
        sourceCount: 8, sourceSiteKeys: ['iqiyi', 'youku', 'bilibili'] },
    })
    unmergeVideosMock.mockResolvedValueOnce({ restoredVideoIds: ['vid-a'] })

    render(<MergeClient />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => screen.getByRole('button', { name: /执行合并/ }))
    fireEvent.click(screen.getByRole('button', { name: /执行合并/ }))

    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'success',
        title: '合并成功',
        action: expect.objectContaining({ label: '撤销' }),
      }))
    })
    const lastCall = toastPushMock.mock.calls.at(-1)![0] as { action: { onClick: () => void } }
    lastCall.action.onClick()
    await waitFor(() => {
      expect(unmergeVideosMock).toHaveBeenCalledWith('audit-123', '用户撤销')
    })
  })

  it('拆分工作台：深链加载 sources 失败时 ErrorState 渲染（13-B2B VideoPicker 化后走 ?split 自动加载）', async () => {
    getVideoMatrixMock.mockRejectedValueOnce(new Error('video 不存在'))
    mockSearchString = 'mode=split&split=00000000-0000-0000-0000-000000000001'
    render(<MergeClient />)

    await waitFor(() => {
      expect(screen.getAllByText(/video 不存在|加载失败/).length).toBeGreaterThan(0)
    })
  })

  it('拆分工作台：含 type select 11 选项（P2-3 修复验证 — 替代硬编码 movie）', async () => {
    mockSearchString = 'mode=split&split=00000000-0000-0000-0000-000000000001'
    getVideoMatrixMock.mockResolvedValueOnce([
      { sourceSiteKey: 'iqiyi', sourceName: '线路1', displayName: null,
        episodes: [{ episodeNumber: 1, sourceId: 's1', sourceUrl: 'https://x.com/1',
          probeStatus: 'ok' as const, renderStatus: 'ok' as const, isActive: true }] },
    ])
    render(<MergeClient />)

    await waitFor(() => {
      const typeSelects = screen.getAllByLabelText(/分集 . 类型/)
      expect(typeSelects.length).toBe(2)
      const firstSelect = typeSelects[0] as HTMLSelectElement
      expect(firstSelect.querySelectorAll('option').length).toBe(11)
    })
  })

  // ── Segment 已合并 / 已拆分 测试（CHG-SN-7-MISC-MERGE-1）─────────────────

  it('旧 ?tab=merged 升级映射 → mode=records + listAudit({action: merge})（CHG-VIR-13-WS）', async () => {
    mockSearchString = 'tab=merged'
    listAuditMock.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 20 })
    render(<MergeClient />)
    await waitFor(() => {
      expect(listAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'merge', limit: 20, page: 1 }))
    })
  })

  it('旧 ?tab=split 升级映射 → mode=records + listAudit({action: split})（CHG-VIR-13-WS）', async () => {
    mockSearchString = 'tab=split'
    listAuditMock.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 20 })
    render(<MergeClient />)
    await waitFor(() => {
      expect(listAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'split', limit: 20, page: 1 }))
    })
  })

  it('mode=records：Empty state 渲染（total=0）', async () => {
    mockSearchString = 'mode=records'
    listAuditMock.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 20 })
    render(<MergeClient />)
    await waitFor(() => {
      expect(screen.getByText('无审计记录')).not.toBeNull()
    })
  })

  // ── MERGE-2：card 形态 + 影响预览（置信度 pill CHG-VIR-14-SCORE-UI 退役）──────────────────

  it('MERGE-2/VIR-14：置信度 pill 已退役 — 展开后不渲染 confidence-pill（legacyScore 不再展示）', async () => {
    listCandidatesMock.mockResolvedValueOnce(ONE_GROUP_RES)
    render(<MergeClient />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => {
      // 展开面板已渲染（结果预览存在）但 confidence-pill 不存在
      expect(screen.getByTestId('merge-result-preview')).not.toBeNull()
      expect(screen.queryByTestId('confidence-pill')).toBeNull()
    })
  })

  it('MERGE-2/13-B2B：结果预览 — 展开后渲染 MergeResultPreview（After + 软删列表）', async () => {
    listCandidatesMock.mockResolvedValueOnce(ONE_GROUP_RES)
    render(<MergeClient />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    await waitFor(() => {
      // CHG-VIR-13-B2B：纯文本影响预览（impact-preview）→ MergeResultPreview
      const preview = screen.getByTestId('merge-result-preview')
      // 推荐 target = Avengers B（After 行）；source = Avengers A（软删列表）
      expect(preview.textContent).toContain('Avengers B')
      expect(screen.getByTestId('merge-result-soft-delete-list').textContent).toContain('Avengers A')
      expect(screen.getByTestId('merge-result-soft-delete-list').textContent).toContain('将软删除')
    })
  })

  // ── CHG-VIR-13-B2B：候选组转工作区 + 拆分结果预览嵌入 ─────────────

  it('13-B2B：候选行展开「转入合并工作区」→ router.replace(mode=merge&ids=组成员)', async () => {
    listCandidatesMock.mockResolvedValueOnce(ONE_GROUP_RES)
    render(<MergeClient />)
    await waitFor(() => screen.getByText('復仇者聯盟'))
    fireEvent.click(screen.getByText('復仇者聯盟'))
    const btn = await screen.findByTestId('candidate-transfer-workspace')
    fireEvent.click(btn)
    expect(routerReplaceMock).toHaveBeenCalled()
    const url = String(routerReplaceMock.mock.calls.at(-1)![0])
    expect(url).toContain('mode=merge')
    expect(url).toContain('ids=vid-a%2Cvid-b')
  })

  it('13-B2B：拆分工作台分组后渲染 SplitResultPreview（组卡 + 原视频软删明示）', async () => {
    mockSearchString = 'mode=split&split=00000000-0000-0000-0000-000000000001'
    getVideoMatrixMock.mockResolvedValueOnce([
      { sourceSiteKey: 'iqiyi', sourceName: '线路1', displayName: null,
        episodes: [{ episodeNumber: 1, sourceId: 's1', sourceUrl: 'https://x.com/1',
          probeStatus: 'ok' as const, renderStatus: 'ok' as const, isActive: true }] },
    ])
    render(<MergeClient />)
    await waitFor(() => {
      expect(screen.getByTestId('split-result-preview')).not.toBeNull()
      expect(screen.getByTestId('split-original-soft-delete-note').textContent).toContain('软删除')
      // 拆到已有 video 的 VideoPicker（手填 uuid 已消除）
      expect(screen.getAllByText('拆到已有视频（可选）').length).toBe(2)
    })
  })

  it('mode=records（tab=merged 升级）：渲染审计行（merge + revertedAt = 已撤销 badge）', async () => {
    mockSearchString = 'tab=merged'
    listAuditMock.mockResolvedValueOnce({
      data: [
        {
          id: 'audit-1', action: 'merge',
          sourceVideoIds: ['v1', 'v2'], targetVideoIds: ['v3'],
          performedBy: '00000000-0000-0000-0000-000000000001',
          performedByUsername: 'admin1',
          reason: null,
          performedAt: '2026-05-13T10:00:00Z',
          revertedAt: '2026-05-13T11:00:00Z',
          revertedBy: '00000000-0000-0000-0000-000000000001',
          revertedReason: '测试撤销',
        },
      ],
      total: 1, page: 1, limit: 20,
    })
    render(<MergeClient />)
    await waitFor(() => {
      expect(screen.getByText('admin1')).not.toBeNull()
      expect(screen.getByText('已撤销')).not.toBeNull()
    })
  })
})
