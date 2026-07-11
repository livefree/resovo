/**
 * visitor-cookie-plugin.test.ts — 匿名 visitor 身份单一边界（ADR-216 D-216-7 / STATS-03-A1）
 *
 * 两层覆盖：
 *   ① 纯 handler 单测：cookie-backed 计 UV / 伪造签名→ephemeral / 首访签发 + 本次 ephemeral（H2）/
 *      visitor_hash 不可逆确定性 / ephemeral 限流稳定性 / **fail-safe**（异常不破坏请求）/ 探针豁免（H-2）。
 *   ② Fastify inject 集成（blast-radius，Codex M-3）：真实 onRequest 钩子下 health/HEAD 不签发、首访签发
 *      signed cookie、携带有效 cookie 不重签、与其他 cookie 共存。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  visitorCookieHandler,
  setupVisitorCookie,
  cookieVisitorHash,
  ephemeralVisitorHash,
  VISITOR_COOKIE_NAME,
  VISITOR_COOKIE_MAX_AGE_SECONDS,
} from '../../../apps/api/src/plugins/visitorCookie'

interface MockReqOverrides {
  cookies?: Record<string, string | undefined>
  ip?: string
  headers?: Record<string, string | undefined>
  method?: string
  url?: string
  unsignCookie?: (value: string) => { valid: boolean; renew: boolean; value: string | null }
  visitorHash?: string | null
  visitorIsEphemeral?: boolean
}

function makeReq(overrides: MockReqOverrides = {}): FastifyRequest {
  return {
    cookies: {},
    ip: '203.0.113.7',
    headers: { 'user-agent': 'TestUA/1.0' },
    method: 'POST',
    url: '/v1/videos/abc/play-events',
    // 默认 unsignCookie：把传入值原样视为有效（模拟自签名 cookie）
    unsignCookie: (value: string) => ({ valid: true, renew: false, value }),
    visitorHash: null,
    visitorIsEphemeral: false,
    ...overrides,
  } as unknown as FastifyRequest
}

function makeReply(): { reply: FastifyReply; setCookie: ReturnType<typeof vi.fn> } {
  const setCookie = vi.fn()
  return { reply: { setCookie } as unknown as FastifyReply, setCookie }
}

describe('visitorCookieHandler — D-216-7 匿名 visitor 边界', () => {
  it('cookie-backed：已签名有效 rv_vid → visitorHash=HMAC(rv_vid)，非 ephemeral，不重签', async () => {
    const req = makeReq({
      cookies: { [VISITOR_COOKIE_NAME]: 'signed-blob' },
      unsignCookie: () => ({ valid: true, renew: false, value: 'existing-vid-123' }),
    })
    const { reply, setCookie } = makeReply()

    await visitorCookieHandler(req, reply)

    expect(req.visitorIsEphemeral).toBe(false)
    expect(req.visitorHash).toBe(cookieVisitorHash('existing-vid-123'))
    expect(setCookie).not.toHaveBeenCalled()
  })

  it('伪造/篡改 cookie：签名校验 valid=false → 落 ephemeral + 重签（Codex H-3）', async () => {
    const req = makeReq({
      cookies: { [VISITOR_COOKIE_NAME]: 'forged-blob' },
      unsignCookie: () => ({ valid: false, renew: false, value: null }),
    })
    const { reply, setCookie } = makeReply()

    await visitorCookieHandler(req, reply)

    expect(req.visitorIsEphemeral).toBe(true)
    expect(req.visitorHash).toBe(ephemeralVisitorHash(req))
    expect(setCookie).toHaveBeenCalledTimes(1) // 重签
  })

  it('首访无 cookie：签发 signed rv_vid（HttpOnly+SameSite=Lax+Path=/+Max-Age 400d）+ 本次 ephemeral（H2）', async () => {
    const req = makeReq({ cookies: {} })
    const { reply, setCookie } = makeReply()

    await visitorCookieHandler(req, reply)

    expect(setCookie).toHaveBeenCalledTimes(1)
    const [name, value, opts] = setCookie.mock.calls[0]
    expect(name).toBe(VISITOR_COOKIE_NAME)
    expect(typeof value).toBe('string')
    expect((value as string).length).toBeGreaterThanOrEqual(16)
    expect(opts).toMatchObject({
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
    })
    expect(req.visitorIsEphemeral).toBe(true)
    expect(req.visitorHash).toBe(ephemeralVisitorHash(req))
  })

  it('探针/预检豁免（Codex H-2）：HEAD 与 /v1/health 不签发 cookie、不解析身份', async () => {
    for (const over of [{ method: 'HEAD' }, { method: 'OPTIONS' }, { url: '/v1/health' }, { url: '/v1/health?probe=1' }]) {
      const req = makeReq({ cookies: {}, ...over })
      const { reply, setCookie } = makeReply()
      await visitorCookieHandler(req, reply)
      expect(setCookie, `豁免 ${JSON.stringify(over)} 不应签发`).not.toHaveBeenCalled()
      expect(req.visitorHash).toBeNull()
      expect(req.visitorIsEphemeral).toBe(false)
    }
  })

  it('visitor_hash 不可逆确定性：HMAC 截断 32 hex、同输入同值、不等原始 rv_vid', () => {
    const h1 = cookieVisitorHash('vid-abc')
    expect(h1).toBe(cookieVisitorHash('vid-abc'))
    expect(h1).not.toContain('vid-abc')
    expect(h1).toMatch(/^[0-9a-f]{32}$/)
    expect(cookieVisitorHash('vid-xyz')).not.toBe(h1)
  })

  it('ephemeral hash：同 ip+ua 时窗内稳定，不同 ip 不同，与 cookie-backed 命名空间隔离', () => {
    const a = ephemeralVisitorHash({ ip: '1.1.1.1', headers: { 'user-agent': 'UA' } })
    const aAgain = ephemeralVisitorHash({ ip: '1.1.1.1', headers: { 'user-agent': 'UA' } })
    const b = ephemeralVisitorHash({ ip: '2.2.2.2', headers: { 'user-agent': 'UA' } })
    expect(a).toBe(aAgain)
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(cookieVisitorHash('x')).not.toBe(ephemeralVisitorHash({ ip: 'x', headers: {} }))
  })

  it('fail-safe：setCookie 抛错 → visitorHash=null + ephemeral，不抛（Codex A）', async () => {
    const req = makeReq({ cookies: {} })
    const reply = {
      setCookie: vi.fn(() => {
        throw new Error('cookie write failed')
      }),
    } as unknown as FastifyReply
    await expect(visitorCookieHandler(req, reply)).resolves.toBeUndefined()
    expect(req.visitorHash).toBeNull()
    expect(req.visitorIsEphemeral).toBe(true)
  })

  it('fail-safe：unsignCookie 抛错 → visitorHash=null + ephemeral，不抛（Codex L-1）', async () => {
    const req = makeReq({
      cookies: { [VISITOR_COOKIE_NAME]: 'blob' },
      unsignCookie: () => {
        throw new Error('unsign failed')
      },
    })
    const { reply } = makeReply()
    await expect(visitorCookieHandler(req, reply)).resolves.toBeUndefined()
    expect(req.visitorHash).toBeNull()
    expect(req.visitorIsEphemeral).toBe(true)
  })

  describe('生产环境 Secure 标志', () => {
    const prev = process.env.NODE_ENV
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      process.env.SERVER_VISITOR_SECRET = 'x'.repeat(40) // 满足 boot 强度校验（本组不测 setup）
    })
    afterEach(() => {
      process.env.NODE_ENV = prev
      delete process.env.SERVER_VISITOR_SECRET
    })

    it('NODE_ENV=production → cookie secure=true（D-216-7）', async () => {
      const req = makeReq({ cookies: {} })
      const { reply, setCookie } = makeReply()
      await visitorCookieHandler(req, reply)
      expect(setCookie.mock.calls[0][2]).toMatchObject({ secure: true })
    })
  })
})

describe('setupVisitorCookie — boot 期密钥 fail-fast（Codex H-1）', () => {
  const prev = process.env.NODE_ENV
  const prevSecret = process.env.SERVER_VISITOR_SECRET
  afterEach(() => {
    process.env.NODE_ENV = prev
    if (prevSecret === undefined) delete process.env.SERVER_VISITOR_SECRET
    else process.env.SERVER_VISITOR_SECRET = prevSecret
  })

  it('生产 + 密钥缺失 → 抛错拒绝启动', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.SERVER_VISITOR_SECRET
    const app = Fastify()
    expect(() => setupVisitorCookie(app)).toThrow(/SERVER_VISITOR_SECRET/)
  })

  it('生产 + 密钥=dev 默认 → 抛错', () => {
    process.env.NODE_ENV = 'production'
    process.env.SERVER_VISITOR_SECRET = 'dev-visitor-secret-replace-in-production'
    const app = Fastify()
    expect(() => setupVisitorCookie(app)).toThrow(/SERVER_VISITOR_SECRET/)
  })

  it('非生产 + 密钥缺失 → 不抛（走 dev fallback）', () => {
    process.env.NODE_ENV = 'test'
    delete process.env.SERVER_VISITOR_SECRET
    const app = Fastify()
    expect(() => setupVisitorCookie(app)).not.toThrow()
  })
})

describe('Fastify inject 集成 — blast-radius（Codex M-3）', () => {
  async function buildApp() {
    const app = Fastify()
    await app.register(cookie, { secret: 'test-cookie-secret-for-signing-0123456789' })
    setupVisitorCookie(app)
    app.get('/v1/videos/x/ping', async (req) => ({
      visitorHash: req.visitorHash,
      ephemeral: req.visitorIsEphemeral,
    }))
    app.get('/v1/health', async () => ({ ok: true }))
    await app.ready()
    return app
  }

  it('首访普通路由 → 签发 signed rv_vid + 本次 ephemeral', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/v1/videos/x/ping' })
    expect(res.statusCode).toBe(200)
    const sc = res.headers['set-cookie']
    expect(sc, '应签发 rv_vid').toBeDefined()
    expect(String(sc)).toContain(`${VISITOR_COOKIE_NAME}=`)
    expect(res.json().ephemeral).toBe(true)
    await app.close()
  })

  it('携带有效 signed cookie 复访 → 不重签 + cookie-backed（非 ephemeral）', async () => {
    const app = await buildApp()
    const first = await app.inject({ method: 'GET', url: '/v1/videos/x/ping' })
    const rv = first.cookies.find((c) => c.name === VISITOR_COOKIE_NAME)
    expect(rv).toBeDefined()
    const second = await app.inject({
      method: 'GET',
      url: '/v1/videos/x/ping',
      cookies: { [VISITOR_COOKIE_NAME]: rv!.value },
    })
    expect(second.headers['set-cookie'], '复访不应重签').toBeUndefined()
    expect(second.json().ephemeral).toBe(false)
    expect(typeof second.json().visitorHash).toBe('string')
    await app.close()
  })

  it('GET /v1/health 探针 → 不签发 cookie（H-2）', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/v1/health' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['set-cookie']).toBeUndefined()
    await app.close()
  })

  it('HEAD 请求 → 不签发 cookie（H-2）', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'HEAD', url: '/v1/videos/x/ping' })
    expect(res.headers['set-cookie']).toBeUndefined()
    await app.close()
  })
})
