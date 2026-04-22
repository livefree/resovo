/**
 * tests/unit/api/imageStorageService.test.ts — IMG-06
 *
 * 验证 ImageStorageService（纯 R2 存储层）：
 * - validate：mimetype 白名单 / 大小上限
 * - upload：R2 未配返 503；key 带 sha256 前 8 位 hash；不同 ownerType/kind 对应 key prefix
 * - delete：R2 未配静默返回
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock @aws-sdk/client-s3 必须在 import ImageStorageService 之前
const mockSend = vi.fn()
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: vi.fn().mockImplementation((input: unknown) => ({ __cmd: 'Put', input })),
  DeleteObjectCommand: vi.fn().mockImplementation((input: unknown) => ({ __cmd: 'Delete', input })),
}))

import {
  ImageStorageService,
  ImageStorageError,
} from '../../../apps/api/src/services/ImageStorageService'

const originalEnv = { ...process.env }

describe('ImageStorageService — validate', () => {
  beforeEach(() => {
    mockSend.mockReset()
    process.env = { ...originalEnv, R2_ENDPOINT: 'https://r2.example', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' }
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('接受白名单 mimetype', () => {
    const svc = new ImageStorageService()
    for (const mt of ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']) {
      expect(() => svc.validate(Buffer.from('x'), mt)).not.toThrow()
    }
  })

  it('拒绝非白名单 mimetype → 415', () => {
    const svc = new ImageStorageService()
    try {
      svc.validate(Buffer.from('x'), 'application/pdf')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ImageStorageError)
      expect((err as ImageStorageError).statusCode).toBe(415)
      expect((err as ImageStorageError).code).toBe('UNSUPPORTED_MEDIA_TYPE')
    }
  })

  it('拒绝超过 5MB → 413', () => {
    const svc = new ImageStorageService()
    const big = Buffer.alloc(5 * 1024 * 1024 + 1)
    try {
      svc.validate(big, 'image/png')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ImageStorageError)
      expect((err as ImageStorageError).statusCode).toBe(413)
      expect((err as ImageStorageError).code).toBe('PAYLOAD_TOO_LARGE')
    }
  })

  it('接受恰好 5MB 的文件', () => {
    const svc = new ImageStorageService()
    const exact = Buffer.alloc(5 * 1024 * 1024)
    expect(() => svc.validate(exact, 'image/png')).not.toThrow()
  })
})

describe('ImageStorageService — R2 未配', () => {
  beforeEach(() => {
    mockSend.mockReset()
    delete process.env.R2_ENDPOINT
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('isConfigured() 返回 false', () => {
    const svc = new ImageStorageService()
    expect(svc.isConfigured()).toBe(false)
  })

  it('upload 抛 503 STORAGE_NOT_CONFIGURED', async () => {
    const svc = new ImageStorageService()
    try {
      await svc.upload({
        buffer: Buffer.from('fake'),
        contentType: 'image/png',
        ownerType: 'video',
        ownerId: 'vid-1',
        kind: 'poster',
      })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ImageStorageError)
      expect((err as ImageStorageError).statusCode).toBe(503)
      expect((err as ImageStorageError).code).toBe('STORAGE_NOT_CONFIGURED')
    }
  })

  it('delete(key) 在 R2 未配时静默返回', async () => {
    const svc = new ImageStorageService()
    await expect(svc.delete('posters/vid-1-abc.png')).resolves.toBeUndefined()
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('ImageStorageService — upload（R2 已配）', () => {
  beforeEach(() => {
    mockSend.mockReset()
    mockSend.mockResolvedValue({})
    process.env.R2_ENDPOINT = 'https://r2.example'
    process.env.R2_ACCESS_KEY_ID = 'k'
    process.env.R2_SECRET_ACCESS_KEY = 's'
    process.env.R2_IMAGES_BUCKET = 'resovo-images'
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('video + poster → key = posters/{videoId}-{sha8}.jpg', async () => {
    const svc = new ImageStorageService()
    const buf = Buffer.from('fake-jpeg-content')
    const result = await svc.upload({
      buffer: buf,
      contentType: 'image/jpeg',
      ownerType: 'video',
      ownerId: 'vid-abc',
      kind: 'poster',
    })
    expect(result.key).toMatch(/^posters\/vid-abc-[a-f0-9]{8}\.jpg$/)
    expect(result.url).toBe(`https://r2.example/resovo-images/${result.key}`)
    expect(result.contentType).toBe('image/jpeg')
    expect(result.size).toBe(buf.length)
    expect(result.hash).toMatch(/^[a-f0-9]{8}$/)
  })

  it('video + backdrop → key prefix = backdrops/', async () => {
    const svc = new ImageStorageService()
    const result = await svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/webp',
      ownerType: 'video',
      ownerId: 'vid-b',
      kind: 'backdrop',
    })
    expect(result.key).toMatch(/^backdrops\/vid-b-[a-f0-9]{8}\.webp$/)
  })

  it('video + logo → key prefix = logos/', async () => {
    const svc = new ImageStorageService()
    const result = await svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'video',
      ownerId: 'vid-c',
      kind: 'logo',
    })
    expect(result.key).toMatch(/^logos\/vid-c-[a-f0-9]{8}\.png$/)
  })

  it('video + banner_backdrop → key prefix = banner-backdrops/', async () => {
    const svc = new ImageStorageService()
    const result = await svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      ownerType: 'video',
      ownerId: 'vid-d',
      kind: 'banner_backdrop',
    })
    expect(result.key).toMatch(/^banner-backdrops\/vid-d-[a-f0-9]{8}\.png$/)
  })

  it('banner → key prefix = banners/, 忽略 kind', async () => {
    const svc = new ImageStorageService()
    const result = await svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'image/avif',
      ownerType: 'banner',
      ownerId: 'bnr-1',
    })
    expect(result.key).toMatch(/^banners\/bnr-1-[a-f0-9]{8}\.avif$/)
  })

  it('相同 buffer → 相同 hash（幂等）', async () => {
    const svc = new ImageStorageService()
    const buf = Buffer.from('stable-content')
    const r1 = await svc.upload({
      buffer: buf, contentType: 'image/png', ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    const r2 = await svc.upload({
      buffer: buf, contentType: 'image/png', ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    expect(r1.hash).toBe(r2.hash)
    expect(r1.key).toBe(r2.key)
  })

  it('不同 buffer → 不同 hash（防 CDN 缓存不一致）', async () => {
    const svc = new ImageStorageService()
    const r1 = await svc.upload({
      buffer: Buffer.from('v1'), contentType: 'image/png', ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    const r2 = await svc.upload({
      buffer: Buffer.from('v2'), contentType: 'image/png', ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    expect(r1.hash).not.toBe(r2.hash)
    expect(r1.key).not.toBe(r2.key)
  })

  it('validate 失败（mimetype）在 upload 内部也阻断', async () => {
    const svc = new ImageStorageService()
    await expect(svc.upload({
      buffer: Buffer.from('x'),
      contentType: 'application/pdf',
      ownerType: 'video',
      ownerId: 'v',
      kind: 'poster',
    })).rejects.toThrow(ImageStorageError)
  })

  it('R2 PutObjectCommand 被调用', async () => {
    const svc = new ImageStorageService()
    await svc.upload({
      buffer: Buffer.from('x'), contentType: 'image/png', ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    expect(mockSend).toHaveBeenCalledTimes(1)
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.__cmd).toBe('Put')
    expect(cmd.input.Bucket).toBe('resovo-images')
    expect(cmd.input.ContentType).toBe('image/png')
  })

  it('delete 调用 DeleteObjectCommand', async () => {
    const svc = new ImageStorageService()
    await svc.delete('posters/vid-1-abcdef12.png')
    expect(mockSend).toHaveBeenCalledTimes(1)
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.__cmd).toBe('Delete')
    expect(cmd.input.Bucket).toBe('resovo-images')
    expect(cmd.input.Key).toBe('posters/vid-1-abcdef12.png')
  })

  it('delete 抛错时静默吞掉（不影响主流程），仅 stderr warn', async () => {
    mockSend.mockRejectedValueOnce(new Error('network'))
    const svc = new ImageStorageService()
    await expect(svc.delete('posters/x.png')).resolves.toBeUndefined()
  })
})
