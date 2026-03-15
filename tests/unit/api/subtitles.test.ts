/**
 * tests/unit/api/subtitles.test.ts
 * SUBTITLE-01: 字幕上传格式/大小限制、401
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null) },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))
vi.mock('@/api/db/queries/subtitles', () => ({
  findSubtitlesByVideoId: vi.fn().mockResolvedValue([]),
  createSubtitle: vi.fn(),
  findSubtitleById: vi.fn(),
  verifySubtitle: vi.fn(),
}))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
}))

import * as subtitleQueries from '@/api/db/queries/subtitles'
import * as authLib from '@/api/lib/auth'

const mockFindSubtitles = subtitleQueries.findSubtitlesByVideoId as ReturnType<typeof vi.fn>
const mockCreateSubtitle = subtitleQueries.createSubtitle as ReturnType<typeof vi.fn>

// ── 测试数据 ─────────────────────────────────────────────────────

const MOCK_SUBTITLE = {
  id: 'sub-1',
  videoId: 'vid-1',
  episodeNumber: null,
  language: 'zh-CN',
  label: '中文简体',
  fileUrl: 'https://r2.resovo.dev/bucket/subtitles/vid-1/zh-CN.vtt',
  format: 'vtt' as const,
  isVerified: false,
  createdAt: '2026-03-15T00:00:00.000Z',
}

// ── 辅助函数 ──────────────────────────────────────────────────────

async function buildApp() {
  const { subtitleRoutes } = await import('@/api/routes/subtitles')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)

  // Accept multipart/form-data without @fastify/multipart (avoids 415)
  app.addContentTypeParser('multipart/form-data', (_req, _payload, done) => {
    done(null, null)
  })

  // Mock multipart: inject file() on request (returns multipartData or undefined)
  app.addHook('preHandler', async (request) => {
    const multipartData = (request as Record<string, unknown>)._mockMultipart
    ;(request as Record<string, unknown>).file = async () => multipartData ?? undefined
  })

  await app.register(subtitleRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

function authHeader(role: 'user' | 'admin' = 'user') {
  const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

// ── GET /v1/videos/:id/subtitles ──────────────────────────────────

describe('GET /v1/videos/:id/subtitles', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindSubtitles.mockResolvedValue([MOCK_SUBTITLE])
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('返回字幕列表', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/vid-1/subtitles' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(1)
    expect(res.json().data[0]).toMatchObject({
      language: 'zh-CN',
      format: 'vtt',
      isVerified: false,
    })
  })

  it('无字幕时返回空数组', async () => {
    mockFindSubtitles.mockResolvedValueOnce([])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/vid-1/subtitles' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(0)
  })

  it('支持 episode 查询参数', async () => {
    mockFindSubtitles.mockResolvedValueOnce([])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/vid-1/subtitles?episode=3' })
    expect(res.statusCode).toBe(200)
    expect(mockFindSubtitles).toHaveBeenCalledWith(expect.anything(), 'vid-1', 3)
  })
})

// ── SubtitleService.validateFile ──────────────────────────────────

describe('SubtitleService.validateFile', () => {
  it('有效 .vtt 文件通过验证', async () => {
    const { SubtitleService } = await import('@/api/services/SubtitleService')
    const svc = new SubtitleService({} as never)
    expect(() => svc.validateFile('subtitle.vtt', 1024)).not.toThrow()
  })

  it('有效 .srt 文件通过验证', async () => {
    const { SubtitleService } = await import('@/api/services/SubtitleService')
    const svc = new SubtitleService({} as never)
    expect(() => svc.validateFile('subtitle.srt', 1024)).not.toThrow()
  })

  it('有效 .ass 文件通过验证', async () => {
    const { SubtitleService } = await import('@/api/services/SubtitleService')
    const svc = new SubtitleService({} as never)
    expect(() => svc.validateFile('subtitle.ass', 500)).not.toThrow()
  })

  it('不支持的格式（.txt）→ 抛出 422 错误', async () => {
    const { SubtitleService } = await import('@/api/services/SubtitleService')
    const svc = new SubtitleService({} as never)
    expect(() => svc.validateFile('subtitle.txt', 100)).toThrow()
    try {
      svc.validateFile('subtitle.txt', 100)
    } catch (err) {
      expect((err as { statusCode?: number }).statusCode).toBe(422)
    }
  })

  it('不支持的格式（.mp4）→ 抛出 422 错误', async () => {
    const { SubtitleService } = await import('@/api/services/SubtitleService')
    const svc = new SubtitleService({} as never)
    expect(() => svc.validateFile('video.mp4', 100)).toThrow()
  })

  it('超过 2MB → 抛出 413 错误', async () => {
    const { SubtitleService } = await import('@/api/services/SubtitleService')
    const svc = new SubtitleService({} as never)
    const over2MB = 2 * 1024 * 1024 + 1
    try {
      svc.validateFile('subtitle.vtt', over2MB)
      expect.fail('Should have thrown')
    } catch (err) {
      expect((err as { statusCode?: number }).statusCode).toBe(413)
    }
  })

  it('正好 2MB 通过验证', async () => {
    const { SubtitleService } = await import('@/api/services/SubtitleService')
    const svc = new SubtitleService({} as never)
    expect(() => svc.validateFile('subtitle.vtt', 2 * 1024 * 1024)).not.toThrow()
  })

  it('validateFile 返回正确的 format', async () => {
    const { SubtitleService } = await import('@/api/services/SubtitleService')
    const svc = new SubtitleService({} as never)
    expect(svc.validateFile('sub.srt', 100).format).toBe('srt')
    expect(svc.validateFile('sub.ass', 100).format).toBe('ass')
    expect(svc.validateFile('sub.vtt', 100).format).toBe('vtt')
  })
})

// ── POST /v1/videos/:id/subtitles 权限校验 ───────────────────────

describe('POST /v1/videos/:id/subtitles', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockCreateSubtitle.mockResolvedValue(MOCK_SUBTITLE)
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('未登录返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/vid-1/subtitles',
    })
    expect(res.statusCode).toBe(401)
  })

  it('已登录但无文件返回 422', async () => {
    // 不注入 _mockMultipart，file() 返回 undefined
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/vid-1/subtitles',
      headers: { ...authHeader('user'), 'Content-Type': 'multipart/form-data' },
    })
    expect(res.statusCode).toBe(422)
  })
})
