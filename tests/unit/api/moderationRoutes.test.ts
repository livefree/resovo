/**
 * moderationRoutes.test.ts
 * CHG-387: 审核台路由完整性验证
 * - batch-approve / batch-reject 权限：moderator 可用
 * - batch-reject 必须有 reason（不得无理由拒绝）
 * - reopen 权限：moderator 可用
 * - history 权限：moderator 可用
 * - approve_and_publish 仅 admin 由 admin/videos.ts 保障（不在此测试）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: undefined }))

const mockFindAdminVideoById = vi.fn()
const mockTransitionVideoState = vi.fn()

vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: (...args: unknown[]) => mockFindAdminVideoById(...args),
  transitionVideoState: (...args: unknown[]) => mockTransitionVideoState(...args),
  updateVideoEnrichStatus: vi.fn(),
}))

vi.mock('@/api/db/queries/moderation', () => ({
  listModerationHistory: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
}))

vi.mock('@/api/services/VideoService', () => ({
  VideoService: class { update = vi.fn() },
}))

vi.mock('@/api/services/DoubanService', () => ({
  DoubanService: class {
    searchByKeyword = vi.fn()
    confirmSubject = vi.fn()
  },
}))

// ── 工具 ─────────────────────────────────────────────────────────

async function buildApp() {
  const { adminModerationRoutes } = await import('@/api/routes/admin/moderation')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminModerationRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function tokenFor(role: 'moderator' | 'admin') {
  return `Bearer ${await signAccessToken({ userId: `u-${role}`, role })}`
}

// ═══════════════════════════════════════════════════════════════
// 权限矩阵验证
// ═══════════════════════════════════════════════════════════════

describe('CHG-387 权限矩阵', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindAdminVideoById.mockResolvedValue({ id: 'v1', review_status: 'pending_review', meta_score: 70 })
    mockTransitionVideoState.mockResolvedValue({ id: 'v1', review_status: 'approved' })
    app = await buildApp()
  })

  afterEach(() => app.close())

  it('moderator 可以调用 batch-approve', async () => {
    const token = await tokenFor('moderator')
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-approve',
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'] }),
    })
    expect(res.statusCode).toBe(200)
  })

  it('admin 可以调用 batch-approve', async () => {
    const token = await tokenFor('admin')
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-approve',
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'] }),
    })
    expect(res.statusCode).toBe(200)
  })

  it('moderator 可以调用 batch-reject', async () => {
    const token = await tokenFor('moderator')
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'], reason: '片源不完整' }),
    })
    expect(res.statusCode).toBe(200)
  })

  it('moderator 可以调用 GET history', async () => {
    const token = await tokenFor('moderator')
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/history',
      headers: { authorization: token },
    })
    expect(res.statusCode).toBe(200)
  })

  it('moderator 可以调用 reopen', async () => {
    // reopen 需要 rejected 状态
    mockFindAdminVideoById.mockResolvedValue({ id: 'v1', review_status: 'rejected', meta_score: 70 })
    const token = await tokenFor('moderator')
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/v1/reopen',
      headers: { authorization: token },
    })
    expect(res.statusCode).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════
// batch-reject 必须有 reason（业务约束）
// ═══════════════════════════════════════════════════════════════

describe('CHG-387 batch-reject reason 约束', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindAdminVideoById.mockResolvedValue({ id: 'v1', review_status: 'pending_review', meta_score: 80 })
    mockTransitionVideoState.mockResolvedValue({ id: 'v1', review_status: 'rejected' })
    app = await buildApp()
    authHeader = await tokenFor('moderator')
  })

  afterEach(() => app.close())

  it('有 reason → 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'], reason: '画质异常' }),
    })
    expect(res.statusCode).toBe(200)
  })

  it('无 reason → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'] }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('reason 超 500 字 → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'], reason: 'a'.repeat(501) }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('reason 传入空字符串 → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'], reason: '' }),
    })
    expect(res.statusCode).toBe(422)
  })
})

// ═══════════════════════════════════════════════════════════════
// history 分页与参数透传
// ═══════════════════════════════════════════════════════════════

describe('CHG-387 history 分页与参数', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  const { listModerationHistory } = vi.hoisted(() => ({ listModerationHistory: vi.fn() }))

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
    authHeader = await tokenFor('moderator')
  })

  afterEach(() => app.close())

  it('默认 page=1 limit=30', async () => {
    const { listModerationHistory: mockHist } = await import('@/api/db/queries/moderation')
    vi.mocked(mockHist).mockResolvedValue({ rows: [], total: 0 })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/history',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(mockHist)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 1, limit: 30 })
    )
  })
})
