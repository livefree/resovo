/**
 * home-modules-client.test.ts — 首页运营位 API 客户端单元测试（CHG-SN-5-07）
 *
 * 覆盖：
 * - listHomeModules: 参数序列化（slot / brandScope / brandSlug / enabled / page / limit）
 * - createHomeModule: POST body 透传
 * - updateHomeModule: PATCH endpoint + body
 * - deleteHomeModule: DELETE endpoint
 * - reorderHomeModules: POST /reorder + items body
 * - publishToggleHomeModule: POST /:id/publish-toggle + enabled body
 *
 * 不在范围：fetch 真实调用（由 apiClient 单测覆盖）；本测覆盖封装契约。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), postMultipart: vi.fn() },
}))

import { apiClient } from '../../../apps/server-next/src/lib/api-client'
import {
  listHomeModules,
  createHomeModule,
  updateHomeModule,
  deleteHomeModule,
  reorderHomeModules,
  publishToggleHomeModule,
  uploadHomeModuleImage,
} from '../../../apps/server-next/src/lib/home-modules/api'

const mockedGet = vi.mocked(apiClient.get)
const mockedPost = vi.mocked(apiClient.post)
const mockedPatch = vi.mocked(apiClient.patch)
const mockedDelete = vi.mocked(apiClient.delete)
const mockedPostMultipart = vi.mocked(apiClient.postMultipart)

const STUB_MODULE = {
  id: 'm1',
  slot: 'banner' as const,
  brandScope: 'all-brands' as const,
  brandSlug: null,
  ordering: 0,
  contentRefType: 'video' as const,
  contentRefId: 'v1',
  startAt: null,
  endAt: null,
  enabled: true,
  metadata: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('listHomeModules — 参数序列化', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedGet.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 })
  })

  it('空 filter → 无 query string', async () => {
    await listHomeModules()
    expect(mockedGet).toHaveBeenCalledWith('/admin/home-modules')
  })

  it('slot → query string 含 slot', async () => {
    await listHomeModules({ slot: 'top10' })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('slot=top10')
  })

  it('brandScope + brandSlug → 两参数均入 query', async () => {
    await listHomeModules({ brandScope: 'brand-specific', brandSlug: 'resovo' })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('brandScope=brand-specific')
    expect(url).toContain('brandSlug=resovo')
  })

  it('enabled=false → query string 含 enabled=false', async () => {
    await listHomeModules({ enabled: false })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('enabled=false')
  })

  it('page + limit → query string 含分页', async () => {
    await listHomeModules({ page: 2, limit: 50 })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('page=2')
    expect(url).toContain('limit=50')
  })

  it('返回值结构 data / total / page / limit', async () => {
    mockedGet.mockResolvedValue({ data: [STUB_MODULE], total: 1, page: 1, limit: 20 })
    const res = await listHomeModules({ slot: 'banner' })
    expect(res.total).toBe(1)
    expect(res.data).toHaveLength(1)
  })
})

describe('createHomeModule', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue({ data: STUB_MODULE })
  })

  it('POST /admin/home-modules', async () => {
    await createHomeModule({
      slot: 'banner',
      brandScope: 'all-brands',
      contentRefType: 'video',
      contentRefId: 'v1',
    })
    expect(mockedPost).toHaveBeenCalledWith('/admin/home-modules', expect.objectContaining({
      slot: 'banner',
      contentRefId: 'v1',
    }))
  })

  it('返回 HomeModule 对象', async () => {
    const result = await createHomeModule({
      slot: 'top10',
      brandScope: 'all-brands',
      contentRefType: 'video',
      contentRefId: 'v2',
    })
    expect(result.id).toBe('m1')
    expect(result.slot).toBe('banner')
  })
})

describe('updateHomeModule', () => {
  beforeEach(() => {
    mockedPatch.mockReset()
    mockedPatch.mockResolvedValue({ data: STUB_MODULE })
  })

  it('PATCH /admin/home-modules/:id', async () => {
    await updateHomeModule('m1', { contentRefId: 'v2' })
    expect(mockedPatch).toHaveBeenCalledWith('/admin/home-modules/m1', { contentRefId: 'v2' })
  })

  it('返回更新后的 HomeModule', async () => {
    const result = await updateHomeModule('m1', { ordering: 5 })
    expect(result.id).toBe('m1')
  })
})

describe('deleteHomeModule', () => {
  beforeEach(() => {
    mockedDelete.mockReset()
    mockedDelete.mockResolvedValue(undefined)
  })

  it('DELETE /admin/home-modules/:id', async () => {
    await deleteHomeModule('m1')
    expect(mockedDelete).toHaveBeenCalledWith('/admin/home-modules/m1')
  })
})

describe('reorderHomeModules', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue(undefined)
  })

  it('POST /admin/home-modules/reorder + items body', async () => {
    const items = [{ id: 'm1', ordering: 0 }, { id: 'm2', ordering: 1 }]
    await reorderHomeModules(items)
    expect(mockedPost).toHaveBeenCalledWith('/admin/home-modules/reorder', { items })
  })

  it('空数组也正常调用', async () => {
    await reorderHomeModules([])
    expect(mockedPost).toHaveBeenCalledWith('/admin/home-modules/reorder', { items: [] })
  })
})

describe('publishToggleHomeModule', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue({ data: { ...STUB_MODULE, enabled: false } })
  })

  it('POST /admin/home-modules/:id/publish-toggle + enabled=false', async () => {
    await publishToggleHomeModule('m1', false)
    expect(mockedPost).toHaveBeenCalledWith('/admin/home-modules/m1/publish-toggle', { enabled: false })
  })

  it('POST /admin/home-modules/:id/publish-toggle + enabled=true', async () => {
    mockedPost.mockResolvedValue({ data: STUB_MODULE })
    await publishToggleHomeModule('m1', true)
    expect(mockedPost).toHaveBeenCalledWith('/admin/home-modules/m1/publish-toggle', { enabled: true })
  })

  it('返回切换后的 HomeModule', async () => {
    const result = await publishToggleHomeModule('m1', false)
    expect(result.id).toBe('m1')
    expect(result.enabled).toBe(false)
  })
})

// ── CHG-HOME-UX-03：uploadHomeModuleImage 契约 ─────────────────────────────

describe('uploadHomeModuleImage', () => {
  beforeEach(() => {
    mockedPostMultipart.mockReset()
    mockedPostMultipart.mockResolvedValue({ data: { url: 'https://cdn.example.com/home_modules/m1-hash.png' } })
  })

  it('POST multipart /admin/media/images，FormData 含 ownerType=home_module + ownerId + file', async () => {
    const file = new File(['x'], 'banner.png', { type: 'image/png' })
    const result = await uploadHomeModuleImage('m1', file)

    expect(mockedPostMultipart).toHaveBeenCalledTimes(1)
    const [path, formData] = mockedPostMultipart.mock.calls[0] as [string, FormData]
    expect(path).toBe('/admin/media/images')
    expect(formData.get('ownerType')).toBe('home_module')
    expect(formData.get('ownerId')).toBe('m1')
    expect(formData.get('file')).toBe(file)
    expect(result.url).toBe('https://cdn.example.com/home_modules/m1-hash.png')
  })
})
