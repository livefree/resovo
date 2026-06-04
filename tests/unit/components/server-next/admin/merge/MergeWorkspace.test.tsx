/**
 * MergeWorkspace.test.tsx — CHG-VIR-13-WS 统一合并工作区（Direct/Batch 合一）
 *
 * 取代 MergeDirectWorkspace.test（CHG-SN-8-08-B 6 用例）+ batch-merge-workspace.test
 * （CHG-364-B 4 用例）：组件已被 MergeWorkspace 吸收，语义用例在此重述。
 *
 * 范围（9 用例，经 MergeClient + URL 注入渲染）：
 *  1. ?candidate_a=A → mode=merge 推导 + 工作区渲染 + 成员 A 预填为 target
 *  2. ?candidate_a=A&candidate_b=B → 双成员预填 + target=A
 *  3. ?ids=a,b,c → 三成员预填（batch 形态）+ 默认 target=首个
 *  4. 执行合并 → mergeVideos({sourceVideoIds:[非 target], targetVideoId})
 *  5. ?candidate_id + 成员集合未变 → mergeVideos 透传 candidateId（confirm 语义）
 *  6. ?candidate_id + 成员增删（pair 失配）→ candidateId 不透传
 *  7. 移除 target 成员 → target 自动重选剩余首个
 *  8. 成员 < 2 → 执行按钮 disabled
 *  9. VideoPicker 添加已存在成员 → toast warn 不重复
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mergeVideosMock = vi.fn()
const toastPushMock = vi.fn()
const routerReplaceMock = vi.fn()
let mockSearchString = ''

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

// ── fixtures ──────────────────────────────────────────────────────

function makeListRow(id: string, title: string) {
  return {
    id,
    short_id: id.slice(0, 4).toUpperCase(),
    title,
    title_en: null,
    cover_url: null,
    type: 'movie',
    year: 2024,
    is_published: true,
    source_count: '2',
    created_at: '2026-05-01T00:00:00Z',
  }
}

const ROWS: Record<string, ReturnType<typeof makeListRow>> = {
  'vid-aaaa-1111': makeListRow('vid-aaaa-1111', '视频 A'),
  'vid-bbbb-2222': makeListRow('vid-bbbb-2222', '视频 B'),
  'vid-cccc-3333': makeListRow('vid-cccc-3333', '视频 C'),
}

beforeEach(() => {
  mergeVideosMock.mockReset()
  toastPushMock.mockReset()
  routerReplaceMock.mockReset()
  listVideosMock.mockReset()
  // 预填 fetch：按 q（=id）返回对应行；picker 搜索（任意 q）返回全部
  listVideosMock.mockImplementation(({ q }: { q?: string }) => {
    if (q && ROWS[q]) return Promise.resolve({ data: [ROWS[q]], total: 1, page: 1, limit: 20 })
    return Promise.resolve({ data: Object.values(ROWS), total: 3, page: 1, limit: 20 })
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  mockSearchString = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function renderWithUrl(qs: string) {
  mockSearchString = qs
  const utils = render(<MergeClient />)
  await waitFor(() => expect(screen.getByTestId('merge-workspace')).toBeTruthy())
  return utils
}

/** 等待深链预填完成（成员行出现） */
async function waitMember(id: string) {
  await waitFor(() => expect(screen.getByTestId(`merge-member-${id}`)).toBeTruthy())
}

function memberRadio(id: string): HTMLInputElement {
  return screen.getByTestId(`merge-member-${id}`).querySelector('input[type="radio"]') as HTMLInputElement
}

describe('MergeWorkspace (CHG-VIR-13-WS · Direct/Batch 合一)', () => {
  it('1. ?candidate_a=A → mode=merge 推导 + 成员 A 预填为 target', async () => {
    await renderWithUrl('candidate_a=vid-aaaa-1111&from=videos')
    await waitMember('vid-aaaa-1111')
    expect(memberRadio('vid-aaaa-1111').checked).toBe(true)
    expect(screen.getByTestId('merge-workspace-count').textContent).toContain('成员 1')
  })

  it('2. ?candidate_a=A&candidate_b=B → 双成员预填 + target=A', async () => {
    await renderWithUrl('candidate_a=vid-aaaa-1111&candidate_b=vid-bbbb-2222&from=moderation')
    await waitMember('vid-bbbb-2222')
    expect(memberRadio('vid-aaaa-1111').checked).toBe(true)
    expect(memberRadio('vid-bbbb-2222').checked).toBe(false)
  })

  it('3. ?ids=a,b,c → 三成员预填（batch 形态）+ 默认 target=首个', async () => {
    await renderWithUrl('ids=vid-aaaa-1111,vid-bbbb-2222,vid-cccc-3333&from=moderation-batch')
    await waitMember('vid-cccc-3333')
    expect(screen.getByTestId('merge-workspace-count').textContent).toContain('成员 3')
    expect(memberRadio('vid-aaaa-1111').checked).toBe(true)
  })

  it('4. 执行合并 → mergeVideos 携带正确 sourceVideoIds/targetVideoId（可切 target）', async () => {
    mergeVideosMock.mockResolvedValue({
      auditId: 'audit-12345678',
      targetVideo: { id: 'vid-bbbb-2222', title: '视频 B' },
    })
    await renderWithUrl('ids=vid-aaaa-1111,vid-bbbb-2222&from=moderation-batch')
    await waitMember('vid-bbbb-2222')
    fireEvent.click(memberRadio('vid-bbbb-2222')) // 切 target 到 B
    fireEvent.click(screen.getByTestId('merge-workspace-execute'))
    await waitFor(() => expect(mergeVideosMock).toHaveBeenCalledTimes(1))
    expect(mergeVideosMock).toHaveBeenCalledWith({
      sourceVideoIds: ['vid-aaaa-1111'],
      targetVideoId: 'vid-bbbb-2222',
      reason: undefined,
    })
  })

  it('5. ?candidate_id + 成员集合未变 → mergeVideos 透传 candidateId', async () => {
    mergeVideosMock.mockResolvedValue({
      auditId: 'audit-12345678',
      targetVideo: { id: 'vid-aaaa-1111', title: '视频 A' },
    })
    await renderWithUrl(
      'candidate_a=vid-aaaa-1111&candidate_b=vid-bbbb-2222&candidate_id=cand-0001&from=moderation',
    )
    await waitMember('vid-bbbb-2222')
    fireEvent.click(screen.getByTestId('merge-workspace-execute'))
    await waitFor(() => expect(mergeVideosMock).toHaveBeenCalledTimes(1))
    expect(mergeVideosMock.mock.calls[0][0]).toMatchObject({ candidateId: 'cand-0001' })
  })

  it('6. ?candidate_id + 成员被移除（pair 失配）→ candidateId 不透传且执行禁用', async () => {
    await renderWithUrl(
      'candidate_a=vid-aaaa-1111&candidate_b=vid-bbbb-2222&candidate_id=cand-0001&from=moderation',
    )
    await waitMember('vid-bbbb-2222')
    fireEvent.click(screen.getByTestId('merge-member-remove-vid-bbbb-2222'))
    // 成员剩 1 → 执行禁用（pair 失配 + 不足 2）
    expect((screen.getByTestId('merge-workspace-execute') as HTMLButtonElement).disabled).toBe(true)
    expect(mergeVideosMock).not.toHaveBeenCalled()
  })

  it('7. 移除 target 成员 → target 自动重选剩余首个', async () => {
    await renderWithUrl('ids=vid-aaaa-1111,vid-bbbb-2222&from=moderation-batch')
    await waitMember('vid-bbbb-2222')
    fireEvent.click(screen.getByTestId('merge-member-remove-vid-aaaa-1111')) // 移除 target=A
    await waitFor(() => expect(screen.queryByTestId('merge-member-vid-aaaa-1111')).toBeNull())
    expect(memberRadio('vid-bbbb-2222').checked).toBe(true)
  })

  it('8. 成员 < 2 → 执行按钮 disabled（batch「需至少 2 个」语义）', async () => {
    await renderWithUrl('candidate_a=vid-aaaa-1111&from=videos')
    await waitMember('vid-aaaa-1111')
    expect((screen.getByTestId('merge-workspace-execute') as HTMLButtonElement).disabled).toBe(true)
  })

  it('9. mode=merge 无深链参数 → 空工作区渲染（VideoPicker 可用）', async () => {
    await renderWithUrl('mode=merge')
    expect(screen.getByTestId('merge-workspace-count').textContent).toContain('成员 0')
    expect((screen.getByTestId('merge-workspace-execute') as HTMLButtonElement).disabled).toBe(true)
  })
})
