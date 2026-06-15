// @vitest-environment jsdom

/**
 * use-tmdb.test.ts — useTmdbTab hook 单元测试（ADR-202 / META-39-B）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../../../../apps/server-next/src/lib/videos/api', () => ({
  tmdbSearchForVideo: vi.fn(),
  tmdbConfirmForVideo: vi.fn(),
  tmdbRejectForVideo: vi.fn(),
}))

import * as api from '../../../../../apps/server-next/src/lib/videos/api'
import { useTmdbTab } from '../../../../../apps/server-next/src/lib/videos/use-tmdb'
import type { TmdbCandidate } from '../../../../../apps/server-next/src/lib/videos/use-tmdb'

const CAND: TmdbCandidate = {
  tmdbId: 129, mediaType: 'movie', title: '千与千寻', originalTitle: '千と千尋',
  originalLanguage: 'ja', year: '2001', overview: 'x', posterUrl: null,
}

describe('useTmdbTab', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('search 填充候选 + 透传 query/mediaType/year', async () => {
    vi.mocked(api.tmdbSearchForVideo).mockResolvedValue({ candidates: [CAND] })
    const { result } = renderHook(() => useTmdbTab('v1', vi.fn()))
    await act(async () => { await result.current[1].search('q', 'movie', 2001) })
    expect(result.current[0].searchResults).toHaveLength(1)
    expect(api.tmdbSearchForVideo).toHaveBeenCalledWith('v1', { query: 'q', mediaType: 'movie', year: 2001 })
  })

  it('search 失败 → searchError', async () => {
    vi.mocked(api.tmdbSearchForVideo).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useTmdbTab('v1', vi.fn()))
    await act(async () => { await result.current[1].search('q', 'tv') })
    expect(result.current[0].searchError).toBe('boom')
  })

  it('confirm 成功 → onConfirmed + 清空候选 + 返回 true', async () => {
    vi.mocked(api.tmdbSearchForVideo).mockResolvedValue({ candidates: [CAND] })
    vi.mocked(api.tmdbConfirmForVideo).mockResolvedValue({ id: 'v1', confirmed: true, applied: ['title'] })
    const onConfirmed = vi.fn()
    const { result } = renderHook(() => useTmdbTab('v1', onConfirmed))
    await act(async () => { await result.current[1].search('q', 'movie') })
    let ok: boolean | undefined
    await act(async () => { ok = await result.current[1].confirm(129, 'movie', ['title']) })
    expect(ok).toBe(true)
    expect(onConfirmed).toHaveBeenCalled()
    expect(result.current[0].searchResults).toHaveLength(0)
    expect(api.tmdbConfirmForVideo).toHaveBeenCalledWith('v1', { tmdbId: 129, mediaType: 'movie', seasonNumber: undefined, fields: ['title'] })
  })

  it('confirm 冲突 → actionError=reason + 返回 false', async () => {
    vi.mocked(api.tmdbConfirmForVideo).mockRejectedValue(new Error('tmdb_exact_conflict'))
    const { result } = renderHook(() => useTmdbTab('v1', vi.fn()))
    let ok: boolean | undefined
    await act(async () => { ok = await result.current[1].confirm(129, 'movie', ['title']) })
    expect(ok).toBe(false)
    expect(result.current[0].actionError).toBe('tmdb_exact_conflict')
  })

  it('reject 移除对应候选', async () => {
    vi.mocked(api.tmdbSearchForVideo).mockResolvedValue({ candidates: [CAND, { ...CAND, tmdbId: 200 }] })
    vi.mocked(api.tmdbRejectForVideo).mockResolvedValue(undefined)
    const { result } = renderHook(() => useTmdbTab('v1', vi.fn()))
    await act(async () => { await result.current[1].search('q', 'movie') })
    await act(async () => { await result.current[1].reject(129) })
    expect(result.current[0].searchResults.map((c) => c.tmdbId)).toEqual([200])
  })
})
