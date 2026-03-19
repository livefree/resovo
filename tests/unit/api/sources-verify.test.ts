/**
 * tests/unit/api/sources-verify.test.ts
 * CHG-28: POST /admin/sources/:id/verify — mock HEAD 请求，权限、超时、isActive 判断
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null) },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

vi.mock('@/api/db/queries/sources', () => ({
  listAdminSources: vi.fn(),
  findSourceById: vi.fn(),
  updateSourceActiveStatus: vi.fn(),
  deleteSource: vi.fn(),
  batchDeleteSources: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  listSubmissions: vi.fn(),
}))

// mock verifyWorker.checkUrl so we don't make real HTTP requests
vi.mock('@/api/workers/verifyWorker', () => ({
  checkUrl: vi.fn(),
  enqueueVerifySource: vi.fn(),
  enqueueVerifySingle: vi.fn(),
  registerVerifyWorker: vi.fn(),
}))

// mock Bull queue used by verifyWorker
vi.mock('@/api/lib/queue', () => ({
  verifyQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import * as sourcesQueriesModule from '@/api/db/queries/sources'
import * as verifyWorkerModule from '@/api/workers/verifyWorker'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockFindSource = sourcesQueriesModule.findSourceById as ReturnType<typeof vi.fn>
const mockUpdateActive = sourcesQueriesModule.updateSourceActiveStatus as ReturnType<typeof vi.fn>
const mockCheckUrl = verifyWorkerModule.checkUrl as ReturnType<typeof vi.fn>

const MOCK_SOURCE = {
  id: 'src-1',
  videoId: 'vid-1',
  episodeNumber: null,
  sourceUrl: 'https://example.com/video.mp4',
  sourceName: 'test',
  quality: null,
  type: 'hls',
  isActive: true,
  lastChecked: null,
}

async function buildApp() {
  const { adminContentRoutes } = await import('@/api/routes/admin/content')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminContentRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'moderator') {
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

describe('POST /admin/sources/:id/verify (CHG-28)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockUpdateActive.mockResolvedValue(undefined)
    app = await buildApp()
  })

  it('未登录返回 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/sources/src-1/verify' })
    expect(res.statusCode).toBe(401)
  })

  it('普通用户（user）返回 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader('user'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('源不存在返回 404', async () => {
    mockFindSource.mockResolvedValueOnce(null)
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/nonexistent/verify',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('HEAD 请求成功（200）时 isActive=true，返回 responseMs', async () => {
    mockFindSource.mockResolvedValueOnce(MOCK_SOURCE)
    mockCheckUrl.mockResolvedValueOnce({ isActive: true, statusCode: 200 })

    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { isActive: boolean; responseMs: number; statusCode: number } }>()
    expect(body.data.isActive).toBe(true)
    expect(body.data.statusCode).toBe(200)
    expect(typeof body.data.responseMs).toBe('number')
  })

  it('HEAD 请求失败（404）时 isActive=false', async () => {
    mockFindSource.mockResolvedValueOnce(MOCK_SOURCE)
    mockCheckUrl.mockResolvedValueOnce({ isActive: false, statusCode: 404 })

    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { isActive: boolean; statusCode: number } }>()
    expect(body.data.isActive).toBe(false)
    expect(body.data.statusCode).toBe(404)
  })

  it('超时（statusCode=null）时 isActive=false', async () => {
    mockFindSource.mockResolvedValueOnce(MOCK_SOURCE)
    mockCheckUrl.mockResolvedValueOnce({ isActive: false, statusCode: null })

    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { isActive: boolean; statusCode: null } }>()
    expect(body.data.isActive).toBe(false)
    expect(body.data.statusCode).toBeNull()
  })

  it('验证后调用 updateSourceActiveStatus 更新 DB', async () => {
    mockFindSource.mockResolvedValueOnce(MOCK_SOURCE)
    mockCheckUrl.mockResolvedValueOnce({ isActive: true, statusCode: 200 })

    await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader(),
    })
    expect(mockUpdateActive).toHaveBeenCalledWith(expect.anything(), 'src-1', true)
  })

  it('moderator 权限可以验证（不只限 admin）', async () => {
    mockFindSource.mockResolvedValueOnce(MOCK_SOURCE)
    mockCheckUrl.mockResolvedValueOnce({ isActive: true, statusCode: 200 })

    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader('moderator'),
    })
    expect(res.statusCode).toBe(200)
  })
})
