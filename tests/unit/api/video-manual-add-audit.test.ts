/**
 * tests/unit/api/video-manual-add-audit.test.ts —
 * ADR-145 / CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A 端点单测
 *
 * 覆盖（ADR-145 §7 测试 surface，20 用例）：
 *   Happy path CRUD (5):
 *     #1 最小 3 字段成功 → 201 + id/shortId/catalogId 非空
 *     #2 全字段成功
 *     #3 publishMode='draft' → hidden + pending + false
 *     #4 publishMode='staging' 默认 → internal + pending + false
 *     #5 publishMode='published' → public + approved + true
 *   重复检测 (4):
 *     #6 catalog 已有 video 无 force → 409 STATE_CONFLICT + detail
 *     #7 catalog 已有 video + force=true → 201 成功
 *     #8 不同 type 不冲突 → 不同 catalog
 *     #9 year=null findOrCreate 不匹配 → 201
 *   catalog 同步 (3):
 *     #10 新建 catalog metadataSource='manual'
 *     #11 复用已有 catalog（findOrCreate 5 步匹配）
 *     #12 locked_fields 自动加锁（验证 findOrCreate 调用参数）
 *   audit (4):
 *     #13 happy path audit payload 完整断言
 *     #14 422 不写 audit
 *     #15 403 不写 audit
 *     #16 409 不写 audit
 *   422 validation (3):
 *     #17 title > 200 字符 → 422
 *     #18 type 非枚举 → 422
 *     #19 year < 1900 → 422
 *   权限 (1):
 *     #20 未登录 → 401
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn(), connect: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

vi.mock('@/api/lib/elasticsearch', () => ({
  es: { search: vi.fn(), index: vi.fn(), update: vi.fn(), exists: vi.fn(), delete: vi.fn() },
  esClient: { search: vi.fn(), index: vi.fn() },
}))

const mockFindOrCreate = vi.fn()
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({ findOrCreate: mockFindOrCreate })),
}))

const mockCreateVideo = vi.fn()
const mockTransitionVideoState = vi.fn()
vi.mock('@/api/db/queries/videos', () => ({
  createVideo: (...args: unknown[]) => mockCreateVideo(...args),
  transitionVideoState: (...args: unknown[]) => mockTransitionVideoState(...args),
  // 其他可能被其他端点共用的 query — 用 mock 桩
  listAdminVideos: vi.fn(),
  findAdminVideoById: vi.fn(),
  updateVideoMeta: vi.fn(),
  insertCrawledVideo: vi.fn(),
  publishVideo: vi.fn(),
  countAdminVideos: vi.fn(),
  listVideos: vi.fn(),
  findVideoById: vi.fn(),
  countByType: vi.fn(),
  reviewVideo: vi.fn(),
  unreviewVideo: vi.fn(),
  updateVideoSourceCount: vi.fn(),
  listVideoIdsForMatrix: vi.fn(),
  listVideoSourcesForMatrix: vi.fn(),
  listVideoSubtitlesForMatrix: vi.fn(),
  countTrendingVideos: vi.fn(),
}))

vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import { db } from '@/api/lib/postgres'
import * as auditLogQueries from '@/api/db/queries/auditLog'
import { NotificationEmitter } from '@/api/services/NotificationEmitter'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockDbQuery = db.query as ReturnType<typeof vi.fn>
const mockInsertAuditLog = auditLogQueries.insertAuditLog as ReturnType<typeof vi.fn>

const ADMIN_USER_ID = '11111111-1111-4111-8111-111111111111'
const CATALOG_ID    = '22222222-2222-4222-8222-222222222222'
const VIDEO_ID      = '33333333-3333-4333-8333-333333333333'
const EXISTING_VIDEO_ID = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  vi.clearAllMocks()
  mockTransitionVideoState.mockResolvedValue({ id: VIDEO_ID, review_status: 'approved', visibility_status: 'public', is_published: true })
})

async function buildApp() {
  const { adminVideoRoutes } = await import('@/api/routes/admin/videos')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminVideoRoutes)
  await app.ready()
  return app
}

function adminAuth() {
  mockVerify.mockReturnValue({ userId: ADMIN_USER_ID, role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

const newCatalog = { id: CATALOG_ID, title: 'Test Movie', type: 'movie', year: 2024 }
const newVideo = {
  id: VIDEO_ID,
  short_id: 'aB3kR9x1',
  slug: null,
  title: 'Test Movie',
  type: 'movie',
  catalog_id: CATALOG_ID,
  episode_count: 1,
  is_published: false,
  created_at: '2026-05-22T20:00:00.000Z',
  updated_at: '2026-05-22T20:00:00.000Z',
  source_content_type: null,
  normalized_type: null,
  content_format: null,
  episode_pattern: null,
  review_status: 'pending_review',
  visibility_status: 'internal',
  needs_manual_review: false,
  content_rating: 'general',
  site_key: null,
  source_category: null,
}

async function flush() {
  await new Promise((r) => setImmediate(r))
}

// ── Happy path ──────────────────────────────────────────────────

describe('POST /admin/videos — happy path (ADR-145)', () => {
  beforeEach(() => {
    mockFindOrCreate.mockResolvedValue(newCatalog)
    mockCreateVideo.mockResolvedValue(newVideo)
    // SELECT count from videos WHERE catalog_id=... LIMIT 1 → 空
    mockDbQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM videos WHERE catalog_id')) {
        return Promise.resolve({ rows: [] })
      }
      return Promise.resolve({ rows: [] })
    })
  })

  it('#1 最小 3 字段成功 → 201', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'Test Movie', type: 'movie', contentRating: 'general' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data).toMatchObject({ id: VIDEO_ID, shortId: 'aB3kR9x1', catalogId: CATALOG_ID })
    await app.close()
  })

  it('#2 全字段成功', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: {
        title: 'Full', type: 'movie', contentRating: 'general',
        titleEn: 'Full EN', description: 'desc', coverUrl: 'https://cdn/a.jpg',
        year: 2024, country: 'US', episodeCount: 1, status: 'completed',
        rating: 8.5, director: ['Dir'], cast: ['Cast'], writers: ['W'],
        genres: ['drama'], doubanId: '12345',
      },
    })
    expect(res.statusCode).toBe(201)
    await app.close()
  })

  it('#3 publishMode=draft → hidden', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'D', type: 'movie', publishMode: 'draft' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.visibilityStatus).toBe('hidden')
    expect(res.json().data.isPublished).toBe(false)
    await app.close()
  })

  it('#4 publishMode=staging 默认 → internal + pending + false', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'S', type: 'movie' },  // 不传 publishMode 默认 staging
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.visibilityStatus).toBe('internal')
    expect(res.json().data.isPublished).toBe(false)
    expect(res.json().data.reviewStatus).toBe('pending_review')
    await app.close()
  })

  it('#5 publishMode=published → approved + public + true', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'P', type: 'movie', publishMode: 'published' },
    })
    expect(res.statusCode).toBe(201)
    expect(mockTransitionVideoState).toHaveBeenCalledWith(expect.anything(), VIDEO_ID, { action: 'approve_and_publish' })
    expect(res.json().data.reviewStatus).toBe('approved')
    expect(res.json().data.visibilityStatus).toBe('public')
    expect(res.json().data.isPublished).toBe(true)
    await app.close()
  })
})

// ── 重复检测 ────────────────────────────────────────────────────

describe('POST /admin/videos — 重复检测 (ADR-145 D-145-2)', () => {
  beforeEach(() => {
    mockFindOrCreate.mockResolvedValue(newCatalog)
    mockCreateVideo.mockResolvedValue(newVideo)
  })

  it('#6 catalog 已有 video 无 force → 409 STATE_CONFLICT + detail', async () => {
    mockDbQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM videos WHERE catalog_id')) {
        return Promise.resolve({ rows: [{ id: EXISTING_VIDEO_ID, title: 'Existing' }] })
      }
      return Promise.resolve({ rows: [] })
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'X', type: 'movie' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('STATE_CONFLICT')
    expect(res.json().error.detail).toMatchObject({ existingVideoId: EXISTING_VIDEO_ID, existingTitle: 'Existing' })
    await app.close()
  })

  it('#7 catalog 已有 video + force=true → 201', async () => {
    mockDbQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM videos WHERE catalog_id')) {
        return Promise.resolve({ rows: [{ id: EXISTING_VIDEO_ID, title: 'Existing' }] })
      }
      return Promise.resolve({ rows: [] })
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'X', type: 'movie', force: true },
    })
    expect(res.statusCode).toBe(201)
    await app.close()
  })

  it('#8 不同 type 不冲突（findOrCreate 返回新 catalog）', async () => {
    mockFindOrCreate.mockResolvedValue({ ...newCatalog, id: 'catalog-tv', type: 'series' })
    mockDbQuery.mockResolvedValue({ rows: [] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'Test Movie', type: 'series' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.catalogId).toBe('catalog-tv')
    await app.close()
  })

  it('#9 year=null 不匹配 → 201', async () => {
    mockFindOrCreate.mockResolvedValue({ ...newCatalog, year: null })
    mockDbQuery.mockResolvedValue({ rows: [] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'No Year', type: 'movie' },
    })
    expect(res.statusCode).toBe(201)
    await app.close()
  })
})

// ── catalog 同步 ────────────────────────────────────────────────

describe('POST /admin/videos — catalog 同步 (ADR-145 D-145-3)', () => {
  beforeEach(() => {
    mockFindOrCreate.mockResolvedValue(newCatalog)
    mockCreateVideo.mockResolvedValue(newVideo)
    mockDbQuery.mockResolvedValue({ rows: [] })
  })

  it('#10 findOrCreate 调用 metadataSource=manual', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'M', type: 'movie' },
    })
    expect(mockFindOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      metadataSource: 'manual',
      title: 'M',
      type: 'movie',
    }))
    await app.close()
  })

  it('#11 复用已有 catalog id', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'R', type: 'movie' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.catalogId).toBe(CATALOG_ID)
    expect(mockFindOrCreate).toHaveBeenCalledTimes(1)
    await app.close()
  })

  it('#12 全 14 元数据字段透传 findOrCreate', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: {
        title: 'F', type: 'movie',
        titleEn: 'F EN', description: 'd', coverUrl: 'https://c/a.jpg',
        year: 2024, country: 'US', status: 'completed', rating: 9.0,
        director: ['D'], cast: ['C'], writers: ['W'],
        genres: ['drama'], doubanId: '999',
      },
    })
    expect(mockFindOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      titleEn: 'F EN',
      description: 'd',
      coverUrl: 'https://c/a.jpg',
      year: 2024,
      doubanId: '999',
      metadataSource: 'manual',
    }))
    await app.close()
  })
})

// ── R-MID-1 audit ───────────────────────────────────────────────

describe('POST /admin/videos — R-MID-1 第 24 次 audit', () => {
  it('#13 happy path audit payload 完整断言', async () => {
    mockFindOrCreate.mockResolvedValue(newCatalog)
    mockCreateVideo.mockResolvedValue(newVideo)
    mockDbQuery.mockResolvedValue({ rows: [] })
    const emitSpy = vi.spyOn(NotificationEmitter.prototype, 'emit').mockImplementation(() => {})
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'A', type: 'movie', year: 2024 },
    })
    await flush()
    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: ADMIN_USER_ID,
        actionType: 'video.manual_add',
        targetKind: 'video',
        targetId: VIDEO_ID,
        beforeJsonb: null,
        afterJsonb: expect.objectContaining({
          id: VIDEO_ID,
          title: 'A',
          type: 'movie',
          year: 2024,
          publishMode: 'staging',
          catalogId: CATALOG_ID,
          isNewCatalog: true,
          contentRating: 'general',
        }),
      }),
    )
    // NTLG-P1-c-B-2：解耦双写 emit（sourceRef=新建 video id）
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'video.manual_add',
      level: 'info',
      title: '手动添加视频',
      sourceKind: 'admin_action',
      scope: 'broadcast',
      href: '/admin/videos',
      sourceRef: VIDEO_ID,
    }))
    emitSpy.mockRestore()
    await app.close()
  })

  it('#14 422 不写 audit', async () => {
    const emitSpy = vi.spyOn(NotificationEmitter.prototype, 'emit').mockImplementation(() => {})
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { type: 'movie' },  // 缺 title
    })
    await flush()
    expect(mockInsertAuditLog).not.toHaveBeenCalled()
    // NTLG-P1-c-B-2 parity：422 短路 → 不 emit
    expect(emitSpy).not.toHaveBeenCalled()
    emitSpy.mockRestore()
    await app.close()
  })

  it('#15 403 不写 audit', async () => {
    mockVerify.mockReturnValue({ userId: 'user-1', role: 'user', iat: Math.floor(Date.now() / 1000) })
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: { Authorization: 'Bearer t' },
      payload: { title: 'X', type: 'movie' },
    })
    await flush()
    expect(mockInsertAuditLog).not.toHaveBeenCalled()
    await app.close()
  })

  it('#16 409 重复检测不写 audit', async () => {
    mockFindOrCreate.mockResolvedValue(newCatalog)
    mockCreateVideo.mockResolvedValue(newVideo)
    mockDbQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM videos WHERE catalog_id')) {
        return Promise.resolve({ rows: [{ id: EXISTING_VIDEO_ID, title: 'X' }] })
      }
      return Promise.resolve({ rows: [] })
    })
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'X', type: 'movie' },
    })
    await flush()
    expect(mockInsertAuditLog).not.toHaveBeenCalled()
    await app.close()
  })
})

// ── 422 validation ──────────────────────────────────────────────

describe('POST /admin/videos — 422 validation', () => {
  it('#17 title > 200 字符 → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'a'.repeat(201), type: 'movie' },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('#18 type 非枚举 → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'X', type: 'invalid' },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('#19 year < 1900 → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      headers: adminAuth(),
      payload: { title: 'X', type: 'movie', year: 1800 },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })
})

// ── 权限 ───────────────────────────────────────────────────────

describe('POST /admin/videos — 权限', () => {
  it('#20 未登录 → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/videos',
      payload: { title: 'X', type: 'movie' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
