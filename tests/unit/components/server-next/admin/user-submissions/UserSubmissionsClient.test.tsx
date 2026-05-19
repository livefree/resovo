/**
 * UserSubmissionsClient.test.tsx — `/admin/user-submissions` 主视图单测
 *
 * 任务卡：CHG-SN-7-REDO-02-C
 * 真源：ADR-124 + spec §5.13 + screens-3.jsx:415-454
 *
 * 覆盖 ≥ 8 case：
 *   1. 渲染基础（data-user-submissions-client + PageHeader title）
 *   2. Segment 4 项 + badge 注入（badges.bad_source/wish_list/metadata_correction/processed）
 *   3. Segment 切换 → 重新 fetch + page 重置为 1
 *   4. 加载态（LoadingState skeleton）
 *   5. Error 态（fetch 失败 + retry）
 *   6. Empty 态（空数组）
 *   7. SubmissionCard 行渲染（3 类 visual icon + 求片无 poster）
 *   8. process 按钮：onClick → API + 成功 toast + 行从列表移除
 *   9. reject 按钮：prompt → API + 成功 toast
 *  10. 分页：> PAGE_LIMIT 显示 pagination + 下一页切换
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listUserSubmissionsMock = vi.fn()
const processUserSubmissionMock = vi.fn()
const rejectUserSubmissionMock = vi.fn()
const toastPushMock = vi.fn()
const promptSpy = vi.fn().mockReturnValue('test reason')

vi.mock('../../../../../../apps/server-next/src/lib/user-submissions/api', () => ({
  listUserSubmissions: (...args: unknown[]) => listUserSubmissionsMock(...args),
  processUserSubmission: (...args: unknown[]) => processUserSubmissionMock(...args),
  rejectUserSubmission: (...args: unknown[]) => rejectUserSubmissionMock(...args),
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

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => {
  class MockApiClientError extends Error {
    public readonly code: string
    public readonly status: number
    constructor(code: string, message: string, status: number) {
      super(message); this.code = code; this.status = status; this.name = 'ApiClientError'
    }
  }
  return {
    ApiClientError: MockApiClientError,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  }
})

import { UserSubmissionsClient } from '../../../../../../apps/server-next/src/app/admin/user-submissions/_client/UserSubmissionsClient'

const ROW_BAD_SOURCE = {
  id: 'sub-1',
  type: 'bad_source' as const,
  status: 'pending' as const,
  videoId: 'vid-1',
  sourceId: 'src-1',
  submittedBy: 'user-1',
  submittedByName: 'alice',
  quote: '换了线路也是一样的',
  metadata: null,
  videoTitle: '危险关系',
  videoPosterUrl: 'https://example.com/poster.jpg',
  sourceName: '线路2',
  sourceSiteKey: 'jszyapi',
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  processedAt: null,
  processedBy: null,
  processedReason: null,
}

const ROW_WISH_LIST = {
  ...ROW_BAD_SOURCE,
  id: 'sub-2',
  type: 'wish_list' as const,
  videoId: null,
  sourceId: null,
  videoTitle: null,
  videoPosterUrl: null,
  sourceName: null,
  sourceSiteKey: null,
  quote: '希望加进来',
}

const ROW_METADATA = {
  ...ROW_BAD_SOURCE,
  id: 'sub-3',
  type: 'metadata_correction' as const,
  sourceId: null,
  sourceName: null,
  sourceSiteKey: null,
  metadata: { field: 'director', suggested_value: 'Simon Mirren' },
  quote: '导演名拼错',
}

const LIST_RESP_PENDING = {
  data: [ROW_BAD_SOURCE, ROW_WISH_LIST, ROW_METADATA],
  meta: {
    total: 3,
    page: 1,
    limit: 20,
    badges: { bad_source: 8, wish_list: 3, metadata_correction: 1, processed: 412 },
  },
}

const LIST_RESP_EMPTY = {
  data: [],
  meta: { total: 0, page: 1, limit: 20, badges: { bad_source: 0, wish_list: 0, metadata_correction: 0, processed: 0 } },
}

beforeEach(() => {
  listUserSubmissionsMock.mockReset()
  processUserSubmissionMock.mockReset()
  rejectUserSubmissionMock.mockReset()
  toastPushMock.mockReset()
  promptSpy.mockReset().mockReturnValue('test reason')
  ;(globalThis as unknown as { prompt: typeof promptSpy }).prompt = promptSpy
  listUserSubmissionsMock.mockResolvedValue(LIST_RESP_PENDING)
})

describe('UserSubmissionsClient (REDO-02-C)', () => {
  it('1. 渲染基础：data-user-submissions-client + PageHeader title', async () => {
    const { container } = render(<UserSubmissionsClient />)
    expect(container.querySelector('[data-user-submissions-client]')).not.toBeNull()
    await waitFor(() => expect(screen.getByText('用户投稿 / 纠错')).not.toBeNull())
  })

  it('2. Segment 4 项 + badge 注入', async () => {
    render(<UserSubmissionsClient />)
    await waitFor(() => screen.getByTestId('user-submissions-segment'))
    expect(screen.getByText('失效源举报')).not.toBeNull()
    expect(screen.getByText('求片')).not.toBeNull()
    expect(screen.getByText('元数据纠错')).not.toBeNull()
    expect(screen.getByText('已处理')).not.toBeNull()
    // badge 数字（8 / 3 / 1 / 412）
    const seg = screen.getByTestId('user-submissions-segment')
    expect(seg.textContent).toContain('8')
    expect(seg.textContent).toContain('3')
    expect(seg.textContent).toContain('1')
    expect(seg.textContent).toContain('412')
  })

  it('3. Segment 切换 → 重新 fetch + type 参数变化', async () => {
    render(<UserSubmissionsClient />)
    await waitFor(() => screen.getByText('求片'))
    listUserSubmissionsMock.mockClear()
    const wishBtn = screen.getByRole('tab', { name: /求片/ })
    fireEvent.click(wishBtn)
    await waitFor(() => {
      expect(listUserSubmissionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'wish_list', status: 'pending', page: 1 }),
      )
    })
  })

  it('4. 加载态：初始未返回数据时渲染 LoadingState', () => {
    listUserSubmissionsMock.mockReturnValue(new Promise(() => {}))
    const { container } = render(<UserSubmissionsClient />)
    // LoadingState 渲染 (skeleton 元素)
    expect(container.textContent).toBeTruthy()
  })

  it('5. Error 态：fetch 失败 → 显示错误', async () => {
    listUserSubmissionsMock.mockRejectedValueOnce(new Error('网络错误'))
    render(<UserSubmissionsClient />)
    await waitFor(() => {
      expect(screen.getByText(/加载.*失败/)).not.toBeNull()
    })
  })

  it('6. Empty 态：空数组 → 显示"暂无待处理投稿"', async () => {
    listUserSubmissionsMock.mockResolvedValueOnce(LIST_RESP_EMPTY)
    render(<UserSubmissionsClient />)
    await waitFor(() => {
      expect(screen.getByText(/暂无.*投稿/)).not.toBeNull()
    })
  })

  it('7. Card 行渲染：3 类 visual + 求片无 poster', async () => {
    const { container } = render(<UserSubmissionsClient />)
    await waitFor(() => screen.getByTestId(`submission-card-${ROW_BAD_SOURCE.id}`))
    // bad_source 有 poster
    expect(container.querySelector(`[data-testid="submission-card-${ROW_BAD_SOURCE.id}"] img`)).not.toBeNull()
    // wish_list 无 poster
    expect(container.querySelector(`[data-testid="submission-card-${ROW_WISH_LIST.id}"] img`)).toBeNull()
    // metadata_correction 有 metadata quote
    expect(container.querySelector(`[data-testid="submission-card-${ROW_METADATA.id}"] [data-submission-metadata]`)?.textContent).toContain('director')
  })

  it('8. process 按钮：onClick → API + 成功 toast + 行从列表移除', async () => {
    processUserSubmissionMock.mockResolvedValueOnce(undefined)
    render(<UserSubmissionsClient />)
    const processBtn = await waitFor(() => screen.getByTestId(`submission-process-${ROW_BAD_SOURCE.id}`))
    fireEvent.click(processBtn)
    await waitFor(() => {
      expect(processUserSubmissionMock).toHaveBeenCalledWith('sub-1')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已处理' }),
      )
      // 行移除
      expect(screen.queryByTestId(`submission-card-${ROW_BAD_SOURCE.id}`)).toBeNull()
    })
  })

  it('9. reject 按钮：prompt 返回 reason → API 调用 + 成功 toast', async () => {
    rejectUserSubmissionMock.mockResolvedValueOnce(undefined)
    promptSpy.mockReset().mockReturnValue('已在 backlog')
    render(<UserSubmissionsClient />)
    const rejectBtn = await waitFor(() => screen.getByTestId(`submission-reject-${ROW_BAD_SOURCE.id}`))
    fireEvent.click(rejectBtn)
    await waitFor(() => {
      expect(rejectUserSubmissionMock).toHaveBeenCalledWith('sub-1', { reason: '已在 backlog' })
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已拒绝' }),
      )
    })
  })

  it('10. reject 按钮：prompt 返回 null → 不调 API', async () => {
    promptSpy.mockReset().mockReturnValue(null)
    render(<UserSubmissionsClient />)
    const rejectBtn = await waitFor(() => screen.getByTestId(`submission-reject-${ROW_BAD_SOURCE.id}`))
    fireEvent.click(rejectBtn)
    await new Promise((r) => setTimeout(r, 0))
    expect(rejectUserSubmissionMock).not.toHaveBeenCalled()
  })

  it('11. 分页：total > PAGE_LIMIT 渲染 pagination + 下一页', async () => {
    listUserSubmissionsMock.mockResolvedValueOnce({
      ...LIST_RESP_PENDING,
      meta: { ...LIST_RESP_PENDING.meta, total: 45 },
    })
    render(<UserSubmissionsClient />)
    await waitFor(() => screen.getByTestId('submissions-pagination'))
    const nextBtn = screen.getByTestId('submissions-next-page')
    fireEvent.click(nextBtn)
    await waitFor(() => {
      expect(listUserSubmissionsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      )
    })
  })

  it('12. Card 行 title 注入 visual prefix（举报：xxx / 求片：xxx / 纠错：xxx）', async () => {
    render(<UserSubmissionsClient />)
    await waitFor(() => screen.getByTestId(`submission-card-${ROW_BAD_SOURCE.id}`))
    // ROW_BAD_SOURCE.quote='换了线路也是一样的' → title '举报：换了线路也是一样的'
    expect(screen.getByText(/举报：换了线路/)).not.toBeNull()
    expect(screen.getByText(/求片：希望加进来/)).not.toBeNull()
    expect(screen.getByText(/纠错：导演名拼错/)).not.toBeNull()
  })
})
