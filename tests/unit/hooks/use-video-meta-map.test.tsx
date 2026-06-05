/**
 * @vitest-environment jsdom
 *
 * use-video-meta-map.test.tsx — useVideoMetaMap hook 契约（CHG-HOME-UX-03）
 *
 * 覆盖：
 *   #1 仅 video 类型 contentRefId 触发 fetch（external_url 等不取）
 *   #2 并发取回 → metaMap 填充（成功映射 title/coverUrl/isPublished）
 *   #3 404 → metaMap.get(id) === null（「已确认失效」与「未取回」区分）
 *   #4 缓存：同 id 第二次渲染不重复 fetch
 *   #5 loadingIds：fetch 期间含 id，完成后清空
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// 相对路径 mock：tests/unit/hooks/ 不在 vitest context-aware alias 的 server-next
// importer 白名单内（@/ 会解析到 web-next），与 home-modules-client.test.ts 同惯例。
const mockFetchById = vi.fn()
vi.mock('../../../apps/server-next/src/lib/videos/picker-fetcher', () => ({
  fetchPickerItemByIdSafe: (...args: unknown[]) => mockFetchById(...args),
}))

import { useVideoMetaMap } from '../../../apps/server-next/src/lib/home-modules/use-video-meta-map'
import type { HomeModule } from '../../../apps/server-next/src/lib/home-modules/types'

function makeModule(over: Partial<HomeModule>): HomeModule {
  return {
    id: 'm1',
    slot: 'banner',
    brandScope: 'all-brands',
    brandSlug: null,
    ordering: 0,
    contentRefType: 'video',
    contentRefId: 'v1',
    title: {},
    imageUrl: null,
    startAt: null,
    endAt: null,
    enabled: true,
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

const PICKER_ITEM = {
  id: 'v1',
  shortId: 'abc',
  title: '流浪地球 3',
  titleEn: null,
  type: 'movie',
  year: 2026,
  coverUrl: 'https://cdn.example.com/c.jpg',
  isPublished: true,
}

beforeEach(() => {
  mockFetchById.mockReset()
})

describe('useVideoMetaMap', () => {
  it('仅 video 类型触发 fetch；external_url/video_type 不取', async () => {
    mockFetchById.mockResolvedValue(PICKER_ITEM)
    const modules = [
      makeModule({ id: 'm1', contentRefType: 'video', contentRefId: 'v1' }),
      makeModule({ id: 'm2', contentRefType: 'external_url', contentRefId: 'https://x.example' }),
      makeModule({ id: 'm3', contentRefType: 'video_type', contentRefId: 'movie' }),
    ]
    const { result } = renderHook(() => useVideoMetaMap(modules))
    await waitFor(() => expect(result.current.metaMap.size).toBe(1))
    expect(mockFetchById).toHaveBeenCalledTimes(1)
    expect(mockFetchById).toHaveBeenCalledWith('v1')
    expect(result.current.metaMap.get('v1')).toEqual({
      title: '流浪地球 3',
      coverUrl: 'https://cdn.example.com/c.jpg',
      isPublished: true,
    })
  })

  it('404 → metaMap 存 null（已确认失效），与未取回（键不存在）区分', async () => {
    mockFetchById.mockImplementation((id: string) =>
      Promise.resolve(id === 'v-dead' ? null : PICKER_ITEM))
    const modules = [
      makeModule({ id: 'm1', contentRefId: 'v1' }),
      makeModule({ id: 'm2', contentRefId: 'v-dead' }),
    ]
    const { result } = renderHook(() => useVideoMetaMap(modules))
    await waitFor(() => expect(result.current.metaMap.size).toBe(2))
    expect(result.current.metaMap.get('v-dead')).toBeNull()
    expect(result.current.metaMap.has('v-unknown')).toBe(false)
  })

  it('缓存：同 id 列表更新（引用变动）不重复 fetch', async () => {
    mockFetchById.mockResolvedValue(PICKER_ITEM)
    const { result, rerender } = renderHook(
      ({ mods }: { mods: readonly HomeModule[] }) => useVideoMetaMap(mods),
      { initialProps: { mods: [makeModule({ contentRefId: 'v1' })] } },
    )
    await waitFor(() => expect(result.current.metaMap.size).toBe(1))
    expect(mockFetchById).toHaveBeenCalledTimes(1)

    // 新数组引用、同 id 集 → 不再 fetch
    rerender({ mods: [makeModule({ contentRefId: 'v1' })] })
    await waitFor(() => expect(result.current.metaMap.size).toBe(1))
    expect(mockFetchById).toHaveBeenCalledTimes(1)

    // 新增 id → 仅 fetch 新增的
    rerender({ mods: [makeModule({ contentRefId: 'v1' }), makeModule({ id: 'm2', contentRefId: 'v2' })] })
    await waitFor(() => expect(result.current.metaMap.size).toBe(2))
    expect(mockFetchById).toHaveBeenCalledTimes(2)
    expect(mockFetchById).toHaveBeenLastCalledWith('v2')
  })

  it('loadingIds：fetch 期间含 id，完成后清空', async () => {
    let resolveFetch: (v: typeof PICKER_ITEM) => void = () => undefined
    mockFetchById.mockImplementation(() => new Promise((r) => { resolveFetch = r }))
    const { result } = renderHook(() => useVideoMetaMap([makeModule({ contentRefId: 'v1' })]))
    await waitFor(() => expect(result.current.loadingIds.has('v1')).toBe(true))

    resolveFetch(PICKER_ITEM)
    await waitFor(() => expect(result.current.loadingIds.size).toBe(0))
    expect(result.current.metaMap.get('v1')?.title).toBe('流浪地球 3')
  })

  it('空 modules / 无 video 类型 → 零 fetch + 空 map', async () => {
    const { result } = renderHook(() => useVideoMetaMap([]))
    await waitFor(() => expect(result.current.loadingIds.size).toBe(0))
    expect(mockFetchById).not.toHaveBeenCalled()
    expect(result.current.metaMap.size).toBe(0)
  })
})
