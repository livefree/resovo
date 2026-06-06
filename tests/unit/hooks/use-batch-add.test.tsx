/**
 * @vitest-environment jsdom
 *
 * use-batch-add.test.tsx — 批量添加编排域 hook（CHG-HOME-UX-07-FIX / Codex review 修复守护）
 *
 * 覆盖：
 *   #1 服务端真源兜底去重：目标 slot 本地未加载，服务端已有该视频 → 跳过不 create
 *   #2 ordering 按服务端 max+1（本地缓存为空也不从 0 起撞号）
 *   #3 跳过/失败计数进 toast
 *   #4 面板打开 → 预加载未加载 video slots（已加载不重复）
 *   #5 列表获取失败 → 不执行任何 create + danger toast
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockList = vi.fn()
const mockCreate = vi.fn()
const mockTrending = vi.fn()
vi.mock('../../../apps/server-next/src/lib/home-modules/api', () => ({
  listHomeModules: (...args: unknown[]) => mockList(...args),
  createHomeModule: (...args: unknown[]) => mockCreate(...args),
  fetchTrendingCandidates: (...args: unknown[]) => mockTrending(...args),
}))

import { useBatchAdd } from '../../../apps/server-next/src/lib/home-modules/use-batch-add'
import type { HomeModule, HomeModuleSlot } from '../../../apps/server-next/src/lib/home-modules/types'

function makeModule(over: Partial<HomeModule>): HomeModule {
  return {
    id: 'm1', slot: 'featured', brandScope: 'all-brands', brandSlug: null,
    ordering: 0, contentRefType: 'video', contentRefId: 'v-old',
    title: {}, imageUrl: null, startAt: null, endAt: null, enabled: true,
    metadata: {}, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function makeItem(id: string) {
  return { id, shortId: id, title: id, titleEn: null, type: 'movie', year: null, coverUrl: null, isPublished: true }
}

const toastPush = vi.fn()

function setup(modulesBySlot: Partial<Record<HomeModuleSlot, readonly HomeModule[]>> = {}) {
  const setModulesBySlot = vi.fn()
  const loadSlot = vi.fn().mockResolvedValue(undefined)
  const hook = renderHook(() => useBatchAdd({
    modulesBySlot,
    setModulesBySlot,
    loadSlot,
    toast: { push: toastPush },
  }))
  return { hook, setModulesBySlot, loadSlot }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockImplementation((body: { contentRefId: string; ordering: number }) =>
    Promise.resolve(makeModule({ id: `created-${body.contentRefId}`, contentRefId: body.contentRefId, ordering: body.ordering })))
})

describe('useBatchAdd — 服务端真源兜底（Codex FIX）', () => {
  it('目标 slot 本地未加载 + 服务端已有该视频 → 跳过不重复创建；ordering 按服务端 max+1', async () => {
    // 本地 modulesBySlot 完全为空（未加载）；服务端 featured 已有 v-dup（ordering 7）
    mockList.mockResolvedValue({
      data: [makeModule({ contentRefId: 'v-dup', ordering: 7 })],
      total: 1, page: 1, limit: 100,
    })
    const { hook, setModulesBySlot } = setup({})

    await act(async () => {
      await hook.result.current.handleBatchAdd('featured', [makeItem('v-dup'), makeItem('v-new')])
    })

    // 确认时服务端兜底取列表
    expect(mockList).toHaveBeenCalledWith({ slot: 'featured', limit: 100 })
    // v-dup 跳过：仅 v-new 创建，且 ordering = 服务端 max(7)+1 = 8（非本地空缓存的 0）
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ contentRefId: 'v-new', ordering: 8 }))
    // toast 含跳过计数
    expect(toastPush).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('跳过 1 个'),
      level: 'success',
    }))
    // 列表缓存以服务端 fresh + 本批创建整体回写
    const writer = setModulesBySlot.mock.calls[0][0] as (prev: Record<string, readonly HomeModule[]>) => Record<string, readonly HomeModule[]>
    const next = writer({})
    expect(next.featured.map((m) => m.contentRefId)).toEqual(['v-dup', 'v-new'])
  })

  it('全部已在服务端 → 零 create + 跳过计数', async () => {
    mockList.mockResolvedValue({ data: [makeModule({ contentRefId: 'v-a' })], total: 1, page: 1, limit: 100 })
    const { hook } = setup({})
    await act(async () => {
      await hook.result.current.handleBatchAdd('featured', [makeItem('v-a')])
    })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(toastPush).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('已添加 0 个 · 已在列跳过 1 个'),
    }))
  })

  it('列表获取失败 → 不执行任何 create + danger toast', async () => {
    mockList.mockRejectedValue(new Error('network down'))
    const { hook } = setup({})
    await act(async () => {
      await hook.result.current.handleBatchAdd('featured', [makeItem('v-x')])
    })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(toastPush).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('未执行添加'),
      level: 'danger',
    }))
  })

  it('部分 create 失败 → warn toast 含失败计数', async () => {
    mockList.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 })
    mockCreate
      .mockResolvedValueOnce(makeModule({ contentRefId: 'v-1' }))
      .mockRejectedValueOnce(new Error('422'))
    const { hook } = setup({})
    await act(async () => {
      await hook.result.current.handleBatchAdd('featured', [makeItem('v-1'), makeItem('v-2')])
    })
    expect(toastPush).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('失败 1 个'),
      level: 'warn',
    }))
  })
})

describe('useBatchAdd — 面板打开预加载（FIX UI 层）', () => {
  it('openBlank → 预加载全部未加载 video slots；已加载的不重复', async () => {
    const { hook, loadSlot } = setup({ banner: [] })  // banner 已加载（空数组也算已加载）
    act(() => { hook.result.current.openBlank() })
    await waitFor(() => {
      expect(loadSlot).toHaveBeenCalledWith('featured')
    })
    expect(loadSlot).toHaveBeenCalledWith('top10')
    expect(loadSlot).not.toHaveBeenCalledWith('banner')
  })

  it('未打开（初始态）→ 零预加载', () => {
    const { loadSlot } = setup({})
    expect(loadSlot).not.toHaveBeenCalled()
  })
})
