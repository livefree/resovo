/**
 * tests/unit/api/imageStorageService.test.ts — IMG-06（含 P1 修复）
 *
 * 验证 ImageStorageService：
 * - validate：mimetype 白名单 / 大小上限
 * - R2 Provider：key hash、公开 URL 用 R2_PUBLIC_BASE_URL；未设时回退 R2_ENDPOINT + warn
 * - LocalFS Provider：R2 未配时启用；写 FS 目录 + 返回 LOCAL_UPLOAD_PUBLIC_URL 前缀
 * - delete：两种 provider 都静默吞 ENOENT / API 错误
 * - resolveLocalFilePath：LocalFs 返绝对路径；R2 返 null
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
    process.env = {
      ...originalEnv,
      R2_ENDPOINT: 'https://r2.example',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
    }
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

describe('ImageStorageService — R2 Provider（R2 已配）', () => {
  beforeEach(() => {
    mockSend.mockReset()
    mockSend.mockResolvedValue({})
    process.env = {
      ...originalEnv,
      R2_ENDPOINT: 'https://r2.example',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_IMAGES_BUCKET: 'resovo-images',
    }
    delete process.env.R2_PUBLIC_BASE_URL
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('provider 标签为 r2', () => {
    const svc = new ImageStorageService()
    expect(svc.getProviderLabel()).toBe('r2')
  })

  it('设置 R2_PUBLIC_BASE_URL 时公开 URL 用该 base（前台可展示）', async () => {
    process.env.R2_PUBLIC_BASE_URL = 'https://pub-xyz.r2.dev'
    const svc = new ImageStorageService()
    const r = await svc.upload({
      buffer: Buffer.from('fake'), contentType: 'image/png',
      ownerType: 'video', ownerId: 'v1', kind: 'poster',
    })
    expect(r.url).toBe(`https://pub-xyz.r2.dev/${r.key}`)
    expect(r.provider).toBe('r2')
  })

  it('R2_PUBLIC_BASE_URL 末尾斜杠被 trim', async () => {
    process.env.R2_PUBLIC_BASE_URL = 'https://pub-xyz.r2.dev/'
    const svc = new ImageStorageService()
    const r = await svc.upload({
      buffer: Buffer.from('x'), contentType: 'image/png',
      ownerType: 'video', ownerId: 'v1', kind: 'poster',
    })
    expect(r.url).not.toContain('//posters/')
    expect(r.url).toMatch(/^https:\/\/pub-xyz\.r2\.dev\/posters\//)
  })

  it('未设置 R2_PUBLIC_BASE_URL → 回退 R2_ENDPOINT 并 stderr warn（向后兼容）', async () => {
    const svc = new ImageStorageService()
    const r = await svc.upload({
      buffer: Buffer.from('x'), contentType: 'image/png',
      ownerType: 'video', ownerId: 'v1', kind: 'poster',
    })
    expect(r.url).toMatch(/^https:\/\/r2\.example\/resovo-images\/posters\//)
  })

  it('各 ownerType/kind → 正确 key prefix', async () => {
    const svc = new ImageStorageService()
    const cases: Array<[Parameters<typeof svc.upload>[0], RegExp]> = [
      [{ buffer: Buffer.from('x'), contentType: 'image/jpeg', ownerType: 'video', ownerId: 'vid-a', kind: 'poster' }, /^posters\/vid-a-[a-f0-9]{8}\.jpg$/],
      [{ buffer: Buffer.from('x'), contentType: 'image/webp', ownerType: 'video', ownerId: 'vid-b', kind: 'backdrop' }, /^backdrops\/vid-b-[a-f0-9]{8}\.webp$/],
      [{ buffer: Buffer.from('x'), contentType: 'image/png', ownerType: 'video', ownerId: 'vid-c', kind: 'logo' }, /^logos\/vid-c-[a-f0-9]{8}\.png$/],
      [{ buffer: Buffer.from('x'), contentType: 'image/png', ownerType: 'video', ownerId: 'vid-d', kind: 'banner_backdrop' }, /^banner-backdrops\/vid-d-[a-f0-9]{8}\.png$/],
      [{ buffer: Buffer.from('x'), contentType: 'image/avif', ownerType: 'banner', ownerId: 'bnr-1' }, /^banners\/bnr-1-[a-f0-9]{8}\.avif$/],
    ]
    for (const [input, regex] of cases) {
      const r = await svc.upload(input)
      expect(r.key).toMatch(regex)
    }
  })

  it('相同 buffer → 相同 hash（幂等）；不同 buffer → 不同 hash', async () => {
    const svc = new ImageStorageService()
    const r1 = await svc.upload({
      buffer: Buffer.from('stable'), contentType: 'image/png',
      ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    const r2 = await svc.upload({
      buffer: Buffer.from('stable'), contentType: 'image/png',
      ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    const r3 = await svc.upload({
      buffer: Buffer.from('different'), contentType: 'image/png',
      ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    expect(r1.hash).toBe(r2.hash)
    expect(r1.hash).not.toBe(r3.hash)
  })

  it('validate 失败阻断 upload', async () => {
    const svc = new ImageStorageService()
    await expect(svc.upload({
      buffer: Buffer.from('x'), contentType: 'application/pdf',
      ownerType: 'video', ownerId: 'v', kind: 'poster',
    })).rejects.toThrow(ImageStorageError)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('R2 PutObjectCommand 被调用', async () => {
    const svc = new ImageStorageService()
    await svc.upload({
      buffer: Buffer.from('x'), contentType: 'image/png',
      ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.__cmd).toBe('Put')
    expect(cmd.input.Bucket).toBe('resovo-images')
  })

  it('delete 调用 R2 DeleteObjectCommand', async () => {
    const svc = new ImageStorageService()
    await svc.delete('posters/v-abcdef12.png')
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.__cmd).toBe('Delete')
    expect(cmd.input.Key).toBe('posters/v-abcdef12.png')
  })

  it('delete 抛错时静默吞（不影响主流程）', async () => {
    mockSend.mockRejectedValueOnce(new Error('net'))
    const svc = new ImageStorageService()
    await expect(svc.delete('posters/x.png')).resolves.toBeUndefined()
  })

  it('resolveLocalFilePath 返 null（R2 provider 下本地 fallback 不启用）', () => {
    const svc = new ImageStorageService()
    expect(svc.resolveLocalFilePath('posters/x.png')).toBeNull()
  })
})

describe('ImageStorageService — LocalFS Provider（R2 未配）', () => {
  let tmpDir: string

  beforeEach(() => {
    mockSend.mockReset()
    process.env = { ...originalEnv }
    delete process.env.R2_ENDPOINT
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
    tmpDir = mkdtempSync(join(tmpdir(), 'resovo-img-test-'))
    process.env.LOCAL_UPLOAD_DIR = tmpDir
    process.env.LOCAL_UPLOAD_PUBLIC_URL = 'http://localhost:3001/v1/uploads'
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    process.env = { ...originalEnv }
  })

  it('provider 标签为 local-fs', () => {
    const svc = new ImageStorageService()
    expect(svc.getProviderLabel()).toBe('local-fs')
  })

  it('upload 写入本地 FS → 返回 LOCAL_UPLOAD_PUBLIC_URL 前缀的 URL（前台可展示）', async () => {
    const svc = new ImageStorageService()
    const buf = Buffer.from('fake-png-content')
    const r = await svc.upload({
      buffer: buf, contentType: 'image/png',
      ownerType: 'video', ownerId: 'vid-1', kind: 'poster',
    })
    // 返回 URL
    expect(r.url).toMatch(/^http:\/\/localhost:3001\/v1\/uploads\/posters\/vid-1-[a-f0-9]{8}\.png$/)
    expect(r.provider).toBe('local-fs')
    // 实际文件落地
    const fullPath = join(tmpDir, r.key)
    expect(existsSync(fullPath)).toBe(true)
    expect(readFileSync(fullPath).toString()).toBe('fake-png-content')
  })

  it('banner kind 使用 banners/ 前缀', async () => {
    const svc = new ImageStorageService()
    const r = await svc.upload({
      buffer: Buffer.from('banner-img'), contentType: 'image/webp',
      ownerType: 'banner', ownerId: 'bnr-1',
    })
    expect(r.key).toMatch(/^banners\/bnr-1-[a-f0-9]{8}\.webp$/)
    expect(existsSync(join(tmpDir, r.key))).toBe(true)
  })

  it('delete 删除本地文件', async () => {
    const svc = new ImageStorageService()
    const r = await svc.upload({
      buffer: Buffer.from('del-me'), contentType: 'image/png',
      ownerType: 'video', ownerId: 'v', kind: 'poster',
    })
    expect(existsSync(join(tmpDir, r.key))).toBe(true)
    await svc.delete(r.key)
    expect(existsSync(join(tmpDir, r.key))).toBe(false)
  })

  it('delete 对不存在文件静默忽略（ENOENT）', async () => {
    const svc = new ImageStorageService()
    await expect(svc.delete('posters/non-existent.png')).resolves.toBeUndefined()
  })

  it('resolveLocalFilePath 返绝对路径（供 GET /uploads/* 使用）', () => {
    const svc = new ImageStorageService()
    const p = svc.resolveLocalFilePath('posters/v-abcdef12.png')
    expect(p).not.toBeNull()
    expect(p!).toContain(tmpDir)
    expect(p!).toMatch(/posters\/v-abcdef12\.png$/)
  })

  it('resolveLocalFilePath 拒绝路径穿越 → 400 INVALID_KEY', () => {
    const svc = new ImageStorageService()
    expect(() => svc.resolveLocalFilePath('../../etc/passwd')).toThrow(ImageStorageError)
    try {
      svc.resolveLocalFilePath('../../etc/passwd')
    } catch (err) {
      expect((err as ImageStorageError).statusCode).toBe(400)
      expect((err as ImageStorageError).code).toBe('INVALID_KEY')
    }
  })

  it('validate 失败阻断 upload（mimetype）', async () => {
    const svc = new ImageStorageService()
    await expect(svc.upload({
      buffer: Buffer.from('x'), contentType: 'application/pdf',
      ownerType: 'video', ownerId: 'v', kind: 'poster',
    })).rejects.toThrow(ImageStorageError)
  })
})
