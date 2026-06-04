/**
 * MergeCandidateBanner.test.tsx — ?candidate_a 深链升级映射（CHG-VIR-13-WS）
 * + CHG-VIR-13-A1 来源回链栏（merge-entry-source-bar）
 *
 * 历史：CHG-SN-8-08 candidate_a banner → 13-WS 废除（Direct/Batch 合一为 MergeWorkspace，
 * candidate_a 经升级映射推导 mode=merge 预填成员）。
 *
 * 范围（7 用例）：
 *  1. 无参数 → 默认 candidates，不渲染 merge-workspace
 *  2. ?candidate_a&from=videos → 升级映射 mode=merge + 工作区渲染；来源文案由回链栏承载
 *  3. 旧 banner（merge-candidate-a-banner）已废除——不再渲染（回归守卫）
 *  4. 无 from / from 非法值 → 不渲染回链栏
 *  5. from=moderation-batch → 回链栏渲染来源 label + 返回按钮文案
 *  6. 回链栏返回按钮 → router.push(backHref)
 *  7. 回链栏关闭 → router.replace 仅清 from（保留工作流参数）
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const routerReplaceMock = vi.fn()
const routerPushMock = vi.fn()
let mockSearchString = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => routerPushMock(...args),
    replace: (...args: unknown[]) => routerReplaceMock(...args),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(mockSearchString),
  usePathname: () => '/admin/merge',
}))

// mock listCandidates 等避免初始 fetch
vi.mock('../../../../../../apps/server-next/src/lib/merge/api', () => ({
  listCandidates: vi.fn(() => new Promise(() => {})), // 永不 resolve，避免污染断言
  mergeVideos: vi.fn(),
  unmergeVideos: vi.fn(),
}))

// CHG-VIR-13-WS：MergeWorkspace 深链预填消费 videoPickerFetcher → listVideos
vi.mock('../../../../../../apps/server-next/src/lib/videos/api', () => ({
  listVideos: vi.fn(() => Promise.resolve({ data: [], total: 0, page: 1, limit: 20 })),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: vi.fn(() => 'tid'),
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

import { MergeClient } from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeClient'

beforeEach(() => {
  routerReplaceMock.mockReset()
  routerPushMock.mockReset()
  mockSearchString = ''
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('MergeClient · ?candidate_a 深链升级映射 (CHG-VIR-13-WS)', () => {
  it('1. 无参数 → 默认 candidates，不渲染 merge-workspace', () => {
    mockSearchString = ''
    render(<MergeClient />)
    expect(screen.queryByTestId('merge-workspace')).toBeNull()
  })

  it('2. ?candidate_a&from=videos → 升级映射 mode=merge 渲染工作区；来源文案由回链栏承载', () => {
    mockSearchString = 'candidate_a=video-uuid-aaaaaaaa-bbb&from=videos'
    render(<MergeClient />)
    expect(screen.getByTestId('merge-workspace')).not.toBeNull()
    // CHG-VIR-13-A1：来源文案由独立回链栏承载
    expect(screen.getByTestId('merge-entry-source-bar').textContent).toContain('来自视频库')
  })

  it('3. 旧 candidate_a banner 已废除 → 不再渲染（13-WS 回归守卫）', () => {
    mockSearchString = 'candidate_a=video-uuid&from=videos'
    render(<MergeClient />)
    expect(screen.queryByTestId('merge-candidate-a-banner')).toBeNull()
    expect(screen.queryByTestId('merge-candidate-a-clear')).toBeNull()
  })
})

describe('MergeClient · 来源回链栏 (CHG-VIR-13-A1)', () => {
  it('4. 无 from / from 非法值 → 不渲染回链栏', () => {
    mockSearchString = ''
    const { unmount } = render(<MergeClient />)
    expect(screen.queryByTestId('merge-entry-source-bar')).toBeNull()
    unmount()
    mockSearchString = 'from=evil-source'
    render(<MergeClient />)
    expect(screen.queryByTestId('merge-entry-source-bar')).toBeNull()
  })

  it('5. from=moderation-batch → 回链栏渲染来源 label + 返回按钮文案', () => {
    mockSearchString = 'ids=a,b&from=moderation-batch'
    render(<MergeClient />)
    const bar = screen.getByTestId('merge-entry-source-bar')
    expect(bar.textContent).toContain('来自审核台批量操作')
    expect(screen.getByTestId('merge-entry-source-back').textContent).toContain('返回审核台')
  })

  it('6. 回链栏返回按钮 → router.push(backHref)', () => {
    mockSearchString = 'from=videos'
    render(<MergeClient />)
    fireEvent.click(screen.getByTestId('merge-entry-source-back'))
    expect(routerPushMock).toHaveBeenCalledWith('/admin/videos')
  })

  it('7. 回链栏关闭 → router.replace 仅清 from（保留工作流参数）', () => {
    // 用 candidate_a 作工作流参数（split= 会触发 SplitSection 自动 loadMatrix，本套件未 mock sources/api）
    mockSearchString = 'candidate_a=video-x&from=moderation'
    render(<MergeClient />)
    fireEvent.click(screen.getByTestId('merge-entry-source-dismiss'))
    expect(routerReplaceMock).toHaveBeenCalledTimes(1)
    const newUrl = routerReplaceMock.mock.calls[0][0] as string
    expect(newUrl).not.toContain('from')
    expect(newUrl).toContain('candidate_a=video-x')
  })
})
