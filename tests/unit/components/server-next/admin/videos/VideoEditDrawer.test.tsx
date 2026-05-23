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
  // CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B / ADR-145：创建模式新增
  createVideo: vi.fn(),
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

function renderDrawer(videoId: string | null = 'v1', onSaved = vi.fn(), onClose = vi.fn()) {
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

// CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B / ADR-145：创建模式（videoId=null）
describe('VideoEditDrawer — 创建模式 (ADR-145)', () => {
  beforeEach(() => {
    vi.mocked(videoApi.getVideo).mockClear()
    vi.mocked(videoApi.createVideo).mockClear()
  })

  it('videoId=null → 渲染「+ 添加视频」header + 「创建视频」按钮 + 不调 getVideo', async () => {
    renderDrawer(null)
    await waitFor(() => screen.getByText('+ 添加视频'))
    // 不调 getVideo（创建模式跳过 fetch）
    expect(vi.mocked(videoApi.getVideo)).not.toHaveBeenCalled()
    // 提交按钮文案
    const btn = await waitFor(() => screen.getByTestId('data-video-edit-submit'))
    expect(btn.textContent).toBe('创建视频')
  })

  it('videoId=null + title 填写 → 提交调 createVideo + onSaved + onClose', async () => {
    vi.mocked(videoApi.createVideo).mockResolvedValue({
      id: 'new-1', shortId: 'aB3', title: '新视频', type: 'movie',
      catalogId: 'cat-1', reviewStatus: 'pending_review',
      visibilityStatus: 'internal', isPublished: false,
      createdAt: '2026-05-22T20:00:00.000Z',
    })
    const onSaved = vi.fn()
    const onClose = vi.fn()
    renderDrawer(null, onSaved, onClose)
    await waitFor(() => screen.getByTestId('data-video-edit-submit'))
    // 填写 title（找 input by 占位符或 label）
    const titleInputs = document.querySelectorAll('input')
    const titleInput = Array.from(titleInputs).find((i) => i.name === 'title' || i.getAttribute('data-field') === 'title') ?? titleInputs[0]
    if (titleInput) {
      fireEvent.change(titleInput, { target: { value: '新视频' } })
    }
    const btn = screen.getByTestId('data-video-edit-submit') as HTMLButtonElement
    await act(async () => { fireEvent.click(btn) })
    await waitFor(() => {
      expect(vi.mocked(videoApi.createVideo)).toHaveBeenCalled()
    })
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('videoId=null → 非 basic tab 按钮 disabled（lines/images/douban 需先创建）', async () => {
    renderDrawer(null)
    await waitFor(() => screen.getByText('+ 添加视频'))
    const tabBtns = document.querySelectorAll('[role="tab"]')
    expect(tabBtns.length).toBeGreaterThanOrEqual(4)
    // basic 不 disabled / 其他 disabled
    const basicBtn = Array.from(tabBtns).find((b) => b.textContent?.includes('基础信息'))!
    const linesBtn = Array.from(tabBtns).find((b) => b.textContent?.includes('线路管理'))!
    expect(basicBtn.hasAttribute('disabled')).toBe(false)
    expect(linesBtn.hasAttribute('disabled')).toBe(true)
  })
})
