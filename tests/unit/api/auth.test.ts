/**
 * tests/unit/api/auth.test.ts
 * AUTH-01: JWT 工具函数 + authenticate/optionalAuthenticate/requireRole 插件测试
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
    get: vi.fn().mockResolvedValue(null), // 默认：不在黑名单
    set: vi.fn().mockResolvedValue('OK'),
  },
}))

import { redis } from '@/api/lib/redis'
const mockRedis = redis as { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> }

// ── 辅助：创建测试 Fastify 实例 ──────────────────────────────────

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-cookie-secret' })
  setupAuthenticate(app)

  app.get('/protected', { preHandler: [app.authenticate] }, async (req) => {
    return { userId: req.user?.userId, role: req.user?.role }
  })

  app.get('/optional', { preHandler: [app.optionalAuthenticate] }, async (req) => {
    return { user: req.user }
  })

  app.get(
    '/admin-only',
    {
      preHandler: [app.authenticate, app.requireRole(['admin'])],
    },
    async (req) => {
      return { userId: req.user?.userId }
    }
  )

  await app.ready()
  return app
}

// ── JWT 工具函数测试 ─────────────────────────────────────────────

describe('signAccessToken / verifyAccessToken', () => {
  it('生成的 token 可以正确验证，payload 包含 userId 和 role', () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const payload = verifyAccessToken(token)
    expect(payload.userId).toBe('user-1')
    expect(payload.role).toBe('user')
    expect(payload.type).toBe('access')
  })

  it('过期 token 抛出错误', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    // 强制设置过期：使用 jsonwebtoken 直接签一个已过期的 token
    const jwt = await import('jsonwebtoken')
    const expired = jwt.default.sign(
      { userId: 'user-1', role: 'user', type: 'access' },
      process.env.JWT_SECRET ?? 'test-secret-do-not-use-in-production',
      { expiresIn: -1 } // 立即过期
    )
    expect(() => verifyAccessToken(expired)).toThrow()
    expect(token).toBeTruthy() // 正常 token 生成成功
  })

  it('type 不是 access 的 token 验证失败', () => {
    const refreshToken = signRefreshToken('user-1')
    expect(() => verifyAccessToken(refreshToken)).toThrow()
  })

  it('篡改的 token 验证失败', () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const tampered = token.slice(0, -5) + 'xxxxx'
    expect(() => verifyAccessToken(tampered)).toThrow()
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

  it('REFRESH_TOKEN_TTL_SECONDS 为 7 天', () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(604800)
  })
})

describe('hashToken / blacklistKey', () => {
  it('hashToken 对相同输入返回一致的 SHA-256 哈希', () => {
    const hash1 = hashToken('some-token')
    const hash2 = hashToken('some-token')
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA-256 hex = 64 chars
  })

  it('blacklistKey 格式为 blacklist:rt:<hash>（ADR-003）', () => {
    const key = blacklistKey('my-token')
    expect(key).toMatch(/^blacklist:rt:[a-f0-9]{64}$/)
  })

  it('不同 token 生成不同的 blacklistKey', () => {
    expect(blacklistKey('token-a')).not.toBe(blacklistKey('token-b'))
  })
})

// ── Fastify 插件测试 ─────────────────────────────────────────────

describe('fastify.authenticate', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null) // 默认不在黑名单
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

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

  it('无效 token（随机字符串）→ 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer invalid-token-xyz' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('黑名单中的 token → 401', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    mockRedis.get.mockResolvedValue('1') // 模拟在黑名单中

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('fastify.optionalAuthenticate', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

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
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('admin 访问 admin-only 路由 → 200', async () => {
    const token = signAccessToken({ userId: 'admin-1', role: 'admin' })
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().userId).toBe('admin-1')
  })

  it('user 角色访问 admin-only 路由 → 403', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
  })

  it('moderator 角色访问 admin-only 路由 → 403', async () => {
    const token = signAccessToken({ userId: 'mod-1', role: 'moderator' })
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('未登录访问 requireRole 路由 → 401（authenticate 先拦截）', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin-only' })
    expect(res.statusCode).toBe(401)
  })
})
