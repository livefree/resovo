/**
 * merge-split-deeplink.test.tsx — CHG-363-B SPLIT-UI -B / CHG-VIR-13-B2B 改造跟随
 *
 * 范围：SplitWorkspace（原 MergeSplitSection，13-B2B 重命名 + VideoPicker 化）
 * initialVideoId 自动加载（来自 MergeClient `?split=:videoId` 深链）
 *
 * 覆盖：
 *  1. 无 initialVideoId → 不自动加载（getVideoMatrix 不被调）/ EmptyState
 *  2. 有 initialVideoId → 自动调 getVideoMatrix(initialVideoId) + 标题充实 fetch
 *  3. initialVideoId 变更（同一 mount 复用场景）→ 重新自动加载
 *  4. 同一 initialVideoId 重渲染 → 不重复调（autoLoadedRef 防抖）
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

const getVideoMatrixMock = vi.fn()
const splitVideoMock = vi.fn()
const unmergeVideosMock = vi.fn()
const pickerFetcherMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/merge/api', () => ({
  splitVideo: (...args: unknown[]) => splitVideoMock(...args),
  unmergeVideos: (...args: unknown[]) => unmergeVideosMock(...args),
  getSplitSuggestions: vi.fn(),
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  getVideoMatrix: (...args: unknown[]) => getVideoMatrixMock(...args),
}))

// CHG-VIR-13-B2B：SplitWorkspace 消费 videoPickerFetcher（深链标题充实 + 两处 VideoPicker）
vi.mock('../../../../../../apps/server-next/src/lib/videos/picker-fetcher', () => ({
  videoPickerFetcher: (...args: unknown[]) => pickerFetcherMock(...args),
  // CHG-VIR-13-FIX-PREFILL：深链标题充实改 by-id；复用 pickerFetcherMock 作为统一注入点
  fetchPickerItemByIdSafe: async (id: string) => {
    const res = await pickerFetcherMock({ q: id, limit: 1 })
    return res?.items?.find((it: { id: string }) => it.id === id) ?? null
  },
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
    // CHG-VIR-13-B2B：VideoPicker stub（拆分对象 + 拆到已有 ×N；交互测试归 MergeWorkspace.test 真组件路径）
    VideoPicker: ({ label }: { label?: string }) =>
      React.createElement('div', { 'data-testid': 'video-picker-stub' }, label ?? 'picker'),
    // CHG-VIR-13-PLAY：Drawer stub（SplitWorkspace 渲染 PlayPreviewDrawer；open=false 不渲染）
    Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? React.createElement('div', { 'data-testid': 'drawer-stub' }, children as React.ReactNode) : null,
    LoadingState: () => React.createElement('div', { 'data-testid': 'loading-state' }, 'loading'),
    ErrorState: ({ error }: { error: Error }) =>
      React.createElement('div', { 'data-testid': 'error-state' }, error.message),
    EmptyState: ({ title }: { title: string }) =>
      React.createElement('div', { 'data-testid': 'empty-state' }, title),
    useToast: () => ({ push: toastPushMock }),
  }
})

import { SplitWorkspace } from '../../../../../../apps/server-next/src/app/admin/merge/_client/SplitWorkspace'

beforeEach(() => {
  getVideoMatrixMock.mockReset()
  splitVideoMock.mockReset()
  unmergeVideosMock.mockReset()
  toastPushMock.mockReset()
  pickerFetcherMock.mockReset()
  pickerFetcherMock.mockResolvedValue({ items: [], total: 0 })
})

afterEach(() => {
  cleanup()
})

describe('SplitWorkspace — CHG-363-B initialVideoId 深链自动加载（13-B2B 重命名跟随）', () => {
  it('无 initialVideoId → 不自动加载 / EmptyState / getVideoMatrix 不被调', () => {
    render(<SplitWorkspace />)
    expect(getVideoMatrixMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('empty-state')).toBeTruthy()
    // 拆分对象 VideoPicker 渲染（手输 uuid 输入框已消除）
    expect(screen.getAllByTestId('video-picker-stub').length).toBeGreaterThan(0)
  })

  it('有 initialVideoId → 自动调 getVideoMatrix + 标题充实 fetch（13-B2B）', async () => {
    getVideoMatrixMock.mockResolvedValueOnce([
      {
        sourceSiteKey: 'siteA',
        sourceName: 'L1',
        displayName: 'Line 1',
        episodes: [
          { sourceId: 's1', episodeNumber: 1, sourceUrl: 'https://example.com/1' },
        ],
      },
    ])
    render(<SplitWorkspace initialVideoId="video-uuid-abc" />)
    await waitFor(() => expect(getVideoMatrixMock).toHaveBeenCalledWith('video-uuid-abc'))
    // 13-B2B：深链补 fetch 标题注入 picker（软删明示文案消费）
    await waitFor(() => expect(pickerFetcherMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'video-uuid-abc' }),
    ))
  })

  it('initialVideoId 变更（rerender）→ 重新自动加载', async () => {
    getVideoMatrixMock.mockResolvedValue([])
    const { rerender } = render(<SplitWorkspace initialVideoId="video-1" />)
    await waitFor(() => expect(getVideoMatrixMock).toHaveBeenCalledWith('video-1'))
    getVideoMatrixMock.mockClear()
    rerender(<SplitWorkspace initialVideoId="video-2" />)
    await waitFor(() => expect(getVideoMatrixMock).toHaveBeenCalledWith('video-2'))
  })

  it('同一 initialVideoId rerender → 不重复调 getVideoMatrix（autoLoadedRef 防抖）', async () => {
    getVideoMatrixMock.mockResolvedValue([])
    const { rerender } = render(<SplitWorkspace initialVideoId="video-stable" />)
    await waitFor(() => expect(getVideoMatrixMock).toHaveBeenCalledTimes(1))
    rerender(<SplitWorkspace initialVideoId="video-stable" />)
    rerender(<SplitWorkspace initialVideoId="video-stable" />)
    // 仅 1 次调用（同 id rerender 不重复触发）
    expect(getVideoMatrixMock).toHaveBeenCalledTimes(1)
  })

  // ── CHG-VIR-13-D2 / D-105-9（§10.1 裁定 #1）：新建组状态设置 ──────────────

  it('选「直接通过」组 0 → splitVideo newVideoMeta 携带 status；默认组 1 不带（R-105-T1）', async () => {
    const { fireEvent } = await import('@testing-library/react')
    getVideoMatrixMock.mockResolvedValueOnce([
      {
        sourceSiteKey: 'siteA',
        sourceName: 'L1',
        displayName: 'Line 1',
        episodes: [
          { sourceId: 's1', episodeNumber: 1, sourceUrl: 'https://example.com/1' },
          { sourceId: 's2', episodeNumber: 2, sourceUrl: 'https://example.com/2' },
        ],
      },
    ])
    splitVideoMock.mockResolvedValueOnce({
      auditId: 'audit-split-d2',
      newVideoIds: ['nv-1', 'nv-2'],
      statusTransition: [{ videoId: 'nv-1', result: 'applied' }],
    })
    const { container } = render(<SplitWorkspace initialVideoId="video-uuid-abc" />)
    await waitFor(() => screen.getByTestId('split-status-control-0'))

    // 组 0 选「直接通过（内部可见）」（SPLIT_STATUS_OPTIONS / approve 单步）
    fireEvent.change(
      screen.getByTestId('split-status-control-0-select') as HTMLSelectElement,
      { target: { value: 'approved|internal' } },
    )
    // s2 分到组 1（分配表行内 select = <table> 内第 2 个；组 meta 的类型 select 在表外）
    const assignSelects = container.querySelectorAll('table select')
    fireEvent.change(assignSelects[1]!, { target: { value: '1' } })

    fireEvent.click(screen.getByText(/执行拆分/))
    await waitFor(() => expect(splitVideoMock).toHaveBeenCalledTimes(1))
    const { groups } = splitVideoMock.mock.calls[0]![0] as {
      groups: { newVideoMeta?: { status?: unknown } }[]
    }
    expect(groups[0]!.newVideoMeta!.status).toEqual({ reviewStatus: 'approved', visibilityStatus: 'internal' })
    // 组 1 未选 → newVideoMeta 不带 status 字段（前端侧零字段）
    expect(groups[1]!.newVideoMeta).not.toHaveProperty('status')
  })
})
