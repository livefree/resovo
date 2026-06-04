/**
 * MergeCandidateBanner.test.tsx — CHG-SN-8-08 视频库 → Merge ?candidate_a 深链 banner
 * + CHG-VIR-13-A1 来源回链栏（merge-entry-source-bar）
 *
 * 范围（7 用例）：
 *  1. 无 ?candidate_a → 不渲染 banner
 *  2. 有 ?candidate_a → 渲染 banner 含短 ID；来源文案由回链栏承载（13-A1 迁移）
 *  3. 「清除」按钮 → router.replace 移除 candidate_a + from（保留其他 params）
 *  4. 无 from / from 非法值 → 不渲染回链栏
 *  5. from=videos → 回链栏渲染「来自视频库」
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

describe('MergeClient · ?candidate_a 深链 banner (CHG-SN-8-08)', () => {
  it('1. 无 ?candidate_a → 不渲染 banner', () => {
    mockSearchString = ''
    render(<MergeClient />)
    expect(screen.queryByTestId('merge-candidate-a-banner')).toBeNull()
  })

  it('2. ?candidate_a=xxxxxxxx&from=videos → 渲染 banner 含短 ID；来源文案由回链栏承载（13-A1）', () => {
    mockSearchString = 'candidate_a=video-uuid-aaaaaaaa-bbb&from=videos'
    render(<MergeClient />)
    const banner = screen.getByTestId('merge-candidate-a-banner')
    expect(banner).not.toBeNull()
    expect(banner.textContent).toContain('已锁定候选 A')
    expect(banner.textContent).toContain('video-uu')
    // CHG-VIR-13-A1：来源文案从 banner 迁至独立回链栏
    expect(screen.getByTestId('merge-entry-source-bar').textContent).toContain('来自视频库')
  })

  it('3. 「清除」按钮 → router.replace 移除 candidate_a + from', () => {
    mockSearchString = 'candidate_a=video-uuid&from=videos&tab=candidates'
    render(<MergeClient />)
    const clearBtn = screen.getByTestId('merge-candidate-a-clear')
    fireEvent.click(clearBtn)
    expect(routerReplaceMock).toHaveBeenCalledTimes(1)
    const newUrl = routerReplaceMock.mock.calls[0][0] as string
    expect(newUrl).not.toContain('candidate_a')
    expect(newUrl).not.toContain('from')
    // 保留 tab=candidates
    expect(newUrl).toContain('tab=candidates')
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
