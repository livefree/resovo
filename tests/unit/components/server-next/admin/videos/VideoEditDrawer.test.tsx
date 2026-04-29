/**
 * VideoEditDrawer 单元测试（CHG-SN-3-07）
 *
 * 覆盖：
 * - 加载中显示 LoadingState
 * - 加载失败显示 ErrorState + 重试
 * - 提交：patchVideoMeta 被正确调用
 * - title 为空时阻止提交（submit button disabled）
 * - skippedFields 非空时保持 Drawer 开启并提示
 * - 成功时 onSaved + onClose 被调用
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ── mocks ─────────────────────────────────────────────────────────

vi.mock('@/lib/videos/api', () => ({
  getVideo: vi.fn(),
  patchVideoMeta: vi.fn(),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    Drawer: ({ open, children, title }: { open: boolean; children: React.ReactNode; title?: React.ReactNode }) =>
      open ? <div data-testid="drawer-stub"><div>{title}</div>{children}</div> : null,
  }
})

import * as videoApi from '@/lib/videos/api'
import { VideoEditDrawer } from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoEditDrawer'
import type { VideoAdminDetail } from '../../../../../../apps/server-next/src/lib/videos/types'

// ── helpers ───────────────────────────────────────────────────────

function makeVideo(overrides: Partial<VideoAdminDetail> = {}): VideoAdminDetail {
  return {
    id: 'v1',
    short_id: 'abc',
    title: '星际穿越',
    title_en: 'Interstellar',
    cover_url: null,
    type: 'movie',
    year: 2014,
    is_published: true,
    source_count: '1',
    description: '太空探索',
    genres: ['sci_fi'],
    country: 'US',
    episode_count: 0,
    status: 'completed',
    rating: 8.9,
    director: ['Christopher Nolan'],
    cast: ['Matthew McConaughey'],
    writers: ['Jonathan Nolan'],
    douban_id: '1234567',
    visibility_status: 'public',
    review_status: 'approved',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderDrawer(videoId = 'v1', onSaved = vi.fn(), onClose = vi.fn()) {
  return render(
    <VideoEditDrawer
      open={true}
      videoId={videoId}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )
}

// ── tests ─────────────────────────────────────────────────────────

describe('VideoEditDrawer — 加载状态', () => {
  it('加载中显示 spinner（aria-busy）', async () => {
    let resolveLoad!: (v: VideoAdminDetail) => void
    vi.mocked(videoApi.getVideo).mockReturnValue(new Promise((r) => { resolveLoad = r }))
    renderDrawer()
    expect(document.querySelector('[data-loading-state]')).toBeTruthy()
    await act(async () => { resolveLoad(makeVideo()) })
  })

  it('加载成功后显示表单', async () => {
    vi.mocked(videoApi.getVideo).mockResolvedValue(makeVideo())
    renderDrawer()
    await waitFor(() => expect(screen.getByTestId('edit-title')).toBeTruthy())
    expect((screen.getByTestId('edit-title') as HTMLInputElement).value).toBe('星际穿越')
  })

  it('加载失败显示 ErrorState', async () => {
    vi.mocked(videoApi.getVideo).mockRejectedValue(new Error('网络错误'))
    renderDrawer()
    await waitFor(() => expect(screen.getByText('加载失败')).toBeTruthy())
  })
})

describe('VideoEditDrawer — 提交逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(videoApi.getVideo).mockResolvedValue(makeVideo())
  })

  it('title 为空时 submit 按钮 disabled', async () => {
    renderDrawer()
    await waitFor(() => screen.getByTestId('edit-title'))
    const titleInput = screen.getByTestId('edit-title') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: '' } })
    const submitBtn = screen.getByTestId('data-video-edit-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
  })

  it('提交成功调用 onSaved + onClose', async () => {
    vi.mocked(videoApi.patchVideoMeta).mockResolvedValue({
      data: makeVideo() as never,
      skippedFields: [],
    })
    const onSaved = vi.fn()
    const onClose = vi.fn()
    renderDrawer('v1', onSaved, onClose)
    await waitFor(() => screen.getByTestId('edit-title'))
    fireEvent.change(screen.getByTestId('edit-title'), { target: { value: '星际穿越修改版' } })
    fireEvent.click(screen.getByTestId('data-video-edit-submit'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('无修改时点提交直接 onClose（跳过 API 调用）', async () => {
    const onClose = vi.fn()
    renderDrawer('v1', vi.fn(), onClose)
    await waitFor(() => screen.getByTestId('edit-title'))
    fireEvent.click(screen.getByTestId('data-video-edit-submit'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(videoApi.patchVideoMeta).not.toHaveBeenCalled()
  })
})

describe('VideoEditDrawer — skippedFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(videoApi.getVideo).mockResolvedValue(makeVideo())
  })

  it('skippedFields 非空时 Drawer 保持开启并显示提示', async () => {
    vi.mocked(videoApi.patchVideoMeta).mockResolvedValue({
      data: makeVideo() as never,
      skippedFields: ['title'],
    })
    const onSaved = vi.fn()
    const onClose = vi.fn()
    renderDrawer('v1', onSaved, onClose)
    await waitFor(() => screen.getByTestId('edit-title'))
    fireEvent.change(screen.getByTestId('edit-title'), { target: { value: '改了标题' } })
    fireEvent.click(screen.getByTestId('data-video-edit-submit'))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toContain('title')
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('VideoEditDrawer — 取消', () => {
  it('点取消调用 onClose', async () => {
    vi.mocked(videoApi.getVideo).mockResolvedValue(makeVideo())
    const onClose = vi.fn()
    renderDrawer('v1', vi.fn(), onClose)
    await waitFor(() => screen.getByTestId('data-video-edit-cancel'))
    fireEvent.click(screen.getByTestId('data-video-edit-cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
