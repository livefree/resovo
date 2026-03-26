/**
 * tests/unit/api/sourceHealthCheck.test.ts
 * CHG-219: POST /sources/:id/report-error — 播放器上报加载失败（冷却限速）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

import { setupAuthenticate } from '@/api/plugins/authenticate'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))

vi.mock('@/api/lib/postgres', () => ({ db: {} }))

vi.mock('@/api/db/queries/sources', () => ({
  findActiveSourcesByVideoId: vi.fn(),
  findSourceById: vi.fn(),
  updateSourceActiveStatus: vi.fn(),
}))

vi.mock('@/api/db/queries/videos', () => ({
  findVideoByShortId: vi.fn(),
}))

vi.mock('@/api/workers/verifyWorker', () => ({
  enqueueVerifySingle: vi.fn().mockResolvedValue(undefined),
}))

import * as sourceQueries from '@/api/db/queries/sources'
import * as verifyWorker from '@/api/workers/verifyWorker'

const mockSQ = sourceQueries as {
  findSourceById: ReturnType<typeof vi.fn>
}
const mockVW = verifyWorker as {
  enqueueVerifySingle: ReturnType<typeof vi.fn>
}

// ── 测试数据 ─────────────────────────────────────────────────────

const MOCK_SOURCE = {
  id: 'source-uuid-1',
  videoId: 'video-uuid-1',
  episodeNumber: 1,
  sourceUrl: 'https://cdn.example.com/video.m3u8',
  sourceName: '线路1',
  quality: '1080P' as const,
  type: 'hls' as const,
  isActive: true,
  lastChecked: null,
}

// ── 辅助：测试 app ────────────────────────────────────────────────

async function buildApp() {
  // 每次动态 import 以重置模块内 reportCooldown Map 状态
  vi.resetModules()
  const { sourceRoutes } = await import('@/api/routes/sources')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(sourceRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

// ═══════════════════════════════════════════════════════════════
// POST /v1/sources/:id/report-error
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/sources/:id/report-error', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockSQ.findSourceById.mockResolvedValue(MOCK_SOURCE)
    app = await buildApp()
  })

  afterEach(() => app.close())

  it('源存在 → 202，入队验证', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sources/source-uuid-1/report-error',
    })
    expect(res.statusCode).toBe(202)
    expect(res.json().data.message).toBeTruthy()
    expect(mockVW.enqueueVerifySingle).toHaveBeenCalledWith(
      'source-uuid-1',
      MOCK_SOURCE.sourceUrl
    )
  })

  it('源不存在 → 404', async () => {
    mockSQ.findSourceById.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sources/nonexistent/report-error',
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
    expect(mockVW.enqueueVerifySingle).not.toHaveBeenCalled()
  })

  it('同一源 5 分钟内二次上报 → 429，不重复入队', async () => {
    // 第一次上报
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/sources/source-uuid-1/report-error',
    })
    expect(res1.statusCode).toBe(202)

    // 立即再次上报
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/sources/source-uuid-1/report-error',
    })
    expect(res2.statusCode).toBe(429)
    expect(res2.json().error.code).toBe('RATE_LIMITED')
    // 只入队一次
    expect(mockVW.enqueueVerifySingle).toHaveBeenCalledTimes(1)
  })

  it('不同源 ID 各自独立冷却，互不影响', async () => {
    const OTHER_SOURCE = { ...MOCK_SOURCE, id: 'source-uuid-2' }
    mockSQ.findSourceById
      .mockResolvedValueOnce(MOCK_SOURCE)
      .mockResolvedValueOnce(OTHER_SOURCE)

    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/sources/source-uuid-1/report-error',
    })
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/sources/source-uuid-2/report-error',
    })

    expect(res1.statusCode).toBe(202)
    expect(res2.statusCode).toBe(202)
    expect(mockVW.enqueueVerifySingle).toHaveBeenCalledTimes(2)
  })

  it('无需登录即可访问（公开路由）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sources/source-uuid-1/report-error',
      // 无 Authorization header
    })
    expect(res.statusCode).toBe(202)
  })
})
