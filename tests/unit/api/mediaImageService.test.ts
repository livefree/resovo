/**
 * tests/unit/api/mediaImageService.test.ts — IMG-06
 *
 * 验证 MediaImageService（组合器）：
 * - 前置校验：owner 不存在 → 404 OWNER_NOT_FOUND
 * - video + poster/backdrop/banner_backdrop → 上传 + updateCatalogFields + 2 job 入队 (health + blurhash)
 * - video + logo → 上传 + updateCatalogFields + 仅 health 入队（无 blurhash）
 * - banner → 上传 + updateBanner + 不入队
 * - 写库失败 → 触发 R2 补偿删除 + 向上抛错
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mocks（必须在 import MediaImageService 之前）──────────────────

const mockUpload = vi.fn()
const mockDelete = vi.fn()
const mockFindAdminVideoById = vi.fn()
const mockFindBannerById = vi.fn()
const mockUpdateCatalogFields = vi.fn()
const mockUpdateBanner = vi.fn()
const mockQueueAdd = vi.fn()

vi.mock('../../../apps/api/src/services/ImageStorageService', async () => {
  const actual = await vi.importActual<typeof import('../../../apps/api/src/services/ImageStorageService')>(
    '../../../apps/api/src/services/ImageStorageService',
  )
  return {
    ...actual,
    ImageStorageService: vi.fn().mockImplementation(() => ({
      upload: mockUpload,
      delete: mockDelete,
      isConfigured: () => true,
      validate: () => undefined,
    })),
  }
})

vi.mock('../../../apps/api/src/db/queries/videos', () => ({
  findAdminVideoById: (...args: unknown[]) => mockFindAdminVideoById(...args),
}))

vi.mock('../../../apps/api/src/db/queries/home-banners', () => ({
  findBannerById: (...args: unknown[]) => mockFindBannerById(...args),
  updateBanner: (...args: unknown[]) => mockUpdateBanner(...args),
}))

vi.mock('../../../apps/api/src/db/queries/mediaCatalog', () => ({
  updateCatalogFields: (...args: unknown[]) => mockUpdateCatalogFields(...args),
}))

vi.mock('../../../apps/api/src/lib/queue', () => ({
  imageHealthQueue: {
    add: (...args: unknown[]) => mockQueueAdd(...args),
  },
}))

import { MediaImageService } from '../../../apps/api/src/services/MediaImageService'
import { ImageStorageError } from '../../../apps/api/src/services/ImageStorageService'

const mockDb = {} as import('pg').Pool

function makeStoredResult() {
  return {
    url: 'https://r2.example/resovo-images/posters/vid-1-abcdef12.png',
    key: 'posters/vid-1-abcdef12.png',
    contentType: 'image/png',
    size: 1024,
    hash: 'abcdef12',
  }
}

describe('MediaImageService — owner 前置校验', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue(makeStoredResult())
    mockQueueAdd.mockResolvedValue({ id: 'job-1' })
  })

  it('ownerType=video 但 video 不存在 → 抛 404 OWNER_NOT_FOUND 且不调 storage.upload', async () => {
    mockFindAdminVideoById.mockResolvedValue(null)
    const svc = new MediaImageService(mockDb)
    try {
      await svc.upload({
        buffer: Buffer.from('x'),
        contentType: 'image/png',
        ownerType: 'video',
        ownerId: 'missing',
        kind: 'poster',
      })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ImageStorageError)
      expect((err as ImageStorageError).statusCode).toBe(404)
      expect((err as ImageStorageError).code).toBe('OWNER_NOT_FOUND')
    }
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdateCatalogFields).not.toHaveBeenCalled()
    expect(mockQueueAdd).not.toHaveBeenCalled()
  })

  it('ownerType=banner 但 banner 不存在 → 抛 404 OWNER_NOT_FOUND', async () => {
    mockFindBannerById.mockResolvedValue(null)
    const svc = new MediaImageService(mockDb)
    await expect(svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'banner',
      ownerId: 'missing',
    })).rejects.toThrow(ImageStorageError)
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdateBanner).not.toHaveBeenCalled()
  })

  it('ownerType=video 未提供 kind → 抛 400 VALIDATION_ERROR', async () => {
    const svc = new MediaImageService(mockDb)
    try {
      await svc.upload({
        buffer: Buffer.from('x'),
        contentType: 'image/png',
        ownerType: 'video',
        ownerId: 'vid-1',
      })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ImageStorageError)
      expect((err as ImageStorageError).statusCode).toBe(400)
    }
  })

  it('ownerType=video + kind=stills / thumbnail（scope 外）→ 抛 400', async () => {
    const svc = new MediaImageService(mockDb)
    await expect(svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'video',
      ownerId: 'vid-1',
      kind: 'stills',
    })).rejects.toThrow(ImageStorageError)
  })
})

describe('MediaImageService — video 成功路径', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue(makeStoredResult())
    mockQueueAdd.mockResolvedValue({ id: 'job-xyz' })
    mockFindAdminVideoById.mockResolvedValue({ id: 'vid-1', catalog_id: 'cat-1' })
    mockUpdateCatalogFields.mockResolvedValue({ id: 'cat-1' })
  })

  it('poster → updateCatalogFields + 2 job 入队（health + blurhash）+ blurhashJobId', async () => {
    const svc = new MediaImageService(mockDb)
    const result = await svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'video',
      ownerId: 'vid-1',
      kind: 'poster',
    })

    expect(mockUpdateCatalogFields).toHaveBeenCalledWith(mockDb, 'cat-1', {
      coverUrl: 'https://r2.example/resovo-images/posters/vid-1-abcdef12.png',
      posterStatus: 'pending_review',
    })

    // 2 次入队
    expect(mockQueueAdd).toHaveBeenCalledTimes(2)
    expect(mockQueueAdd.mock.calls[0][0]).toBe('health-check')
    expect(mockQueueAdd.mock.calls[1][0]).toBe('blurhash-extract')
    expect(mockQueueAdd.mock.calls[1][1]).toMatchObject({
      type: 'blurhash-extract',
      catalogId: 'cat-1',
      videoId: 'vid-1',
      kind: 'poster',
    })

    expect(result.ownerType).toBe('video')
    expect(result.kind).toBe('poster')
    expect(result.blurhashJobId).toBe('job-xyz')
    expect(result.url).toMatch(/^https:\/\/r2\.example\//)
  })

  it('backdrop → 入 2 job（含 blurhash）', async () => {
    const svc = new MediaImageService(mockDb)
    await svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'video',
      ownerId: 'vid-1',
      kind: 'backdrop',
    })
    expect(mockQueueAdd).toHaveBeenCalledTimes(2)
    expect(mockUpdateCatalogFields).toHaveBeenCalledWith(mockDb, 'cat-1', {
      backdropUrl: expect.any(String),
      backdropStatus: 'pending_review',
    })
  })

  it('banner_backdrop → 入 2 job（含 blurhash）', async () => {
    const svc = new MediaImageService(mockDb)
    const result = await svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'video',
      ownerId: 'vid-1',
      kind: 'banner_backdrop',
    })
    expect(mockQueueAdd).toHaveBeenCalledTimes(2)
    expect(result.blurhashJobId).toBe('job-xyz')
  })

  it('logo → 仅 health-check 入队，不入 blurhash；blurhashJobId=null', async () => {
    const svc = new MediaImageService(mockDb)
    const result = await svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'video',
      ownerId: 'vid-1',
      kind: 'logo',
    })
    expect(mockQueueAdd).toHaveBeenCalledTimes(1)
    expect(mockQueueAdd.mock.calls[0][0]).toBe('health-check')
    expect(result.blurhashJobId).toBeNull()
  })
})

describe('MediaImageService — banner 成功路径', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({
      ...makeStoredResult(),
      key: 'banners/bnr-1-abcdef12.png',
      url: 'https://r2.example/resovo-images/banners/bnr-1-abcdef12.png',
    })
    mockFindBannerById.mockResolvedValue({ id: 'bnr-1' })
    mockUpdateBanner.mockResolvedValue({ id: 'bnr-1' })
  })

  it('banner → updateBanner + 不入队 + blurhashJobId=null + kind=null', async () => {
    const svc = new MediaImageService(mockDb)
    const result = await svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'banner',
      ownerId: 'bnr-1',
    })
    expect(mockUpdateBanner).toHaveBeenCalledWith(mockDb, 'bnr-1', {
      imageUrl: 'https://r2.example/resovo-images/banners/bnr-1-abcdef12.png',
    })
    expect(mockQueueAdd).not.toHaveBeenCalled()
    expect(result.ownerType).toBe('banner')
    expect(result.kind).toBeNull()
    expect(result.blurhashJobId).toBeNull()
  })
})

describe('MediaImageService — 写库失败补偿删除', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue(makeStoredResult())
    mockFindAdminVideoById.mockResolvedValue({ id: 'vid-1', catalog_id: 'cat-1' })
    mockFindBannerById.mockResolvedValue({ id: 'bnr-1' })
  })

  it('video updateCatalogFields 抛错 → 调 storage.delete 补偿 + 向上抛错', async () => {
    mockUpdateCatalogFields.mockRejectedValue(new Error('DB down'))
    const svc = new MediaImageService(mockDb)
    await expect(svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'video',
      ownerId: 'vid-1',
      kind: 'poster',
    })).rejects.toThrow('DB down')
    expect(mockDelete).toHaveBeenCalledWith('posters/vid-1-abcdef12.png')
    expect(mockQueueAdd).not.toHaveBeenCalled()
  })

  it('banner updateBanner 抛错 → 调 storage.delete 补偿 + 向上抛错', async () => {
    mockUpdateBanner.mockRejectedValue(new Error('banner table locked'))
    const svc = new MediaImageService(mockDb)
    await expect(svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'banner',
      ownerId: 'bnr-1',
    })).rejects.toThrow('banner table locked')
    expect(mockDelete).toHaveBeenCalled()
  })
})
