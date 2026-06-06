/**
 * banners-client.test.ts — Banner tab API 客户端单元测试
 * （CHG-HOME-BANNER-UNIFY-A / ADR-181 D-181-1）
 *
 * 覆盖：6 端点桥接封装契约（路径 / 方法 / body 形态）：
 * - listBanners: 参数序列化（page / limit / sortField / sortDir）+ pagination 包络透传
 * - getBanner / createBanner / updateBanner（PUT 非 PATCH）/ deleteBanner
 * - reorderBanners: PATCH /reorder + orders body（非 home-modules 的 items）
 *
 * 不在范围：fetch 真实调用（由 apiClient 单测覆盖）；本测覆盖封装契约。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '../../../apps/server-next/src/lib/api-client'
import {
  listBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
} from '../../../apps/server-next/src/lib/banners/api'

const mockedGet = vi.mocked(apiClient.get)
const mockedPost = vi.mocked(apiClient.post)
const mockedPut = vi.mocked(apiClient.put)
const mockedPatch = vi.mocked(apiClient.patch)
const mockedDelete = vi.mocked(apiClient.delete)

const STUB_BANNER = {
  id: 'b0000000-0000-0000-0000-000000000001',
  title: { 'zh-CN': '夏日专题' },
  imageUrl: 'https://cdn.example.com/banner.jpg',
  linkType: 'external' as const,
  linkTarget: 'https://promo.example.com',
  sortOrder: 0,
  activeFrom: null,
  activeTo: null,
  isActive: true,
  brandScope: 'all-brands' as const,
  brandSlug: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
}

const STUB_LIST = {
  data: [STUB_BANNER],
  pagination: { total: 1, page: 1, limit: 20, hasNext: false },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listBanners — 参数序列化 + pagination 包络', () => {
  it('空 filter → 无 query string', async () => {
    mockedGet.mockResolvedValue(STUB_LIST)
    await listBanners()
    expect(mockedGet).toHaveBeenCalledWith('/admin/banners')
  })

  it('全参数序列化', async () => {
    mockedGet.mockResolvedValue(STUB_LIST)
    await listBanners({ page: 2, limit: 50, sortField: 'sortOrder', sortDir: 'desc' })
    expect(mockedGet).toHaveBeenCalledWith('/admin/banners?page=2&limit=50&sortField=sortOrder&sortDir=desc')
  })

  it('pagination 包络原样透传（v1 形态，非 home-modules 扁平包络）', async () => {
    mockedGet.mockResolvedValue(STUB_LIST)
    const result = await listBanners()
    expect(result.pagination).toEqual({ total: 1, page: 1, limit: 20, hasNext: false })
    expect(result.data[0].id).toBe(STUB_BANNER.id)
  })
})

describe('getBanner / createBanner / updateBanner / deleteBanner', () => {
  it('getBanner → GET /admin/banners/:id 并解包 data', async () => {
    mockedGet.mockResolvedValue({ data: STUB_BANNER })
    const banner = await getBanner(STUB_BANNER.id)
    expect(mockedGet).toHaveBeenCalledWith(`/admin/banners/${STUB_BANNER.id}`)
    expect(banner.id).toBe(STUB_BANNER.id)
  })

  it('createBanner → POST body 透传并解包 data', async () => {
    mockedPost.mockResolvedValue({ data: STUB_BANNER })
    const body = {
      title: { 'zh-CN': '夏日专题' },
      imageUrl: 'https://cdn.example.com/banner.jpg',
      linkType: 'external' as const,
      linkTarget: 'https://promo.example.com',
    }
    const banner = await createBanner(body)
    expect(mockedPost).toHaveBeenCalledWith('/admin/banners', body)
    expect(banner.id).toBe(STUB_BANNER.id)
  })

  it('updateBanner → PUT（v1 端点语义，非 PATCH）', async () => {
    mockedPut.mockResolvedValue({ data: { ...STUB_BANNER, isActive: false } })
    const banner = await updateBanner(STUB_BANNER.id, { isActive: false })
    expect(mockedPut).toHaveBeenCalledWith(`/admin/banners/${STUB_BANNER.id}`, { isActive: false })
    expect(mockedPatch).not.toHaveBeenCalled()
    expect(banner.isActive).toBe(false)
  })

  it('deleteBanner → DELETE /admin/banners/:id', async () => {
    mockedDelete.mockResolvedValue(undefined)
    await deleteBanner(STUB_BANNER.id)
    expect(mockedDelete).toHaveBeenCalledWith(`/admin/banners/${STUB_BANNER.id}`)
  })
})

describe('reorderBanners — body 形态契约', () => {
  it('PATCH /admin/banners/reorder + orders 键（非 items）+ sortOrder 字段（非 ordering）', async () => {
    mockedPatch.mockResolvedValue(undefined)
    const orders = [
      { id: 'b1', sortOrder: 0 },
      { id: 'b2', sortOrder: 1 },
    ]
    await reorderBanners(orders)
    expect(mockedPatch).toHaveBeenCalledWith('/admin/banners/reorder', { orders })
  })
})
