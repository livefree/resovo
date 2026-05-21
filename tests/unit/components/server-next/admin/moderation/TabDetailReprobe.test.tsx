/**
 * TabDetailReprobe.test.tsx — CHG-SN-8-05 审核台 RightPane 批量重测
 *
 * 真源：apps/server-next/src/app/admin/moderation/_client/RightPane/TabDetail.tsx
 *
 * 范围（4 用例）：
 *  1. 按钮渲染
 *  2. 点击 → listVideoSources + reprobeRoute 调用（去重 site+name）
 *  3. 部分失败 → warn toast
 *  4. listVideoSources throw → danger toast
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listVideoSourcesMock = vi.fn()
const reprobeRouteMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/videos/api', () => ({
  listVideoSources: (...args: unknown[]) => listVideoSourcesMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  reprobeRoute: (...args: unknown[]) => reprobeRouteMock(...args),
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

import { TabDetail } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/RightPane/TabDetail'

const VIDEO_FIXTURE = {
  id: 'video-uuid-aaaa',
  title: 'X',
  shortId: 'V001',
  type: 'movie',
  year: 2020,
  country: 'US',
  episodeCount: 1,
  metaScore: 80,
  sourceCheckStatus: 'pending',
  doubanStatus: 'pending',
  isPublished: false,
  visibilityStatus: 'private',
  reviewStatus: 'pending',
} as unknown as Parameters<typeof TabDetail>[0]['v']

beforeEach(() => {
  listVideoSourcesMock.mockReset()
  reprobeRouteMock.mockReset()
  toastPushMock.mockReset()
})

describe('TabDetail · 批量重测线路 (CHG-SN-8-05)', () => {
  it('1. 按钮渲染', () => {
    render(<TabDetail v={VIDEO_FIXTURE} />)
    expect(screen.getByTestId('moderation-detail-reprobe-all')).not.toBeNull()
  })

  it('2. 点击 → listVideoSources + reprobeRoute（同一线路去重）+ success toast', async () => {
    listVideoSourcesMock.mockResolvedValueOnce([
      { source_site_key: 'jszy', source_name: 'lineA', site_key: null } as unknown,
      { source_site_key: 'jszy', source_name: 'lineA', site_key: null } as unknown, // 同一线路重复（多集场景）
      { source_site_key: 'youzy', source_name: 'lineB', site_key: null } as unknown,
    ])
    reprobeRouteMock.mockResolvedValue({ ok: true })
    render(<TabDetail v={VIDEO_FIXTURE} />)
    fireEvent.click(screen.getByTestId('moderation-detail-reprobe-all'))
    await waitFor(() => {
      // 去重后只调 2 次（lineA / lineB）
      expect(reprobeRouteMock).toHaveBeenCalledTimes(2)
      expect(reprobeRouteMock).toHaveBeenCalledWith('jszy', 'lineA')
      expect(reprobeRouteMock).toHaveBeenCalledWith('youzy', 'lineB')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已重测全部线路' }),
      )
    })
  })

  it('3. 部分失败 → warn toast 含成功/失败计数', async () => {
    listVideoSourcesMock.mockResolvedValueOnce([
      { source_site_key: 'jszy', source_name: 'lineA' } as unknown,
      { source_site_key: 'youzy', source_name: 'lineB' } as unknown,
    ])
    reprobeRouteMock.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('429'))
    render(<TabDetail v={VIDEO_FIXTURE} />)
    fireEvent.click(screen.getByTestId('moderation-detail-reprobe-all'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          title: '部分重测失败',
          description: expect.stringContaining('成功 1 / 失败 1'),
        }),
      )
    })
  })

  it('4. listVideoSources throw → danger toast', async () => {
    listVideoSourcesMock.mockRejectedValueOnce(new Error('网络 500'))
    render(<TabDetail v={VIDEO_FIXTURE} />)
    fireEvent.click(screen.getByTestId('moderation-detail-reprobe-all'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'danger', title: '重测失败' }),
      )
    })
    expect(reprobeRouteMock).not.toHaveBeenCalled()
  })
})
