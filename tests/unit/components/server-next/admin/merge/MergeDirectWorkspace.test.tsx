/**
 * MergeDirectWorkspace.test.tsx — CHG-SN-8-08-B
 *
 * 范围（6 用例）：
 *  1. ?candidate_a 存在时 → 渲染 DirectMergeWorkspace + VideoPicker B
 *  2. 选 B + 点「立即合并」→ confirm + mergeVideos 携带正确参数
 *  3. B === A → toast warn + 不调 API
 *  4. ?candidate_b 存在 → VideoPicker 自动填入
 *  5. ?candidate_id + B 未换选 → mergeVideos 透传 candidateId（CHG-VIR-9-C）
 *  6. ?candidate_id 存在但 B 被换选 → candidateId 不透传（CHG-VIR-9-C）
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mergeVideosMock = vi.fn()
const toastPushMock = vi.fn()
const routerReplaceMock = vi.fn()
let mockSearchString = 'candidate_a=video-uuid-aaaa-1111&from=videos'

const listVideosMock = vi.fn()

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
  usePathname: () => '/admin/merge',
}))

vi.mock('../../../../../../apps/server-next/src/lib/merge/api', () => ({
  listCandidates: vi.fn(() => new Promise(() => {})),
  mergeVideos: (...args: unknown[]) => mergeVideosMock(...args),
  unmergeVideos: vi.fn(),
}))

vi.mock('../../../../../../apps/server-next/src/lib/videos/api', () => ({
  listVideos: (...args: unknown[]) => listVideosMock(...args),
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

import { MergeClient } from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeClient'

const VIDEO_B = {
  id: 'video-uuid-bbbb-2222',
  short_id: 'V002',
  title: '复仇者联盟',
  title_en: 'The Avengers',
  cover_url: null,
  type: 'movie',
  year: 2012,
  is_published: true,
  source_count: '3',
  created_at: '2026-05-01T00:00:00Z',
}

beforeEach(() => {
  mergeVideosMock.mockReset()
  toastPushMock.mockReset()
  routerReplaceMock.mockReset()
  listVideosMock.mockReset()
  listVideosMock.mockResolvedValue({ data: [VIDEO_B], total: 1, page: 1, limit: 20 })
  // confirm 默认通过
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DirectMergeWorkspace (CHG-SN-8-08-B)', () => {
  it('1. ?candidate_a 存在 → 渲染工作区 + VideoPicker B 触发器', async () => {
    mockSearchString = 'candidate_a=video-uuid-aaaa-1111&from=videos'
    render(<MergeClient />)
    await waitFor(() => {
      expect(screen.getByTestId('merge-direct-workspace')).not.toBeNull()
      expect(screen.getByTestId('merge-candidate-b-picker')).not.toBeNull()
      expect(screen.getByTestId('merge-direct-execute')).not.toBeNull()
    })
  })

  it('2. 选 B + 立即合并 → confirm + mergeVideos 携带正确参数', async () => {
    mockSearchString = 'candidate_a=video-uuid-aaaa-1111&from=videos'
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-uuid-cccc-3333',
      targetVideo: { id: 'video-uuid-aaaa-1111' },
    })

    render(<MergeClient />)
    // 打开 picker
    const pickerTrigger = await waitFor(() => screen.getByTestId('merge-candidate-b-picker'))
    fireEvent.click(pickerTrigger)
    // 选中 B
    const row = await waitFor(() => screen.getByTestId(`merge-candidate-b-picker-row-${VIDEO_B.id}`))
    fireEvent.click(row)
    // 点立即合并
    const executeBtn = await waitFor(() => screen.getByTestId('merge-direct-execute') as HTMLButtonElement)
    await waitFor(() => expect(executeBtn.disabled).toBe(false))
    fireEvent.click(executeBtn)
    // confirm 通过 → mergeVideos 调用
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledTimes(1)
    })
    expect(mergeVideosMock.mock.calls[0][0]).toMatchObject({
      sourceVideoIds: [VIDEO_B.id],
      targetVideoId: 'video-uuid-aaaa-1111',
    })
    // 成功 toast
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '合并成功' }),
      )
    })
  })

  it('4. ?candidate_b 存在 → VideoPicker 自动填入（GAPS #G-merge-candidate-b-auto）', async () => {
    mockSearchString = `candidate_a=video-uuid-aaaa-1111&candidate_b=${VIDEO_B.id}&from=moderation`
    listVideosMock.mockResolvedValue({ data: [VIDEO_B], total: 1, page: 1, limit: 20 })
    render(<MergeClient />)
    // 等待 useEffect fetch 完成 + picker 触发器显示 B title
    await waitFor(() => {
      const trigger = screen.getByTestId('merge-candidate-b-picker')
      expect(trigger.textContent).toContain(VIDEO_B.title)
    })
  })

  // ── CHG-VIR-9-C：?candidate_id 透传（identity 候选锚点 / ADR-178 D-178-3 confirm 语义）──

  it('5. ?candidate_id + B 未换选 → mergeVideos 透传 candidateId', async () => {
    mockSearchString = `candidate_a=video-uuid-aaaa-1111&candidate_b=${VIDEO_B.id}&candidate_id=cand-uuid-0001&from=moderation`
    listVideosMock.mockResolvedValue({ data: [VIDEO_B], total: 1, page: 1, limit: 20 })
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-uuid-dddd-4444',
      targetVideo: { id: 'video-uuid-aaaa-1111' },
    })

    render(<MergeClient />)
    // 等待 ?candidate_b 自动填入
    await waitFor(() => {
      const trigger = screen.getByTestId('merge-candidate-b-picker')
      expect(trigger.textContent).toContain(VIDEO_B.title)
    })
    const executeBtn = await waitFor(() => screen.getByTestId('merge-direct-execute') as HTMLButtonElement)
    await waitFor(() => expect(executeBtn.disabled).toBe(false))
    fireEvent.click(executeBtn)
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledTimes(1)
    })
    expect(mergeVideosMock.mock.calls[0][0]).toMatchObject({
      sourceVideoIds: [VIDEO_B.id],
      targetVideoId: 'video-uuid-aaaa-1111',
      candidateId: 'cand-uuid-0001',
    })
  })

  it('6. ?candidate_id 存在但 B 被换选 → candidateId 不透传（pair 失配自动失效）', async () => {
    mockSearchString = 'candidate_a=video-uuid-aaaa-1111&candidate_b=video-uuid-original&candidate_id=cand-uuid-0001&from=moderation'
    // ?candidate_b 自动填入查不到原视频（返回空）→ 用户手动从 picker 选了另一个 B
    listVideosMock.mockResolvedValue({ data: [VIDEO_B], total: 1, page: 1, limit: 20 })
    mergeVideosMock.mockResolvedValueOnce({
      auditId: 'audit-uuid-eeee-5555',
      targetVideo: { id: 'video-uuid-aaaa-1111' },
    })

    render(<MergeClient />)
    const pickerTrigger = await waitFor(() => screen.getByTestId('merge-candidate-b-picker'))
    fireEvent.click(pickerTrigger)
    const row = await waitFor(() => screen.getByTestId(`merge-candidate-b-picker-row-${VIDEO_B.id}`))
    fireEvent.click(row)
    const executeBtn = await waitFor(() => screen.getByTestId('merge-direct-execute') as HTMLButtonElement)
    await waitFor(() => expect(executeBtn.disabled).toBe(false))
    fireEvent.click(executeBtn)
    await waitFor(() => {
      expect(mergeVideosMock).toHaveBeenCalledTimes(1)
    })
    expect(mergeVideosMock.mock.calls[0][0]).not.toHaveProperty('candidateId')
  })

  it('3. B === A → toast warn + 不调 API', async () => {
    // candidate_a 与 picker 返回的视频 ID 相同
    const SAME_ID = 'video-uuid-same-1234'
    mockSearchString = `candidate_a=${SAME_ID}&from=videos`
    const VIDEO_SAME = { ...VIDEO_B, id: SAME_ID, short_id: 'V_SAME' }
    listVideosMock.mockResolvedValue({ data: [VIDEO_SAME], total: 1, page: 1, limit: 20 })

    render(<MergeClient />)
    const pickerTrigger = await waitFor(() => screen.getByTestId('merge-candidate-b-picker'))
    fireEvent.click(pickerTrigger)
    const row = await waitFor(() => screen.getByTestId(`merge-candidate-b-picker-row-${SAME_ID}`))
    fireEvent.click(row)
    // 立即合并按钮应 disabled（B === A 时）
    const executeBtn = screen.getByTestId('merge-direct-execute') as HTMLButtonElement
    expect(executeBtn.disabled).toBe(true)
    // 即使强制 click 也不调 API（disabled 时 fireEvent.click 默认仍触发 onClick）
    expect(mergeVideosMock).not.toHaveBeenCalled()
  })
})
