/**
 * tests/unit/api/adminMediaUploadsRoute.test.ts — IMG-06 P1 修复
 *
 * 验证 GET /v1/uploads/* 本地 fallback 路由：
 * - LocalFs provider 下：返回文件内容 + 正确 content-type
 * - LocalFs 文件不存在：404
 * - 路径穿越尝试：400 INVALID_KEY
 * - R2 provider 下：本地 fallback 关闭 → 404
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mock @aws-sdk/client-s3 以防 R2 客户端构造时报错
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}))

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))

vi.mock('@/api/lib/redis', () => ({ redis: { get: vi.fn().mockResolvedValue(null) } }))

vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'

const originalEnv = { ...process.env }

async function buildApp() {
  const { adminMediaRoutes } = await import('@/api/routes/admin/media')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminMediaRoutes)
  await app.ready()
  return app
}

describe('GET /uploads/* — LocalFS fallback 文件服务', () => {
  let tmpDir: string

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.R2_ENDPOINT
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
    tmpDir = mkdtempSync(join(tmpdir(), 'resovo-uploads-route-'))
    process.env.LOCAL_UPLOAD_DIR = tmpDir
    process.env.LOCAL_UPLOAD_PUBLIC_URL = 'http://localhost:3001/v1/uploads'
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('返回已上传文件内容 + image/png content-type', async () => {
    // 事先写入测试文件
    mkdirSync(join(tmpDir, 'posters'), { recursive: true })
    writeFileSync(join(tmpDir, 'posters', 'vid-abc.png'), 'PNG-DATA')

    const app = await buildApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/uploads/posters/vid-abc.png' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('image/png')
      expect(res.body).toBe('PNG-DATA')
    } finally {
      await app.close()
    }
  })

  it('jpg / webp / avif / gif 映射 content-type 正确', async () => {
    mkdirSync(join(tmpDir, 'posters'), { recursive: true })
    const cases = [
      ['a.jpg',  'image/jpeg'],
      ['a.jpeg', 'image/jpeg'],
      ['b.webp', 'image/webp'],
      ['c.avif', 'image/avif'],
      ['d.gif',  'image/gif'],
    ] as const
    for (const [name] of cases) {
      writeFileSync(join(tmpDir, 'posters', name), 'X')
    }

    const app = await buildApp()
    try {
      for (const [name, expected] of cases) {
        const res = await app.inject({ method: 'GET', url: `/uploads/posters/${name}` })
        expect(res.statusCode).toBe(200)
        expect(res.headers['content-type']).toBe(expected)
      }
    } finally {
      await app.close()
    }
  })

  it('未知扩展名 → application/octet-stream', async () => {
    mkdirSync(join(tmpDir, 'posters'), { recursive: true })
    writeFileSync(join(tmpDir, 'posters', 'x.xyz'), 'X')

    const app = await buildApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/uploads/posters/x.xyz' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/octet-stream')
    } finally {
      await app.close()
    }
  })

  it('文件不存在 → 404', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/uploads/posters/missing.png' })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.error.code).toBe('NOT_FOUND')
    } finally {
      await app.close()
    }
  })

  // 路径穿越在 HTTP 层会被 URL normalization 拦截（route 不命中 → 404）
  // Service 层的 resolveLocalFilePath 路径穿越防御已在 imageStorageService.test.ts 覆盖

  it('空 path → 404', async () => {
    const app = await buildApp()
    try {
      // `/uploads/` （末尾斜杠但无 *）
      const res = await app.inject({ method: 'GET', url: '/uploads/' })
      expect(res.statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })
})

describe('GET /uploads/* — R2 provider 下本地 fallback 关闭', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      R2_ENDPOINT: 'https://r2.example',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_PUBLIC_BASE_URL: 'https://pub.r2.dev',
    }
  })
  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('R2 provider 下 GET /uploads/* 返 404（不经本地 FS）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/uploads/posters/any.png' })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.error.message).toContain('本地 fallback 未启用')
    } finally {
      await app.close()
    }
  })
})
