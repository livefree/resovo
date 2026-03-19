/**
 * tests/unit/api/cache.test.ts
 * CHG-30: GET /admin/cache/stats, DELETE /admin/cache/:type
 * mock Redis，验证 SCAN 调用、UNLINK 调用、权限、all 类型不删除队列 key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))

// Use vi.hoisted so variables are available when vi.mock factory runs (hoisted to top)
const { mockScan, mockUnlink, mockPipeline, mockRedisGet } = vi.hoisted(() => ({
  mockScan: vi.fn(),
  mockUnlink: vi.fn(),
  mockPipeline: vi.fn(),
  mockRedisGet: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/api/lib/redis', () => ({
  redis: {
    scan: mockScan,
    unlink: mockUnlink,
    pipeline: mockPipeline,
    get: mockRedisGet,
  },
}))

vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

// Need to mock queue for verifyWorker import chain
vi.mock('@/api/lib/queue', () => ({
  verifyQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>

async function buildApp() {
  const { adminCacheRoutes } = await import('@/api/routes/admin/cache')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminCacheRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'admin') {
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

/** 配置 mockScan 返回空结果（cursor=0，无 key） */
function mockScanEmpty() {
  mockScan.mockResolvedValue(['0', []])
}

/** 配置 mockScan 返回一批 key */
function mockScanWithKeys(keys: string[]) {
  mockScan.mockResolvedValue(['0', keys])
}

describe('GET /admin/cache/stats (CHG-30)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockScanEmpty()
    mockPipeline.mockReturnValue({
      strlen: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })
    app = await buildApp()
  })

  it('未登录返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/cache/stats' })
    expect(res.statusCode).toBe(401)
  })

  it('moderator 返回 403（admin only）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/cache/stats',
      headers: authHeader('moderator'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('admin 返回 200，包含各缓存类型统计', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/cache/stats',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: Array<{ type: string; count: number; sizeKb: number }> }>()
    expect(Array.isArray(body.data)).toBe(true)
    const types = body.data.map((d) => d.type)
    expect(types).toContain('search')
    expect(types).toContain('video')
    expect(types).toContain('danmaku')
    expect(types).toContain('analytics')
  })

  it('有 key 时 count > 0', async () => {
    mockScan.mockResolvedValue(['0', ['search:q1', 'search:q2']])
    mockPipeline.mockReturnValue({
      strlen: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 100], [null, 200]]),
    })

    const res = await app.inject({
      method: 'GET',
      url: '/admin/cache/stats',
      headers: authHeader('admin'),
    })
    const body = res.json<{ data: Array<{ type: string; count: number }> }>()
    const searchStat = body.data.find((d) => d.type === 'search')
    expect(searchStat?.count).toBeGreaterThan(0)
  })

  it('使用 SCAN 而非 KEYS', async () => {
    await app.inject({
      method: 'GET',
      url: '/admin/cache/stats',
      headers: authHeader('admin'),
    })
    expect(mockScan).toHaveBeenCalled()
    // 确保每次调用 scan 传的是正确的参数格式
    const firstCall = mockScan.mock.calls[0]
    expect(firstCall[0]).toBe('0') // cursor
    expect(firstCall[1]).toBe('MATCH')
  })
})

describe('DELETE /admin/cache/:type (CHG-30)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockScanEmpty()
    mockUnlink.mockResolvedValue(0)
    app = await buildApp()
  })

  it('未登录返回 401', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/admin/cache/search' })
    expect(res.statusCode).toBe(401)
  })

  it('moderator 返回 403', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/cache/search',
      headers: authHeader('moderator'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('无效 type 返回 400', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/cache/invalid-type',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(400)
  })

  it('清除 search 缓存，调用 UNLINK', async () => {
    mockScan.mockResolvedValue(['0', ['search:q1', 'search:q2']])
    mockUnlink.mockResolvedValue(2)

    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/cache/search',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { deleted: number } }>()
    expect(body.data.deleted).toBe(2)
    expect(mockUnlink).toHaveBeenCalledWith('search:q1', 'search:q2')
  })

  it('清除 all 时不操作 bull: 或 blacklist: 前缀 key', async () => {
    // 模拟业务 key 存在
    mockScan
      .mockResolvedValueOnce(['0', ['search:q1']])      // search:*
      .mockResolvedValueOnce(['0', ['video:v1']])        // video:*
      .mockResolvedValueOnce(['0', []])                  // danmaku:*
      .mockResolvedValueOnce(['0', []])                  // analytics:*

    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/cache/all',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)

    // 验证 UNLINK 调用不包含 bull: 或 blacklist: 前缀
    const allUnlinkArgs = mockUnlink.mock.calls.flat()
    expect(allUnlinkArgs.every((k: string) => !k.startsWith('bull:') && !k.startsWith('blacklist:'))).toBe(true)
  })

  it('无 key 时 deleted=0', async () => {
    mockScanEmpty()

    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/cache/video',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { deleted: number } }>()
    expect(body.data.deleted).toBe(0)
    expect(mockUnlink).not.toHaveBeenCalled()
  })
})
