/**
 * tests/unit/api/migration.test.ts
 * CHG-31: GET /admin/export/sources, POST /admin/import/sources
 * 导出 Content-Disposition 头、导入 Zod 校验、单条失败不中断、权限检查
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
const { mockRedisGet } = vi.hoisted(() => ({
  mockRedisGet: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/api/lib/redis', () => ({
  redis: { get: mockRedisGet },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))
vi.mock('@/api/lib/queue', () => ({
  verifyQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))

vi.mock('@/api/db/queries/sources', () => ({
  exportAllSources: vi.fn(),
  upsertSource: vi.fn(),
  findSourceById: vi.fn(),
  updateSourceActiveStatus: vi.fn(),
  listAdminSources: vi.fn(),
  deleteSource: vi.fn(),
  batchDeleteSources: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  listSubmissions: vi.fn(),
}))

vi.mock('@/api/db/queries/videos', () => ({
  findVideoIdByShortId: vi.fn(),
  findVideoByShortId: vi.fn(),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import * as sourcesQueriesModule from '@/api/db/queries/sources'
import * as videosQueriesModule from '@/api/db/queries/videos'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockExportAllSources = sourcesQueriesModule.exportAllSources as ReturnType<typeof vi.fn>
const mockUpsertSource = sourcesQueriesModule.upsertSource as ReturnType<typeof vi.fn>
const mockFindVideoId = videosQueriesModule.findVideoIdByShortId as ReturnType<typeof vi.fn>

const MOCK_SOURCES = [
  {
    shortId: 'abc123',
    sourceName: 'test-source',
    sourceUrl: 'https://example.com/video.m3u8',
    isActive: true,
    type: 'hls',
    episodeNumber: null,
  },
]

/** 创建一个模拟 multipart 文件对象（async iterable chunks） */
function makeMultipartFile(content: string, filename = 'sources.json') {
  const chunks = [Buffer.from(content, 'utf-8')]
  return {
    filename,
    mimetype: 'application/json',
    fields: {},
    file: (async function* () {
      for (const chunk of chunks) {
        yield chunk
      }
    })(),
  }
}

async function buildApp(mockFile?: ReturnType<typeof makeMultipartFile>) {
  const { adminMigrationRoutes } = await import('@/api/routes/admin/migration')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })

  // Accept multipart/form-data without real parsing
  app.addContentTypeParser('multipart/form-data', (_req, _payload, done) => {
    done(null, null)
  })

  // Inject mock file() function on request
  app.addHook('preHandler', async (request) => {
    ;(request as Record<string, unknown>).file = async () => mockFile
  })

  setupAuthenticate(app)
  await app.register(adminMigrationRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'admin') {
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

// ── GET /admin/export/sources ─────────────────────────────────────

describe('GET /admin/export/sources (CHG-31)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockExportAllSources.mockResolvedValue(MOCK_SOURCES)
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('未登录返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/export/sources' })
    expect(res.statusCode).toBe(401)
  })

  it('moderator 返回 403（admin only）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/export/sources',
      headers: authHeader('moderator'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('admin 返回 200，Content-Disposition 包含 filename', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/export/sources',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-disposition']).toContain('attachment; filename=sources-')
    expect(res.headers['content-disposition']).toContain('.json')
  })

  it('响应 body 为 JSON 数组，含 shortId 字段', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/export/sources',
      headers: authHeader('admin'),
    })
    const body = JSON.parse(res.body) as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect((body[0] as Record<string, unknown>).shortId).toBe('abc123')
  })
})

// ── POST /admin/import/sources ────────────────────────────────────

describe('POST /admin/import/sources (CHG-31)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockUpsertSource.mockResolvedValue({})
  })

  it('未登录返回 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/import/sources' })
    await app.close()
    expect(res.statusCode).toBe(401)
  })

  it('moderator 返回 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/import/sources',
      headers: authHeader('moderator'),
    })
    await app.close()
    expect(res.statusCode).toBe(403)
  })

  it('无文件返回 422', async () => {
    const app = await buildApp(undefined)
    const res = await app.inject({
      method: 'POST',
      url: '/admin/import/sources',
      headers: { ...authHeader('admin'), 'Content-Type': 'multipart/form-data' },
    })
    await app.close()
    expect(res.statusCode).toBe(422)
  })

  it('有效 JSON：全部导入成功', async () => {
    mockFindVideoId.mockResolvedValue('video-uuid-1')
    const records = [
      { shortId: 'abc123', sourceName: 'src', sourceUrl: 'https://example.com/v.m3u8' },
    ]
    const app = await buildApp(makeMultipartFile(JSON.stringify(records)))
    const res = await app.inject({
      method: 'POST',
      url: '/admin/import/sources',
      headers: { ...authHeader('admin'), 'Content-Type': 'multipart/form-data' },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { imported: number; skipped: number; errors: unknown[] } }>()
    expect(body.data.imported).toBe(1)
    expect(body.data.skipped).toBe(0)
    expect(body.data.errors).toHaveLength(0)
  })

  it('单条 Zod 校验失败不中断（其他记录继续导入）', async () => {
    mockFindVideoId.mockResolvedValue('video-uuid-1')
    const records = [
      { shortId: 'abc123', sourceName: 'src', sourceUrl: 'https://example.com/v.m3u8' },
      { shortId: '', sourceName: '', sourceUrl: 'not-a-url' }, // invalid
      { shortId: 'xyz789', sourceName: 'src2', sourceUrl: 'https://example.com/v2.m3u8' },
    ]
    const app = await buildApp(makeMultipartFile(JSON.stringify(records)))
    const res = await app.inject({
      method: 'POST',
      url: '/admin/import/sources',
      headers: { ...authHeader('admin'), 'Content-Type': 'multipart/form-data' },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { imported: number; errors: unknown[] } }>()
    expect(body.data.imported).toBe(2)
    expect(body.data.errors.length).toBeGreaterThan(0)
  })

  it('视频 short_id 不存在时跳过该条记录', async () => {
    mockFindVideoId.mockResolvedValue(null)
    const records = [{ shortId: 'notexist', sourceName: 'src', sourceUrl: 'https://example.com/v.m3u8' }]
    const app = await buildApp(makeMultipartFile(JSON.stringify(records)))
    const res = await app.inject({
      method: 'POST',
      url: '/admin/import/sources',
      headers: { ...authHeader('admin'), 'Content-Type': 'multipart/form-data' },
    })
    await app.close()
    const body = res.json<{ data: { imported: number; skipped: number } }>()
    expect(body.data.imported).toBe(0)
    expect(body.data.skipped).toBe(1)
    expect(mockUpsertSource).not.toHaveBeenCalled()
  })

  it('非 JSON 格式文件返回 422', async () => {
    const app = await buildApp(makeMultipartFile('not valid json'))
    const res = await app.inject({
      method: 'POST',
      url: '/admin/import/sources',
      headers: { ...authHeader('admin'), 'Content-Type': 'multipart/form-data' },
    })
    await app.close()
    expect(res.statusCode).toBe(422)
  })

  it('JSON 是对象而非数组时返回 422', async () => {
    const app = await buildApp(makeMultipartFile(JSON.stringify({ notAnArray: true })))
    const res = await app.inject({
      method: 'POST',
      url: '/admin/import/sources',
      headers: { ...authHeader('admin'), 'Content-Type': 'multipart/form-data' },
    })
    await app.close()
    expect(res.statusCode).toBe(422)
  })
})
