/**
 * merge-split-deeplink.test.tsx — CHG-363-B SPLIT-UI -B
 *
 * 范围：MergeSplitSection initialVideoId 自动加载（来自 MergeClient `?split=:videoId` 深链）
 *
 * 覆盖：
 *  1. 无 initialVideoId → 不自动加载（getVideoMatrix 不被调）/ 空 input
 *  2. 有 initialVideoId → 自动 setVideoIdInput + 调 getVideoMatrix(initialVideoId)
 *  3. initialVideoId 变更（同一 mount 复用场景）→ 重新自动加载
 *  4. 同一 initialVideoId 重渲染 → 不重复调（autoLoadedRef 防抖）
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

const getVideoMatrixMock = vi.fn()
const splitVideoMock = vi.fn()
const unmergeVideosMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/merge/api', () => ({
  splitVideo: (...args: unknown[]) => splitVideoMock(...args),
  unmergeVideos: (...args: unknown[]) => unmergeVideosMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  getVideoMatrix: (...args: unknown[]) => getVideoMatrixMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/app/admin/merge/_client/MergeClient', () => ({
  describeError: (e: unknown) => (e instanceof Error ? e.message : '未知'),
}))

const toastPushMock = vi.fn()
vi.mock('@resovo/admin-ui', async () => {
  const React = await import('react')
  return {
    AdminInput: (props: Record<string, unknown>) =>
      React.createElement('input', { ...props, 'data-testid': props['data-testid'] ?? 'admin-input' }),
    AdminButton: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) =>
      React.createElement(
        'button',
        { onClick, disabled, 'data-testid': 'admin-button' },
        children as React.ReactNode
      ),
    LoadingState: () => React.createElement('div', { 'data-testid': 'loading-state' }, 'loading'),
    ErrorState: ({ error }: { error: Error }) =>
      React.createElement('div', { 'data-testid': 'error-state' }, error.message),
    EmptyState: ({ title }: { title: string }) =>
      React.createElement('div', { 'data-testid': 'empty-state' }, title),
    useToast: () => ({ push: toastPushMock }),
  }
})

import { SplitSection } from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeSplitSection'

beforeEach(() => {
  getVideoMatrixMock.mockReset()
  splitVideoMock.mockReset()
  unmergeVideosMock.mockReset()
  toastPushMock.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('SplitSection — CHG-363-B initialVideoId 深链自动加载', () => {
  it('无 initialVideoId → 不自动加载 / input 为空 / getVideoMatrix 不被调', () => {
    render(<SplitSection />)
    expect(getVideoMatrixMock).not.toHaveBeenCalled()
    // EmptyState "尚未加载"
    expect(screen.getByTestId('empty-state')).toBeTruthy()
  })

  it('有 initialVideoId → 自动 setVideoIdInput + 调 getVideoMatrix(initialVideoId)', async () => {
    getVideoMatrixMock.mockResolvedValueOnce([
      {
        lineKey: 'L1',
        sourceName: 'L1',
        displayName: 'Line 1',
        episodes: [
          { sourceId: 's1', episodeNumber: 1, sourceUrl: 'https://example.com/1' },
        ],
      },
    ])
    render(<SplitSection initialVideoId="video-uuid-abc" />)
    await waitFor(() => expect(getVideoMatrixMock).toHaveBeenCalledWith('video-uuid-abc'))
    // input value 自动同步（initialVideoId 作为 useState 初始值）
    const input = screen.getAllByTestId('admin-input')[0] as HTMLInputElement
    expect(input.value).toBe('video-uuid-abc')
  })

  it('initialVideoId 变更（rerender）→ 重新自动加载', async () => {
    getVideoMatrixMock.mockResolvedValue([])
    const { rerender } = render(<SplitSection initialVideoId="video-1" />)
    await waitFor(() => expect(getVideoMatrixMock).toHaveBeenCalledWith('video-1'))
    getVideoMatrixMock.mockClear()
    rerender(<SplitSection initialVideoId="video-2" />)
    await waitFor(() => expect(getVideoMatrixMock).toHaveBeenCalledWith('video-2'))
  })

  it('同一 initialVideoId rerender → 不重复调 getVideoMatrix（autoLoadedRef 防抖）', async () => {
    getVideoMatrixMock.mockResolvedValue([])
    const { rerender } = render(<SplitSection initialVideoId="video-stable" />)
    await waitFor(() => expect(getVideoMatrixMock).toHaveBeenCalledTimes(1))
    rerender(<SplitSection initialVideoId="video-stable" />)
    rerender(<SplitSection initialVideoId="video-stable" />)
    // 仅 1 次调用（同 id rerender 不重复触发）
    expect(getVideoMatrixMock).toHaveBeenCalledTimes(1)
  })
})
