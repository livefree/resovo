/**
 * moderation-tmdb-route.test.ts — moderation.tmdb.ts 3 端点（ADR-202 §端点契约 / META-39-A）
 * 鉴权 + zod 校验 + Service 委托 + CONFIRM_FAILED 映射。mock TmdbConfirmService / videos 查询。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

vi.mock('@/api/lib/redis', () => ({ redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') } }))
vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: undefined }))

const mockFindAdminVideoById = vi.fn()
vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: (...a: unknown[]) => mockFindAdminVideoById(...a),
  updateVideoEnrichStatus: vi.fn(),
}))
vi.mock('@/api/services/DoubanService', () => ({ DoubanService: class { searchByKeyword = vi.fn(); confirmSubject = vi.fn(); confirmFields = vi.fn(); getCandidateData = vi.fn() } }))
vi.mock('@/api/services/BangumiService', () => ({ BangumiService: class { matchAndEnrich = vi.fn(); searchCandidates = vi.fn(); confirmMatch = vi.fn() } }))
vi.mock('@/api/services/BangumiSeedService', () => ({ BangumiSeedService: class { seedPlaceholders = vi.fn(); listGaps = vi.fn() } }))

const mSearch = vi.fn(); const mConfirm = vi.fn(); const mReject = vi.fn()
vi.mock('@/api/services/TmdbConfirmService', () => ({
  TmdbConfirmService: class { search = mSearch; confirm = mConfirm; reject = mReject },
  TMDB_APPLIABLE_FIELDS: ['title', 'title_original', 'original_language', 'description', 'genres', 'rating', 'cover_url'],
}))

const VID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const CID = 'cccccccc-dddd-4eee-8fff-111111111111'

async function buildApp() {
  const { adminModerationRoutes } = await import('@/api/routes/admin/moderation')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminModerationRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

describe('moderation.tmdb routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let mod: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindAdminVideoById.mockResolvedValue({ id: VID, catalog_id: CID, title: '千与千寻' })
    app = await buildApp()
    mod = `Bearer ${await signAccessToken({ userId: 'u-1', role: 'moderator' })}`
  })
  afterEach(async () => { await app.close() })

  const inject = (path: string, payload: Record<string, unknown>, token?: string) =>
    app.inject({ method: 'POST', url: `/v1${path}`, headers: token ? { authorization: token } : {}, payload })

  it('tmdb-search → 200 candidates，传 fallback title', async () => {
    mSearch.mockResolvedValue({ candidates: [{ tmdbId: 129, title: '千与千寻' }] })
    const res = await inject(`/admin/videos/${VID}/tmdb-search`, { mediaType: 'movie' }, mod)
    expect(res.statusCode).toBe(200)
    expect(res.json().data.candidates).toHaveLength(1)
    expect(mSearch).toHaveBeenCalledWith('千与千寻', expect.objectContaining({ mediaType: 'movie' }))
  })

  it('tmdb-search 缺 mediaType → 422', async () => {
    const res = await inject(`/admin/videos/${VID}/tmdb-search`, {}, mod)
    expect(res.statusCode).toBe(422)
  })

  it('tmdb-confirm → 200 confirmed + applied', async () => {
    mConfirm.mockResolvedValue({ updated: true, applied: ['title', 'genres'] })
    const res = await inject(`/admin/videos/${VID}/tmdb-confirm`, { tmdbId: 129, mediaType: 'movie', fields: ['title', 'genres'] }, mod)
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ id: VID, confirmed: true, applied: ['title', 'genres'] })
    expect(mConfirm).toHaveBeenCalledWith(VID, CID, expect.objectContaining({ tmdbId: 129, mediaType: 'movie' }))
  })

  it('tmdb-confirm video 不存在 → 404', async () => {
    mockFindAdminVideoById.mockResolvedValue(null)
    const res = await inject(`/admin/videos/${VID}/tmdb-confirm`, { tmdbId: 129, mediaType: 'movie' }, mod)
    expect(res.statusCode).toBe(404)
    expect(mConfirm).not.toHaveBeenCalled()
  })

  it('tmdb-confirm 冲突降级 → 422 CONFIRM_FAILED（不 409）', async () => {
    mConfirm.mockResolvedValue({ updated: false, reason: 'tmdb_exact_conflict', holderCatalogId: 'other' })
    const res = await inject(`/admin/videos/${VID}/tmdb-confirm`, { tmdbId: 129, mediaType: 'movie' }, mod)
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('CONFIRM_FAILED')
    expect(res.json().error.message).toBe('tmdb_exact_conflict')
  })

  it('tmdb-confirm 非法 fields 枚举 → 422', async () => {
    const res = await inject(`/admin/videos/${VID}/tmdb-confirm`, { tmdbId: 129, mediaType: 'movie', fields: ['bogus'] }, mod)
    expect(res.statusCode).toBe(422)
  })

  it('tmdb-reject → 200 rejected', async () => {
    mReject.mockResolvedValue({ rejected: true })
    const res = await inject(`/admin/videos/${VID}/tmdb-reject`, { tmdbId: 129 }, mod)
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ id: VID, rejected: true })
  })

  it('无 token → 401', async () => {
    const res = await inject(`/admin/videos/${VID}/tmdb-search`, { mediaType: 'movie' })
    expect(res.statusCode).toBe(401)
  })
})
