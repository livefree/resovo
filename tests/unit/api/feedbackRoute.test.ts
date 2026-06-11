/**
 * tests/unit/api/feedbackRoute.test.ts
 * CHG-SN-4-05: POST /feedback/playback — rate-limit + PII hash + 副作用
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'

const mockRedis = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
}))
vi.mock('@/api/lib/redis', () => ({
  redis: mockRedis,
  default: mockRedis,
}))

const mockDb = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}))
vi.mock('@/api/lib/postgres', () => ({ db: mockDb }))

const mockInsertHealthEvent = vi.fn()
vi.mock('@/api/db/queries/sourceHealthEvents', () => ({
  listLineHealthEvents: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  insertHealthEvent: (...args: unknown[]) => mockInsertHealthEvent(...args),
}))

async function buildApp(opts?: { trustProxy?: boolean | string | string[] }) {
  const { feedbackRoutes } = await import('@/api/routes/feedback')
  const app = Fastify({ logger: false, trustProxy: opts?.trustProxy ?? false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(feedbackRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

const validBody = {
  videoId: '00000000-0000-0000-0000-000000000001',
  sourceId: '00000000-0000-0000-0000-000000000002',
  success: true,
}

describe('POST /feedback/playback', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.set.mockResolvedValue('OK')   // rate-limit 通过
    mockRedis.get.mockResolvedValue('0')
    mockRedis.incr.mockResolvedValue(1)
    mockRedis.expire.mockResolvedValue(1)
    mockInsertHealthEvent.mockResolvedValue('ev-1')
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('合法请求 → 202 + { received: true }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(202)
    expect(res.json().data.received).toBe(true)
  })

  it('rate-limit 触发 → 429 RATE_LIMITED', async () => {
    mockRedis.set.mockResolvedValue(null)  // NX 失败 = 已有 key
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(429)
    expect(res.json().error.code).toBe('RATE_LIMITED')
  })

  it('body 缺少必填字段 → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoId: 'bad-uuid', success: true }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('success=false → fire-and-forget insertHealthEvent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, success: false, errorCode: 'ERR_NETWORK' }),
    })
    expect(res.statusCode).toBe(202)
    await vi.waitFor(() => expect(mockInsertHealthEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ origin: 'feedback_driven', sourceId: validBody.sourceId }),
    ))
  })

  it('success=false × ≥3 → 额外插入 queue signal（processedAt=null）', async () => {
    mockRedis.incr.mockResolvedValue(3)  // 第三次失败
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, success: false }),
    })
    expect(res.statusCode).toBe(202)
    await vi.waitFor(() => {
      const calls = mockInsertHealthEvent.mock.calls
      const queueSignal = calls.find((c) => c[1]?.processedAt === null)
      expect(queueSignal).toBeDefined()
    })
  })

  it('success=true + resolutionHeight → fire-and-forget db.query quality update', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, resolutionHeight: 1080, resolutionWidth: 1920 }),
    })
    expect(res.statusCode).toBe(202)
    await vi.waitFor(() => {
      const calls = mockDb.query.mock.calls
      const qualityUpdate = calls.find((c: unknown[]) => String(c[0]).includes('quality_detected'))
      expect(qualityUpdate).toBeDefined()
    })
  })

  it('IP 地址不存储原值，只使用 hash（8 hex）作为 rate-limit key', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.168.1.1' },
      body: JSON.stringify(validBody),
    })
    const setCall = mockRedis.set.mock.calls[0]
    const rateLimitKey = setCall[0] as string
    // key 格式: fb:rl:{8字节ipHash}:{sourceId}
    expect(rateLimitKey).toMatch(/^fb:rl:[0-9a-f]{8}:/)
    expect(rateLimitKey).not.toContain('192.168')
  })

  // CHG-SN-5-PRE-01-D（DEBT-SN-4-05-B）
  it('trustProxy=false（默认）→ 客户端伪造的 XFF 被忽略，rate-limit 不可绕过', async () => {
    // 同一 socket.remoteAddress + 不同 XFF → ipHash 相同 → 共享 rate-limit key
    const key1Promise = app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
      body: JSON.stringify(validBody),
    })
    const key2Promise = app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '2.2.2.2' },
      body: JSON.stringify(validBody),
    })
    await Promise.all([key1Promise, key2Promise])

    const calls = mockRedis.set.mock.calls
    const keys = calls.map((c) => c[0] as string)
    expect(keys).toHaveLength(2)
    // 两个请求生成的 ipHash 段相同（因为 XFF 被忽略，都用 socket 默认 IP）
    const hash1 = keys[0].match(/^fb:rl:([0-9a-f]+):/)?.[1]
    const hash2 = keys[1].match(/^fb:rl:([0-9a-f]+):/)?.[1]
    expect(hash1).toBeDefined()
    expect(hash1).toBe(hash2)
  })
})

// SRCHEALTH-P2-2（SEQ-20260610-02）：EMA 反馈落账
describe('POST /feedback/playback — EMA 落账（fb_score / fb_sample_weight / last_feedback_at）', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue('0')
    mockRedis.incr.mockResolvedValue(1)
    mockRedis.expire.mockResolvedValue(1)
    mockInsertHealthEvent.mockResolvedValue('ev-1')
    mockDb.query.mockResolvedValue({ rows: [] })
    app = await buildApp()
  })
  afterEach(() => app.close())

  const findEmaCall = () =>
    mockDb.query.mock.calls.find((c: unknown[]) => String(c[0]).includes('fb_score'))

  it('success=true → EMA UPDATE obs=1（参数 [sourceId, 1, halfLife]）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(202)
    await vi.waitFor(() => expect(findEmaCall()).toBeDefined())
    const [sql, params] = findEmaCall() as [string, unknown[]]
    expect(params).toEqual([validBody.sourceId, 1, 7 * 24 * 60 * 60])
    expect(sql).toContain('last_feedback_at = NOW()')
    expect(sql).toContain('deleted_at IS NULL')
  })

  it('success=false → EMA UPDATE obs=0（与 insertHealthEvent / redis INCR 并行正交）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, success: false, errorCode: 'ERR_NETWORK' }),
    })
    expect(res.statusCode).toBe(202)
    await vi.waitFor(() => expect(findEmaCall()).toBeDefined())
    const [, params] = findEmaCall() as [string, unknown[]]
    expect(params).toEqual([validBody.sourceId, 0, 7 * 24 * 60 * 60])
    // EMA 不替代既有 failure 副作用
    await vi.waitFor(() => expect(mockInsertHealthEvent).toHaveBeenCalled())
    expect(mockRedis.incr).toHaveBeenCalled()
  })

  it('SQL 形态守卫：decay 输入必须直接自引用目标表（并发安全；arch-reviewer 二轮裁决）', async () => {
    // 本用例验证 RC 下单语句自引用 UPDATE 的 EvalPlanQual 串行化保证赖以成立的 SQL 形态：
    // 若 SQL 退回任何 FROM / CTE / LATERAL 子查询取 decay 输入（EPQ 不重跑子计划 →
    // 并发反馈 last-write-lost + 新旧版本混合值），本用例必须 RED。
    await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    await vi.waitFor(() => expect(findEmaCall()).toBeDefined())
    const [sql] = findEmaCall() as [string, unknown[]]
    // 禁止形态：子查询 / CTE / LATERAL（注意 EXTRACT(EPOCH FROM (...)) 的 "FROM (" 是合法时间表达式，
    // 子查询指纹是 "FROM (SELECT"）
    expect(sql).not.toMatch(/FROM\s*\(\s*SELECT/i)
    expect(sql).not.toMatch(/\bWITH\b/i)
    expect(sql).not.toMatch(/\bLATERAL\b/i)
    // 必须形态：decay 输入列直接引用目标表别名 vs + 冷启动 NULL→decay=0 分支
    expect(sql).toMatch(/CASE WHEN vs\.last_feedback_at IS NULL THEN 0/)
    expect(sql).toMatch(/COALESCE\(vs\.fb_sample_weight, 0\)/)
    expect(sql).toMatch(/COALESCE\(vs\.fb_score, 0\)/)
    expect(sql).toContain('power(0.5, EXTRACT(EPOCH FROM (NOW() - vs.last_feedback_at))')
  })

  it('EMA UPDATE 失败 → warn 不抛、202 不受影响、复活 UPDATE 仍执行（失败隔离）', async () => {
    mockDb.query.mockImplementation((sql: string) =>
      String(sql).includes('fb_score')
        ? Promise.reject(new Error('check violation'))
        : Promise.resolve({ rows: [] }),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(202)
    // 复活 UPDATE（probe_status dead→ok）独立执行不被 EMA 失败连累
    await vi.waitFor(() => {
      const reviveCall = mockDb.query.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes("probe_status = CASE WHEN probe_status = 'dead'"),
      )
      expect(reviveCall).toBeDefined()
    })
  })
})

// CHG-SN-5-PRE-01-D（DEBT-SN-4-05-B）
describe('POST /feedback/playback — trustProxy 启用时', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue('0')
    mockRedis.incr.mockResolvedValue(1)
    mockRedis.expire.mockResolvedValue(1)
    mockInsertHealthEvent.mockResolvedValue('ev-1')
    // app.inject 模拟连接来自 127.0.0.1，将其加入信任白名单
    app = await buildApp({ trustProxy: '127.0.0.1' })
  })
  afterEach(() => app.close())

  it('白名单上游 → 不同 XFF 解析为不同 request.ip → 不同 ipHash', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '3.3.3.3' },
      body: JSON.stringify(validBody),
    })
    await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '4.4.4.4' },
      body: JSON.stringify(validBody),
    })
    const keys = mockRedis.set.mock.calls.map((c) => c[0] as string)
    const hash1 = keys[0].match(/^fb:rl:([0-9a-f]+):/)?.[1]
    const hash2 = keys[1].match(/^fb:rl:([0-9a-f]+):/)?.[1]
    expect(hash1).toBeDefined()
    expect(hash2).toBeDefined()
    expect(hash1).not.toBe(hash2)  // 信任 XFF 后两次 IP 不同 → 两个独立 rate-limit bucket
  })
})
