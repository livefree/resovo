// @vitest-environment jsdom

/**
 * TabTmdb.test.tsx — 视频编辑抽屉 TMDB 来源关系区（ADR-202 / META-39-B）
 * 覆盖：mediaType 默认 / 搜索渲染候选 + fields 多选 / 确认调 api（mediaType + fields）/ 冲突 reason 友好文案。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

vi.mock('@/lib/videos/api', () => ({
  tmdbSearchForVideo: vi.fn(),
  tmdbConfirmForVideo: vi.fn(),
  tmdbRejectForVideo: vi.fn(),
}))

import { TabTmdb } from '@/app/admin/videos/_client/_videoEdit/TabTmdb'
import * as api from '@/lib/videos/api'
import type { VideoAdminDetail } from '@/lib/videos'

const VIDEO = { id: 'v1', type: 'movie', title: '千与千寻' } as unknown as VideoAdminDetail
const CAND = { tmdbId: 129, mediaType: 'movie' as const, title: '千与千寻', originalTitle: '千と千尋', originalLanguage: 'ja', year: '2001', overview: 'x', posterUrl: null }

async function doSearch(value = '千与千寻') {
  fireEvent.change(screen.getByTestId('tmdb-search-input'), { target: { value } })
  await act(async () => { fireEvent.click(screen.getByTestId('tmdb-search-btn')) })
  await screen.findByTestId('tmdb-candidates')
}

describe('TabTmdb', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mediaType 默认据 video.type（movie）', () => {
    render(<TabTmdb videoId="v1" video={VIDEO} onRefresh={vi.fn()} />)
    expect(screen.getByTestId('tmdb-mediatype-movie')).toBeTruthy()
    expect(screen.getByTestId('tmdb-mediatype-tv')).toBeTruthy()
  })

  it('搜索 → 渲染候选 + fields 多选（含 country，META-42）+ 透传 fallback title', async () => {
    vi.mocked(api.tmdbSearchForVideo).mockResolvedValue({ candidates: [CAND] })
    render(<TabTmdb videoId="v1" video={VIDEO} onRefresh={vi.fn()} />)
    await doSearch()
    expect(screen.getByTestId('tmdb-field-title')).toBeTruthy()
    expect(screen.getByTestId('tmdb-field-genres')).toBeTruthy()
    expect(screen.getByTestId('tmdb-field-country')).toBeTruthy()
    // META-43：图片字段 backdrop/logo（cover_url 已存在）
    expect(screen.getByTestId('tmdb-field-cover_url')).toBeTruthy()
    expect(screen.getByTestId('tmdb-field-backdrop')).toBeTruthy()
    expect(screen.getByTestId('tmdb-field-logo')).toBeTruthy()
    expect(api.tmdbSearchForVideo).toHaveBeenCalledWith('v1', expect.objectContaining({ mediaType: 'movie' }))
  })

  it('默认全选 → confirm fields 含 country（META-42）', async () => {
    vi.mocked(api.tmdbSearchForVideo).mockResolvedValue({ candidates: [CAND] })
    vi.mocked(api.tmdbConfirmForVideo).mockResolvedValue({ id: 'v1', confirmed: true, applied: ['country'] })
    render(<TabTmdb videoId="v1" video={VIDEO} onRefresh={vi.fn()} />)
    await doSearch()
    await act(async () => { fireEvent.click(screen.getAllByText('确认并应用')[0]) })
    const call = vi.mocked(api.tmdbConfirmForVideo).mock.calls[0][1]
    expect(call.fields).toContain('country')
  })

  it('确认候选 → confirm 调 api（mediaType + 选中 fields）+ onRefresh', async () => {
    vi.mocked(api.tmdbSearchForVideo).mockResolvedValue({ candidates: [CAND] })
    vi.mocked(api.tmdbConfirmForVideo).mockResolvedValue({ id: 'v1', confirmed: true, applied: ['title'] })
    const onRefresh = vi.fn()
    render(<TabTmdb videoId="v1" video={VIDEO} onRefresh={onRefresh} />)
    await doSearch()
    await act(async () => { fireEvent.click(screen.getAllByText('确认并应用')[0]) })
    expect(api.tmdbConfirmForVideo).toHaveBeenCalledWith('v1', expect.objectContaining({ tmdbId: 129, mediaType: 'movie' }))
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })

  it('取消勾选 title → confirm fields 不含 title', async () => {
    vi.mocked(api.tmdbSearchForVideo).mockResolvedValue({ candidates: [CAND] })
    vi.mocked(api.tmdbConfirmForVideo).mockResolvedValue({ id: 'v1', confirmed: true, applied: [] })
    render(<TabTmdb videoId="v1" video={VIDEO} onRefresh={vi.fn()} />)
    await doSearch()
    fireEvent.click(screen.getByTestId('tmdb-field-title'))
    await act(async () => { fireEvent.click(screen.getAllByText('确认并应用')[0]) })
    const call = vi.mocked(api.tmdbConfirmForVideo).mock.calls[0][1]
    expect(call.fields).not.toContain('title')
    expect(call.fields).toContain('genres')
  })

  it('冲突 reason → 友好文案', async () => {
    vi.mocked(api.tmdbSearchForVideo).mockResolvedValue({ candidates: [CAND] })
    vi.mocked(api.tmdbConfirmForVideo).mockRejectedValue(new Error('tmdb_exact_conflict'))
    render(<TabTmdb videoId="v1" video={VIDEO} onRefresh={vi.fn()} />)
    await doSearch()
    await act(async () => { fireEvent.click(screen.getAllByText('确认并应用')[0]) })
    const err = await screen.findByTestId('tmdb-action-error')
    expect(err.textContent).toContain('该 TMDB 条目已绑定到其他作品')
  })
})
