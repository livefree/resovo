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
  // META-35：元数据 tab 内复用 TabDouban（useDoubanTab → 下列 api）。默认 resolve 防 effect 抛错。
  searchDoubanForVideo: vi.fn().mockResolvedValue({ candidates: [] }),
  confirmDoubanMatch: vi.fn().mockResolvedValue(undefined),
  ignoreDoubanMatch: vi.fn().mockResolvedValue(undefined),
  getDoubanCandidate: vi.fn().mockResolvedValue(null),
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
import { normalizeTabKey } from '../../../../../../apps/server-next/src/app/admin/videos/_client/_videoEdit/types'
import type { TabKey } from '../../../../../../apps/server-next/src/app/admin/videos/_client/_videoEdit/types'
import type { VideoAdminDetail } from '../../../../../../apps/server-next/src/lib/videos/types'
import type { MetadataProvider, MetadataProviderStatus, MetadataStatusSummary } from '@resovo/types'

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

// META-35：构造合法 MetadataStatusSummary（四 provider key 恒在）供「元数据」tab 测试。
function pstatus(provider: MetadataProvider, state: MetadataProviderStatus['state'] = 'missing'): MetadataProviderStatus {
  return {
    provider, state, issueLevel: 'none', externalId: null, label: null,
    confidence: null, matchMethod: null, appliedAt: null, fetchedAt: null,
    reasonCodes: [], tooltipLines: [],
  }
}

function makeMetadataStatus(overrides: Partial<MetadataStatusSummary> = {}): MetadataStatusSummary {
  return {
    overall: 'partial', issueLevel: 'none', score: 72, enrichedAt: '2026-06-10T00:00:00Z',
    primaryProvider: 'douban',
    providers: {
      douban: pstatus('douban', 'applied'),
      bangumi: pstatus('bangumi'),
      tmdb: pstatus('tmdb'),
      imdb: pstatus('imdb'),
    },
    issues: [],
    nextAction: 'none',
    sort: { statusRank: 4, issueRank: 0, scoreRank: 72, updatedAt: '2026-06-10T00:00:00Z' },
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

  it('videoId=null → 非 basic tab 按钮 disabled（lines/images/metadata 需先创建）', async () => {
    renderDrawer(null)
    await waitFor(() => screen.getByText('+ 添加视频'))
    const tabBtns = document.querySelectorAll('[role="tab"]')
    // META-35：5 tab → 4 tab（去 douban/external，合并 metadata）
    expect(tabBtns.length).toBe(4)
    // basic 不 disabled / 其他 disabled
    const basicBtn = Array.from(tabBtns).find((b) => b.textContent?.includes('基础信息'))!
    const linesBtn = Array.from(tabBtns).find((b) => b.textContent?.includes('线路管理'))!
    const metaBtn = Array.from(tabBtns).find((b) => b.textContent?.includes('元数据'))!
    expect(basicBtn.hasAttribute('disabled')).toBe(false)
    expect(linesBtn.hasAttribute('disabled')).toBe(true)
    expect(metaBtn.hasAttribute('disabled')).toBe(true)
  })
})

// META-35：视频编辑抽屉去 Douban 独占 tab + 元数据状态整合（ADR-201 §视频编辑抽屉）
describe('VideoEditDrawer — META-35 元数据 tab IA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tab 列表去 douban/external，仅 4 tab 且含「元数据」', async () => {
    vi.mocked(videoApi.getVideo).mockResolvedValue(makeVideo({ metadataStatus: makeMetadataStatus() }))
    renderDrawer()
    await waitFor(() => screen.getByTestId('edit-title'))
    const labels = Array.from(document.querySelectorAll('[role="tab"]')).map((b) => b.textContent)
    expect(labels).toEqual(['基础信息', '线路管理', '图片素材', '元数据'])
    expect(screen.queryByText('豆瓣·元数据')).toBeNull()
    expect(screen.queryByText('外部元数据')).toBeNull()
  })

  it('initialTab=metadata → 渲染 MetadataStatusPanel + Douban 来源关系区', async () => {
    vi.mocked(videoApi.getVideo).mockResolvedValue(makeVideo({ metadataStatus: makeMetadataStatus() }))
    render(
      <VideoEditDrawer open videoId="v1" initialTab="metadata" onClose={vi.fn()} onSaved={vi.fn()} />,
    )
    await waitFor(() => screen.getByTestId('data-video-tab-metadata'))
    // 统一状态面板（META-33-B 原语，纯展示）
    expect(screen.getByTestId('data-video-metadata-status')).toBeTruthy()
    // Douban 富交互区保留（零回归）
    expect(screen.getByText('Douban 来源关系')).toBeTruthy()
  })

  it('metadataStatus 缺失 → 兜底文案，不渲染 panel，但 Douban 区仍在', async () => {
    vi.mocked(videoApi.getVideo).mockResolvedValue(makeVideo({ metadataStatus: undefined }))
    render(
      <VideoEditDrawer open videoId="v1" initialTab="metadata" onClose={vi.fn()} onSaved={vi.fn()} />,
    )
    await waitFor(() => screen.getByTestId('data-video-tab-metadata'))
    expect(screen.getByTestId('data-video-metadata-empty')).toBeTruthy()
    expect(screen.queryByTestId('data-video-metadata-status')).toBeNull()
    expect(screen.getByText('Douban 来源关系')).toBeTruthy()
  })

  it('旧深链 initialTab=douban / external 经 normalizeTabKey 落到 metadata tab', async () => {
    vi.mocked(videoApi.getVideo).mockResolvedValue(makeVideo({ metadataStatus: makeMetadataStatus() }))
    // 运行时兼容路径（旧 URL / 外部入口可能传 cast 值）
    render(
      <VideoEditDrawer open videoId="v1" initialTab={'douban' as unknown as TabKey} onClose={vi.fn()} onSaved={vi.fn()} />,
    )
    await waitFor(() => screen.getByTestId('data-video-tab-metadata'))
    const metaTab = Array.from(document.querySelectorAll('[role="tab"]')).find((b) => b.textContent === '元数据')!
    expect(metaTab.getAttribute('aria-selected')).toBe('true')
  })
})

describe('normalizeTabKey（META-35 旧深链兼容）', () => {
  it('douban / external → metadata；其余原样；undefined 透传', () => {
    expect(normalizeTabKey('douban')).toBe('metadata')
    expect(normalizeTabKey('external')).toBe('metadata')
    expect(normalizeTabKey('metadata')).toBe('metadata')
    expect(normalizeTabKey('basic')).toBe('basic')
    expect(normalizeTabKey('lines')).toBe('lines')
    expect(normalizeTabKey('images')).toBe('images')
    expect(normalizeTabKey(undefined)).toBeUndefined()
  })
})
