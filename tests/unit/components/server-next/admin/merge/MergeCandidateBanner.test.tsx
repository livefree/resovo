/**
 * MergeCandidateBanner.test.tsx — CHG-SN-8-08 视频库 → Merge ?candidate_a 深链 banner
 *
 * 范围（3 用例）：
 *  1. 无 ?candidate_a → 不渲染 banner
 *  2. 有 ?candidate_a → 渲染 banner 含短 ID + 来源文案
 *  3. 「清除」按钮 → router.replace 移除 candidate_a + from（保留其他 params）
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

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

  it('2. ?candidate_a=xxxxxxxx&from=videos → 渲染 banner 含短 ID + 来源文案', () => {
    mockSearchString = 'candidate_a=video-uuid-aaaaaaaa-bbb&from=videos'
    render(<MergeClient />)
    const banner = screen.getByTestId('merge-candidate-a-banner')
    expect(banner).not.toBeNull()
    expect(banner.textContent).toContain('已锁定候选 A')
    expect(banner.textContent).toContain('video-uu')
    expect(banner.textContent).toContain('来自视频库')
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
