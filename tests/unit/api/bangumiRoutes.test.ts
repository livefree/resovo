/**
 * bangumiRoutes.test.ts — moderation.bangumi.ts 5 端点（ADR-161 / CHG-BNG-08）
 * 鉴权 + zod 校验 + Service 委托。mock BangumiService / BangumiSeedService / videos 查询。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: undefined }))

const mockFindAdminVideoById = vi.fn()
vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: (...a: unknown[]) => mockFindAdminVideoById(...a),
  updateVideoEnrichStatus: vi.fn(),
}))

vi.mock('@/api/services/DoubanService', () => ({
  DoubanService: class {
    searchByKeyword = vi.fn(); confirmSubject = vi.fn(); confirmFields = vi.fn()
    getCandidateData = vi.fn()
  },
}))

const mMatchAndEnrich = vi.fn()
const mSearchCandidates = vi.fn()
const mConfirmMatch = vi.fn()
vi.mock('@/api/services/BangumiService', () => ({
  BangumiService: class {
    matchAndEnrich = mMatchAndEnrich
    searchCandidates = mSearchCandidates
    confirmMatch = mConfirmMatch
  },
}))

const mSeedPlaceholders = vi.fn()
const mListGaps = vi.fn()
vi.mock('@/api/services/BangumiSeedService', () => ({
  BangumiSeedService: class {
    seedPlaceholders = mSeedPlaceholders
    listGaps = mListGaps
  },
}))

const VID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const CID = 'cccccccc-dddd-4eee-8fff-111111111111'

function makeVideo(overrides: Record<string, unknown> = {}) {
  return { id: VID, catalog_id: CID, title_normalized: 'clannad', year: 2007, ...overrides }
}

async function buildApp() {
  const { adminModerationRoutes } = await import('@/api/routes/admin/moderation')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminModerationRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

const modToken = async () => `Bearer ${await signAccessToken({ userId: 'u-1', role: 'moderator' })}`
const adminToken = async () => `Bearer ${await signAccessToken({ userId: 'u-2', role: 'admin' })}`

describe('moderation.bangumi routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let mod: string
  let admin: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindAdminVideoById.mockResolvedValue(makeVideo())
    app = await buildApp()
    mod = await modToken()
    admin = await adminToken()
  })
  afterEach(() => app.close())

  // ── 1. bangumi-sync ───────────────────────────────────────────
  it('sync auto → 200 { updated:true, bangumiSubjectId, episodes }', async () => {
    mMatchAndEnrich.mockResolvedValue({ matched: 'auto', bangumiSubjectId: 51, confidence: 0.92, episodes: 24, degraded: false })
    const res = await app.inject({ method: 'POST', url: `/v1/admin/videos/${VID}/bangumi-sync`, headers: { authorization: mod } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ updated: true, bangumiSubjectId: 51, episodes: 24 })
    expect(mMatchAndEnrich).toHaveBeenCalledWith({ videoId: VID, catalogId: CID, titleNorm: 'clannad', year: 2007 })
  })

  it('sync none → 200 { updated:false, reason }', async () => {
    mMatchAndEnrich.mockResolvedValue({ matched: 'none', reason: 'no_local_match' })
    const res = await app.inject({ method: 'POST', url: `/v1/admin/videos/${VID}/bangumi-sync`, headers: { authorization: mod } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ updated: false, reason: 'no_local_match' })
  })

  it('sync 视频不存在（合法 UUID）→ 404', async () => {
    mockFindAdminVideoById.mockResolvedValue(null)
    const res = await app.inject({ method: 'POST', url: '/v1/admin/videos/bbbbbbbb-cccc-4ddd-8eee-ffffffffffff/bangumi-sync', headers: { authorization: mod } })
    expect(res.statusCode).toBe(404)
  })

  it('sync 非法 UUID path → 422 VALIDATION_ERROR（ADR-161 VideoIdParamsSchema）', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/admin/videos/not-a-uuid/bangumi-sync', headers: { authorization: mod } })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(mockFindAdminVideoById).not.toHaveBeenCalled()
  })

  // ── 2. bangumi-candidates ─────────────────────────────────────
  it('candidates → 200 + keyword 透传', async () => {
    mSearchCandidates.mockResolvedValue([{ bangumiSubjectId: 51, nameCn: 'A', nameJp: 'B', year: 2007, rating: 8.5, coverUrl: null, confidence: 0.92 }])
    const res = await app.inject({ method: 'GET', url: `/v1/admin/videos/${VID}/bangumi-candidates?keyword=clannad`, headers: { authorization: mod } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.candidates).toHaveLength(1)
    expect(mSearchCandidates).toHaveBeenCalledWith({ titleNorm: 'clannad', year: 2007, keyword: 'clannad' })
  })

  it('candidates keyword 超长 → 422', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/admin/videos/${VID}/bangumi-candidates?keyword=${'x'.repeat(201)}`, headers: { authorization: mod } })
    expect(res.statusCode).toBe(422)
  })

  // ── 3. bangumi-confirm ────────────────────────────────────────
  it('confirm → 200 { updated, bangumiSubjectId }', async () => {
    mConfirmMatch.mockResolvedValue({ updated: true })
    const res = await app.inject({
      method: 'POST', url: `/v1/admin/videos/${VID}/bangumi-confirm`,
      headers: { authorization: mod, 'content-type': 'application/json' },
      body: JSON.stringify({ bangumiSubjectId: 51 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ updated: true, bangumiSubjectId: 51 })
    expect(mConfirmMatch).toHaveBeenCalledWith(VID, CID, 51)
  })

  it('confirm 非正整数 subjectId → 422', async () => {
    const res = await app.inject({
      method: 'POST', url: `/v1/admin/videos/${VID}/bangumi-confirm`,
      headers: { authorization: mod, 'content-type': 'application/json' },
      body: JSON.stringify({ bangumiSubjectId: -1 }),
    })
    expect(res.statusCode).toBe(422)
  })

  // ── 4. seed（admin only）──────────────────────────────────────
  it('seed moderator → 403', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/admin/bangumi/seed',
      headers: { authorization: mod, 'content-type': 'application/json' }, body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(403)
    expect(mSeedPlaceholders).not.toHaveBeenCalled()
  })

  it('seed admin → 200 + 默认 limit 200', async () => {
    mSeedPlaceholders.mockResolvedValue({ scanned: 10, created: 7, matched: 3 })
    const res = await app.inject({
      method: 'POST', url: '/v1/admin/bangumi/seed',
      headers: { authorization: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ minRank: 100, year: 2007 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ scanned: 10, created: 7, matched: 3 })
    expect(mSeedPlaceholders).toHaveBeenCalledWith({ minRank: 100, year: 2007, limit: 200 })
  })

  it('seed limit 超上限 → 422', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/admin/bangumi/seed',
      headers: { authorization: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 5000 }),
    })
    expect(res.statusCode).toBe(422)
  })

  // ── 5. gaps ───────────────────────────────────────────────────
  it('gaps → 200 { data, total, page, limit } + 默认分页', async () => {
    mListGaps.mockResolvedValue({ rows: [{ catalogId: 'c-1', bangumiSubjectId: 1, title: 'A', year: 2007, rank: 5, coverUrl: null }], total: 42 })
    const res = await app.inject({ method: 'GET', url: '/v1/admin/bangumi/gaps', headers: { authorization: mod } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(42)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
    expect(body.data).toHaveLength(1)
    expect(mListGaps).toHaveBeenCalledWith({ page: 1, limit: 20 })
  })
})
