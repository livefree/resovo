/**
 * tests/unit/api/users.test.ts
 * CHG-18: POST /users/me/history — 观看进度上报
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

vi.mock('@/api/db/queries/users', () => ({
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByUsername: vi.fn(),
  createUser: vi.fn(),
  listAdminUsers: vi.fn(),
  findAdminUserById: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  updateUserRole: vi.fn(),
}))

vi.mock('@/api/db/queries/watchHistory', () => ({
  upsertWatchHistory: vi.fn(),
  getUserHistory: vi.fn(),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import * as usersQueriesModule from '@/api/db/queries/users'
import * as watchHistoryModule from '@/api/db/queries/watchHistory'

const mockFindUserById = usersQueriesModule.findUserById as ReturnType<typeof vi.fn>
const mockUpsertHistory = watchHistoryModule.upsertWatchHistory as ReturnType<typeof vi.fn>
const mockGetHistory = watchHistoryModule.getUserHistory as ReturnType<typeof vi.fn>

async function buildApp() {
  const { userRoutes } = await import('@/api/routes/users')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(userRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'user') {
  const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

describe('users API (CHG-18)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  // ── GET /users/me ──────────────────────────────────────────────

  it('GET /users/me：未登录返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/users/me' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /users/me：返回用户信息，不含 passwordHash', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
      locale: 'en',
      avatarUrl: null,
      bannedAt: null,
      createdAt: '2024-01-01',
      passwordHash: 'should-not-appear',
    })

    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: authHeader(),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.username).toBe('testuser')
    expect(body.data.passwordHash).toBeUndefined()
  })

  // ── POST /users/me/history ─────────────────────────────────────

  it('POST /users/me/history：未登录返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/history',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: '11111111-0000-0000-0000-000000000000', progressSeconds: 60 }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /users/me/history：缺少 progressSeconds 返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/history',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: '11111111-0000-0000-0000-000000000000' }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('POST /users/me/history：正确上报进度返回 204', async () => {
    mockUpsertHistory.mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/users/me/history',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: '11111111-0000-0000-0000-000000000000',
        progressSeconds: 120,
        episode: 2,
      }),
    })

    expect(res.statusCode).toBe(204)
    expect(mockUpsertHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-1',
        videoId: '11111111-0000-0000-0000-000000000000',
        episodeNumber: 2,
        progressSeconds: 120,
      })
    )
  })

  it('POST /users/me/history：episode 缺省时 episodeNumber 为 undefined（ADR-016 统一坐标系）', async () => {
    mockUpsertHistory.mockResolvedValueOnce(undefined)

    await app.inject({
      method: 'POST',
      url: '/users/me/history',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: '11111111-0000-0000-0000-000000000000',
        progressSeconds: 0,
      }),
    })

    expect(mockUpsertHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ episodeNumber: undefined })
    )
  })

  // ── GET /users/me/history ──────────────────────────────────────

  it('GET /users/me/history：未登录返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/users/me/history' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /users/me/history：返回历史列表', async () => {
    mockGetHistory.mockResolvedValueOnce({
      rows: [
        {
          video_id: 'vid-1',
          episode_number: null,
          progress_seconds: 300,
          watched_at: '2024-01-01T00:00:00Z',
          video_short_id: 'abc123',
          video_title: 'Test Movie',
          video_cover_url: null,
          video_type: 'movie',
        },
      ],
      total: 1,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/users/me/history',
      headers: authHeader(),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.data[0].video.title).toBe('Test Movie')
    expect(body.data[0].progressSeconds).toBe(300)
  })
})
