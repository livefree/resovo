/**
 * tests/unit/api/sources-verify.test.ts
 * CHG-28: POST /admin/sources/:id/verify — 异步入队，权限检查，404 处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/services/CrawlerService', () => ({
  CrawlerService: vi.fn(() => ({})),
  parseCrawlerSources: vi.fn(),
}))
vi.mock('@/api/db/queries/crawlerTasks', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
}))
vi.mock('@/api/workers/crawlerWorker', () => ({
  enqueueFullCrawl: vi.fn(),
  enqueueIncrementalCrawl: vi.fn(),
  registerCrawlerWorker: vi.fn(),
}))

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

vi.mock('@/api/db/queries/sources', () => ({
  findSourceById: vi.fn(),
  listAdminSources: vi.fn(),
  updateSourceActiveStatus: vi.fn(),
  deleteSource: vi.fn(),
  batchDeleteSources: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  listSubmissions: vi.fn(),
}))

vi.mock('@/api/workers/verifyWorker', () => ({
  enqueueVerifySingle: vi.fn(),
  enqueueVerifySource: vi.fn(),
  registerVerifyWorker: vi.fn(),
}))

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
const mockEnqueue = verifyWorkerModule.enqueueVerifySingle as ReturnType<typeof vi.fn>

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
  const { adminCrawlerRoutes } = await import('@/api/routes/admin/crawler')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminCrawlerRoutes)
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
    mockRedisGet.mockResolvedValue(null)
    mockEnqueue.mockResolvedValue({ id: 'job-123' })
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

  it('成功入队返回 202，响应包含 jobId 和 sourceId', async () => {
    mockFindSource.mockResolvedValueOnce(MOCK_SOURCE)

    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(202)
    const body = res.json<{ data: { jobId: string | number; sourceId: string } }>()
    expect(body.data.jobId).toBe('job-123')
    expect(body.data.sourceId).toBe('src-1')
  })

  it('成功时调用 enqueueVerifySingle 并传入 sourceId 和 url', async () => {
    mockFindSource.mockResolvedValueOnce(MOCK_SOURCE)

    await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader(),
    })
    expect(mockEnqueue).toHaveBeenCalledWith('src-1', MOCK_SOURCE.sourceUrl)
  })

  it('moderator 权限可以验证（不只限 admin）', async () => {
    mockFindSource.mockResolvedValueOnce(MOCK_SOURCE)

    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader('moderator'),
    })
    expect(res.statusCode).toBe(202)
  })
})
