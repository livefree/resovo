/**
 * tests/unit/api/douban.test.ts
 * CHG-23: POST /admin/videos/:id/douban-sync — 权限、匹配成功、抓取失败降级
 * CHG-367: 适配 media_catalog 层（syncVideo 改用 catalog.doubanId / safeUpdate）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

// ── Mocks（依赖层，不 mock Service 本身，让真实 Service 运行） ──

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))

vi.mock('@/api/db/queries/videos', () => ({
  findVideoByShortId: vi.fn(),
  findAdminVideoById: vi.fn(),
  updateDoubanData: vi.fn(),
  listVideos: vi.fn(),
  listTrendingVideos: vi.fn(),
  listAdminVideos: vi.fn(),
  createVideo: vi.fn(),
  updateVideoMeta: vi.fn(),
  publishVideo: vi.fn(),
  batchPublishVideos: vi.fn(),
}))

vi.mock('@/api/db/queries/mediaCatalog', () => ({
  findCatalogById: vi.fn(),
  updateCatalogFields: vi.fn(),
  setLockedFields: vi.fn(),
  addLockedFields: vi.fn(),
  insertCatalog: vi.fn(),
}))

vi.mock('@/api/lib/douban', () => ({
  searchDouban: vi.fn(),
  getDoubanDetail: vi.fn(),
}))

import * as videoQueries from '@/api/db/queries/videos'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import * as doubanLib from '@/api/lib/douban'

const mockVQ = videoQueries as {
  findAdminVideoById: ReturnType<typeof vi.fn>
  updateDoubanData: ReturnType<typeof vi.fn>
}
const mockCQ = catalogQueries as {
  findCatalogById: ReturnType<typeof vi.fn>
  updateCatalogFields: ReturnType<typeof vi.fn>
}
const mockSearch = doubanLib.searchDouban as ReturnType<typeof vi.fn>
const mockDetail = doubanLib.getDoubanDetail as ReturnType<typeof vi.fn>

// ── 测试数据 ─────────────────────────────────────────────────────

const VIDEO_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const CATALOG_ID = 'cccccccc-dddd-eeee-ffff-111111111111'

const DEFAULT_VIDEO_ROW = {
  id: VIDEO_ID,
  title: '流浪地球',
  year: 2019,
  catalog_id: CATALOG_ID,
}

const DEFAULT_CATALOG_ROW = {
  id: CATALOG_ID,
  title: '流浪地球',
  year: 2019,
  doubanId: null,
  metadataSource: 'crawler',
  lockedFields: [] as string[],
}

function makeToken(role: 'admin' | 'moderator' | 'user') {
  return `Bearer ${signAccessToken({ userId: 'user-1', role })}`
}

// ── 辅助：测试 app ────────────────────────────────────────────────

async function buildApp() {
  const { adminVideoRoutes } = await import('@/api/routes/admin/videos')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminVideoRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

// ═══════════════════════════════════════════════════════════════
// POST /v1/admin/videos/:id/douban-sync（HTTP 层权限测试）
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/admin/videos/:id/douban-sync', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    // 默认：视频存在，catalog 无 douban_id，搜索无结果（降级 no_match）
    mockVQ.findAdminVideoById.mockResolvedValue({ ...DEFAULT_VIDEO_ROW })
    mockCQ.findCatalogById.mockResolvedValue({ ...DEFAULT_CATALOG_ROW })
    mockSearch.mockResolvedValue([])
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('未登录返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VIDEO_ID}/douban-sync`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('moderator 权限返回 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VIDEO_ID}/douban-sync`,
      headers: { authorization: makeToken('moderator') },
    })
    expect(res.statusCode).toBe(403)
  })

  it('user 权限返回 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VIDEO_ID}/douban-sync`,
      headers: { authorization: makeToken('user') },
    })
    expect(res.statusCode).toBe(403)
  })

  it('匹配成功时返回 200 updated:true 和 fields', async () => {
    mockSearch.mockResolvedValue([{ id: '26266893', title: '流浪地球' }])
    mockDetail.mockResolvedValue({
      id: '26266893',
      title: '流浪地球',
      year: 2019,
      rating: 7.9,
      summary: '近未来，太阳急速老化膨胀...',
      directors: ['郭帆'],
      casts: ['吴京', '屈楚萧'],
      posterUrl: 'https://img.douban.com/view/photo/s_ratio_poster/public/p2544305534.jpg',
    })
    mockCQ.updateCatalogFields.mockResolvedValue({
      ...DEFAULT_CATALOG_ROW,
      doubanId: '26266893',
      rating: 7.9,
      metadataSource: 'douban',
    })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VIDEO_ID}/douban-sync`,
      headers: { authorization: makeToken('admin') },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.updated).toBe(true)
    expect(body.data.doubanId).toBe('26266893')
    expect(body.data.fields).toContain('rating')
  })

  it('搜索无结果降级返回 updated:false reason:no_match，不抛 500', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VIDEO_ID}/douban-sync`,
      headers: { authorization: makeToken('admin') },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ updated: false, reason: 'no_match' })
  })

  it('ID 格式非法返回 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/videos/not-a-uuid/douban-sync',
      headers: { authorization: makeToken('admin') },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════
// DoubanService.syncVideo 单元测试（真实 Service + mock 依赖）
// ═══════════════════════════════════════════════════════════════

import { DoubanService } from '@/api/services/DoubanService'

describe('DoubanService.syncVideo', () => {
  let service: DoubanService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DoubanService({} as ReturnType<typeof import('pg').Pool>)
    mockVQ.findAdminVideoById.mockResolvedValue({ ...DEFAULT_VIDEO_ROW })
    mockCQ.findCatalogById.mockResolvedValue({ ...DEFAULT_CATALOG_ROW })
    mockCQ.updateCatalogFields.mockResolvedValue({
      ...DEFAULT_CATALOG_ROW,
      metadataSource: 'douban',
    })
  })

  it('catalog 已有 douban_id 时跳过', async () => {
    mockCQ.findCatalogById.mockResolvedValue({
      ...DEFAULT_CATALOG_ROW,
      doubanId: '26266893',
    })

    const result = await service.syncVideo(VIDEO_ID)
    expect(result).toEqual({ updated: false, reason: 'already_synced' })
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('搜索无结果时返回 no_match', async () => {
    mockSearch.mockResolvedValue([])
    const result = await service.syncVideo(VIDEO_ID)
    expect(result).toEqual({ updated: false, reason: 'no_match' })
  })

  it('相似度不足时返回 no_match', async () => {
    mockSearch.mockResolvedValue([{ id: '12345', title: '完全不相关的电影' }])
    const result = await service.syncVideo(VIDEO_ID)
    expect(result).toEqual({ updated: false, reason: 'no_match' })
  })

  it('匹配成功时更新 catalog，返回 updated:true', async () => {
    mockSearch.mockResolvedValue([{ id: '26266893', title: '流浪地球' }])
    mockDetail.mockResolvedValue({
      id: '26266893',
      title: '流浪地球',
      year: 2019,
      rating: 7.9,
      summary: '近未来，太阳急速老化膨胀...',
      directors: ['郭帆'],
      casts: ['吴京', '屈楚萧'],
      posterUrl: 'https://img.douban.com/view/photo/s_ratio_poster/public/p2544305534.jpg',
    })
    mockCQ.updateCatalogFields.mockResolvedValue({
      ...DEFAULT_CATALOG_ROW,
      doubanId: '26266893',
      rating: 7.9,
      metadataSource: 'douban',
    })

    const result = await service.syncVideo(VIDEO_ID)
    expect(result).toMatchObject({ updated: true, doubanId: '26266893' })
    expect((result as { fields: string[] }).fields).toContain('rating')
    expect(mockCQ.updateCatalogFields).toHaveBeenCalledWith(
      expect.anything(),
      CATALOG_ID,
      expect.objectContaining({ doubanId: '26266893', rating: 7.9, metadataSource: 'douban' })
    )
  })

  it('getDoubanDetail 返回 null 时降级 fetch_failed', async () => {
    mockSearch.mockResolvedValue([{ id: '26266893', title: '流浪地球' }])
    mockDetail.mockResolvedValue(null)

    const result = await service.syncVideo(VIDEO_ID)
    expect(result).toEqual({ updated: false, reason: 'fetch_failed' })
  })

  it('searchDouban 抛出异常时降级 fetch_failed', async () => {
    mockSearch.mockRejectedValue(new Error('网络超时'))
    const result = await service.syncVideo(VIDEO_ID)
    expect(result).toEqual({ updated: false, reason: 'fetch_failed' })
  })
})
