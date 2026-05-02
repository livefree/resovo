/**
 * tests/unit/api/auth.test.ts
 * AUTH-01 + AUTH-02: JWT 工具函数、authenticate 插件、注册/登录/刷新/登出接口测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  blacklistKey,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@/api/lib/auth'
import { setupAuthenticate } from '@/api/plugins/authenticate'

// ── Mock redis ───────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))

// ── Mock postgres ────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({
  db: {},
}))

// ── Mock userQueries ─────────────────────────────────────────────

vi.mock('@/api/db/queries/users', () => ({
  findUserByEmail: vi.fn(),
  findUserByUsername: vi.fn(),
  findUserById: vi.fn(),
  createUser: vi.fn(),
}))

import { redis } from '@/api/lib/redis'
import * as userQueries from '@/api/db/queries/users'

const mockRedis = redis as { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> }
const mockQueries = userQueries as {
  findUserByEmail: ReturnType<typeof vi.fn>
  findUserByUsername: ReturnType<typeof vi.fn>
  findUserById: ReturnType<typeof vi.fn>
  createUser: ReturnType<typeof vi.fn>
}

// ── 辅助：测试 Fastify 实例（仅 AUTH-01 plugin 测试）──────────────

async function buildPluginApp() {
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-cookie-secret' })
  setupAuthenticate(app)

  app.get('/protected', { preHandler: [app.authenticate] }, async (req) => ({
    userId: req.user?.userId,
    role: req.user?.role,
  }))
  app.get('/optional', { preHandler: [app.optionalAuthenticate] }, async (req) => ({
    user: req.user,
  }))
  app.get(
    '/admin-only',
    { preHandler: [app.authenticate, app.requireRole(['admin'])] },
    async (req) => ({ userId: req.user?.userId })
  )

  await app.ready()
  return app
}

// ── 辅助：测试 Fastify 实例（AUTH-02 routes 测试）──────────────────

async function buildAuthApp() {
  const { authRoutes } = await import('@/api/routes/auth')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-cookie-secret' })
  setupAuthenticate(app)
  await app.register(authRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

// ═══════════════════════════════════════════════════════════════
// AUTH-01: JWT 工具函数测试
// ═══════════════════════════════════════════════════════════════

describe('signAccessToken / verifyAccessToken', () => {
  it('生成的 token 可以正确验证，payload 包含 userId 和 role', () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const payload = verifyAccessToken(token)
    expect(payload.userId).toBe('user-1')
    expect(payload.role).toBe('user')
    expect(payload.type).toBe('access')
  })

  it('过期 token 抛出错误', async () => {
    const jwt = await import('jsonwebtoken')
    const expired = jwt.default.sign(
      { userId: 'user-1', role: 'user', type: 'access' },
      process.env.JWT_SECRET ?? 'test-secret-do-not-use-in-production',
      { expiresIn: -1 }
    )
    expect(() => verifyAccessToken(expired)).toThrow()
  })

  it('type 不是 access 的 token 验证失败', () => {
    const refreshToken = signRefreshToken('user-1')
    expect(() => verifyAccessToken(refreshToken)).toThrow()
  })

  it('篡改的 token 验证失败', () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    expect(() => verifyAccessToken(token.slice(0, -5) + 'xxxxx')).toThrow()
  })
})

describe('signRefreshToken / verifyRefreshToken', () => {
  it('生成的 refresh token 可以正确验证', () => {
    const token = signRefreshToken('user-1')
    const payload = verifyRefreshToken(token)
    expect(payload.userId).toBe('user-1')
    expect(payload.type).toBe('refresh')
  })

  it('type 不是 refresh 的 token 验证失败', () => {
    const accessToken = signAccessToken({ userId: 'user-1', role: 'user' })
    expect(() => verifyRefreshToken(accessToken)).toThrow()
  })

  it('REFRESH_TOKEN_TTL_SECONDS 为 30 天（2592000 秒）（CHG-37）', () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(2592000)
  })
})

describe('hashToken / blacklistKey', () => {
  it('hashToken 对相同输入返回一致的 SHA-256 哈希（64 hex 字符）', () => {
    const hash = hashToken('some-token')
    expect(hash).toBe(hashToken('some-token'))
    expect(hash).toHaveLength(64)
  })

  it('blacklistKey 格式符合 ADR-003: blacklist:rt:<hash>', () => {
    expect(blacklistKey('my-token')).toMatch(/^blacklist:rt:[a-f0-9]{64}$/)
  })

  it('不同 token 生成不同 blacklistKey', () => {
    expect(blacklistKey('token-a')).not.toBe(blacklistKey('token-b'))
  })
})

// ═══════════════════════════════════════════════════════════════
// AUTH-01: Fastify 插件测试
// ═══════════════════════════════════════════════════════════════

describe('fastify.authenticate', () => {
  let app: Awaited<ReturnType<typeof buildPluginApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    app = await buildPluginApp()
  })
  afterEach(() => app.close())

  it('有效 Bearer token → 200，返回 userId 和 role', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ userId: 'user-1', role: 'user' })
  })

  it('无 Authorization 头 → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
  })

  it('无效 token → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer invalid-token-xyz' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('黑名单中的 token → 401', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    mockRedis.get.mockResolvedValue('1')
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('fastify.optionalAuthenticate', () => {
  let app: Awaited<ReturnType<typeof buildPluginApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    app = await buildPluginApp()
  })
  afterEach(() => app.close())

  it('无 token → user 为 null，200', async () => {
    const res = await app.inject({ method: 'GET', url: '/optional' })
    expect(res.statusCode).toBe(200)
    expect(res.json().user).toBeNull()
  })

  it('有效 token → req.user 被正确设置', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'moderator' })
    const res = await app.inject({
      method: 'GET',
      url: '/optional',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user).toEqual({ userId: 'user-1', role: 'moderator' })
  })

  it('无效 token → user 为 null，不返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/optional',
      headers: { authorization: 'Bearer bad-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user).toBeNull()
  })
})

describe('fastify.requireRole', () => {
  let app: Awaited<ReturnType<typeof buildPluginApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    app = await buildPluginApp()
  })
  afterEach(() => app.close())

  it('admin 访问 admin-only 路由 → 200', async () => {
    const token = signAccessToken({ userId: 'admin-1', role: 'admin' })
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('user 角色访问 admin-only → 403', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
  })

  it('未登录访问 requireRole 路由 → 401（authenticate 先拦截）', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin-only' })
    expect(res.statusCode).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════
// AUTH-02: 注册/登录/刷新/登出接口测试
// ═══════════════════════════════════════════════════════════════

const MOCK_USER = {
  id: 'user-uuid-1',
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: '$2b$04$fakehashedfakehashedfakehashedfakehashedfake',
  role: 'user' as const,
  locale: 'zh-CN',
  avatarUrl: null,
  bannedAt: null,
  createdAt: '2026-03-15T00:00:00.000Z',
}

describe('POST /v1/auth/register', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    mockQueries.findUserByEmail.mockResolvedValue(null)
    mockQueries.findUserByUsername.mockResolvedValue(null)
    mockQueries.createUser.mockResolvedValue(MOCK_USER)
    app = await buildAuthApp()
  })
  afterEach(() => app.close())

  it('成功注册：201，返回 user 和 accessToken，Set-Cookie 包含 refresh_token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { username: 'testuser', email: 'test@example.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.accessToken).toBeTruthy()
    expect(body.data.user.passwordHash).toBeUndefined() // passwordHash 不能暴露
    expect(body.data.user.email).toBe('test@example.com')
    const sc = res.headers['set-cookie']
    const setCookies = Array.isArray(sc) ? sc.join('\n') : String(sc)
    expect(setCookies).toContain('refresh_token=')
    expect(setCookies).toContain('HttpOnly')
  })

  it('重复 email → 409 CONFLICT', async () => {
    mockQueries.findUserByEmail.mockResolvedValue(MOCK_USER)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { username: 'newuser', email: 'test@example.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('CONFLICT')
    expect(res.json().error.status).toBe(409)
  })

  it('重复 username → 409 CONFLICT', async () => {
    mockQueries.findUserByUsername.mockResolvedValue(MOCK_USER)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { username: 'testuser', email: 'new@example.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('CONFLICT')
    expect(res.json().error.status).toBe(409)
  })

  it('密码少于 8 位 → 422 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { username: 'testuser', email: 'test@example.com', password: 'short' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('locale 字段写入数据库，默认为 en', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { username: 'testuser', email: 'test@example.com', password: 'password123' },
    })
    const createCall = mockQueries.createUser.mock.calls[0][1] as { locale?: string }
    expect(createCall.locale ?? 'en').toBe('en')
  })
})

describe('POST /v1/auth/login', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    app = await buildAuthApp()
  })
  afterEach(() => app.close())

  it('正确凭据：access_token 在响应 body，Set-Cookie 包含 refresh_token', async () => {
    // 使用真实 bcrypt hash（cost=4，测试环境）
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('correctpassword', 4)
    mockQueries.findUserByEmail.mockResolvedValue({ ...MOCK_USER, passwordHash: hash })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'test@example.com', password: 'correctpassword' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.accessToken).toBeTruthy()
    const sc2 = res.headers['set-cookie']
    const setCookies2 = Array.isArray(sc2) ? sc2.join('\n') : String(sc2)
    expect(setCookies2).toContain('refresh_token=')
    expect(setCookies2).toContain('HttpOnly')
  })

  it('access_token payload 包含 userId 和 role', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('correctpassword', 4)
    mockQueries.findUserByEmail.mockResolvedValue({ ...MOCK_USER, passwordHash: hash })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'test@example.com', password: 'correctpassword' },
    })
    const { accessToken } = res.json().data
    const payload = verifyAccessToken(accessToken)
    expect(payload.userId).toBe(MOCK_USER.id)
    expect(payload.role).toBe(MOCK_USER.role)
  })

  it('错误密码 → 401，不泄露"密码错误"还是"用户不存在"', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('correctpassword', 4)
    mockQueries.findUserByEmail.mockResolvedValue({ ...MOCK_USER, passwordHash: hash })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'test@example.com', password: 'wrongpassword' },
    })
    expect(res.statusCode).toBe(401)
    // 统一错误信息，不区分原因
    expect(res.json().error.message).toBe('账号或密码错误')
  })

  it('用户不存在 → 401，错误信息与密码错误相同', async () => {
    mockQueries.findUserByEmail.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'notexist@example.com', password: 'anypassword' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.message).toBe('账号或密码错误')
  })

  it('refresh_token cookie 是 HttpOnly', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('correctpassword', 4)
    mockQueries.findUserByEmail.mockResolvedValue({ ...MOCK_USER, passwordHash: hash })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'test@example.com', password: 'correctpassword' },
    })
    const sc3 = res.headers['set-cookie']
    const setCookies3 = Array.isArray(sc3) ? sc3.join('\n') : String(sc3)
    expect(setCookies3).toContain('HttpOnly')
    expect(setCookies3).toContain('SameSite=Strict')
  })
})

describe('POST /v1/auth/dev-login', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>
  let originalNodeEnv: string | undefined
  let originalDevSecret: string | undefined
  let originalDevIdentifier: string | undefined

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    mockQueries.findUserByUsername.mockResolvedValue(MOCK_USER)
    originalNodeEnv = process.env.NODE_ENV
    originalDevSecret = process.env.DEV_LOGIN_SECRET
    originalDevIdentifier = process.env.DEV_LOGIN_IDENTIFIER
    process.env.NODE_ENV = 'development'
    process.env.DEV_LOGIN_SECRET = 'dev-secret'
    process.env.DEV_LOGIN_IDENTIFIER = 'admin'
    app = await buildAuthApp()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    process.env.DEV_LOGIN_SECRET = originalDevSecret
    process.env.DEV_LOGIN_IDENTIFIER = originalDevIdentifier
    app.close()
  })

  it('无 X-Dev-Auth 头返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/dev-login',
      body: {},
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
  })

  it('鉴权成功时返回 user + accessToken 并设置 cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/dev-login',
      headers: {
        'content-type': 'application/json',
        'x-dev-auth': 'dev-secret',
      },
      body: JSON.stringify({ identifier: 'admin' }),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { user: { id: string }; accessToken: string } }>()
    expect(body.data.user.id).toBe(MOCK_USER.id)
    expect(body.data.accessToken).toMatch(/^eyJ/)
    const setCookie = String(res.headers['set-cookie'] ?? '')
    expect(setCookie).toContain('refresh_token=')
    expect(setCookie).toContain('user_role=')
  })
})

describe('POST /v1/auth/refresh', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockQueries.findUserById.mockResolvedValue(MOCK_USER)
    app = await buildAuthApp()
  })
  afterEach(() => app.close())

  it('有效 cookie → 返回新 access_token', async () => {
    const refreshToken = signRefreshToken(MOCK_USER.id)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      cookies: { refresh_token: refreshToken },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.accessToken).toBeTruthy()
  })

  it('无 cookie → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh' })
    expect(res.statusCode).toBe(401)
  })

  it('黑名单中的 token → 401', async () => {
    const refreshToken = signRefreshToken(MOCK_USER.id)
    mockRedis.get.mockResolvedValue('1') // 在黑名单中
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      cookies: { refresh_token: refreshToken },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /v1/auth/logout', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    app = await buildAuthApp()
  })
  afterEach(() => app.close())

  it('登出后该 refresh_token 加入 Redis 黑名单', async () => {
    const refreshToken = signRefreshToken(MOCK_USER.id)
    await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      cookies: { refresh_token: refreshToken },
    })
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^blacklist:rt:/),
      '1',
      'EX',
      expect.any(Number)
    )
  })

  it('登出后清除 Set-Cookie', async () => {
    const refreshToken = signRefreshToken(MOCK_USER.id)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      cookies: { refresh_token: refreshToken },
    })
    expect(res.statusCode).toBe(204)
    const setCookieHeader = res.headers['set-cookie']
    const setCookies = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : String(setCookieHeader)
    // clearCookie 设置 expires 为过去时间或 max-age=0
    expect(setCookies).toContain('refresh_token=')
  })

  it('无 cookie 时登出也返回 204（幂等）', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/logout' })
    expect(res.statusCode).toBe(204)
    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})
