/**
 * adminSearchTelemetryRoute.test.ts — 搜索埋点 route 层单测（ADR-200 D-200-10.3 / .4）
 *
 * 覆盖：GET /admin/search emit admin_search_query 字段 + PII（query_hash 非明文）
 *       POST /admin/search/telemetry 204 / 422 / role 不信 body / emit admin_search_click
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Writable } from 'node:stream'

const { mockSearch } = vi.hoisted(() => ({ mockSearch: vi.fn() }))

vi.mock('@/api/lib/elasticsearch', () => ({ es: {}, ES_INDEX: 'resovo_videos' }))
vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/services/AdminSearchService', () => ({
  AdminSearchService: vi.fn().mockImplementation(() => ({ search: mockSearch })),
}))
vi.mock('@/api/lib/redis', () => ({ redis: { get: vi.fn().mockResolvedValue(null) } }))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { createFastifyLoggerOptions } from '@/api/lib/logger'
import * as authLib from '@/api/lib/auth'
import type { UserRole } from '@/types'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const SALT = 'TEST_TELEMETRY_SALT'

// 捕获 ndjson 日志行（验 emit 字段 + PII 守门）
function makeCapture() {
  const lines: string[] = []
  const stream = new Writable({ write(chunk, _e, cb) { lines.push(String(chunk)); cb() } })
  return { lines, stream }
}

// 用**真实** logger 配置（serializeReq 截断 url.query + redact），仅覆盖 level=info 接捕获 stream，
// 忠实复现 prod PII 姿态（GET q 在 URL → 真实 serializer 须把 access log 的 url 切掉 query）
async function buildApp(stream: Writable) {
  const { adminSearchRoutes } = await import('@/api/routes/admin/search')
  const app = Fastify({
    logger: { ...createFastifyLoggerOptions(), level: 'info', stream },
    requestIdLogLabel: 'request_id',
  })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminSearchRoutes)
  await app.ready()
  return app
}

function asUser(role: UserRole, userId = 'u1') {
  mockVerify.mockReturnValue({ userId, role, iat: Math.floor(Date.now() / 1000) })
}

/** 解析捕获行中 metric==name 的第一条 */
function findMetric(lines: string[], name: string): Record<string, unknown> | undefined {
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>
      if (obj.metric === name) return obj
    } catch { /* 非 JSON 行跳过 */ }
  }
  return undefined
}

describe('GET /admin/search — admin_search_query emit（D-200-10.3）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SEARCH_TELEMETRY_SALT = SALT
    mockSearch.mockResolvedValue({
      query: 'gangtie',
      groups: [
        { kind: 'video', items: [{ id: 'v1' }, { id: 'v2' }] },
        { kind: 'user', items: [], degraded: true },
      ],
    })
  })
  afterEach(() => { delete process.env.SEARCH_TELEMETRY_SALT })

  it('emit admin_search_query：result_total / group_counts / degraded_kinds / latency_ms / role', async () => {
    asUser('admin')
    const { lines, stream } = makeCapture()
    const app = await buildApp(stream)
    await app.inject({ method: 'GET', url: '/admin/search?q=SECRETWORD', headers: { authorization: 'Bearer t' } })
    const m = findMetric(lines, 'admin_search_query')
    expect(m).toBeDefined()
    expect(m!.result_total).toBe(2)
    expect(m!.group_counts).toEqual({ video: 2, user: 0 })
    expect(m!.degraded_kinds).toEqual(['user'])
    expect(m!.role).toBe('admin')
    expect(typeof m!.latency_ms).toBe('number')
    expect(m!.query_len).toBe('SECRETWORD'.length)
    await app.close()
  })

  it('PII 守门：emit 带 16hex query_hash、不含明文 query', async () => {
    asUser('admin')
    const { lines, stream } = makeCapture()
    const app = await buildApp(stream)
    await app.inject({ method: 'GET', url: '/admin/search?q=SECRETWORD', headers: { authorization: 'Bearer t' } })
    const m = findMetric(lines, 'admin_search_query')
    expect(m!.query_hash).toMatch(/^[0-9a-f]{16}$/)
    // 全部日志行（含 access log）均不得出现明文搜索词
    expect(lines.join('')).not.toContain('SECRETWORD')
    await app.close()
  })
})

describe('POST /admin/search/telemetry — admin_search_click（D-200-10.4）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SEARCH_TELEMETRY_SALT = SALT
  })
  afterEach(() => { delete process.env.SEARCH_TELEMETRY_SALT })

  const validBody = { query: 'SECRETCLICK', clickedKind: 'video', clickedRank: 1, clickedGlobalRank: 3 }

  it('合法 body → 204 + emit admin_search_click（query_hash 非明文 + clicked_* 字段）', async () => {
    asUser('admin', 'click-user-1')
    const { lines, stream } = makeCapture()
    const app = await buildApp(stream)
    const res = await app.inject({
      method: 'POST', url: '/admin/search/telemetry',
      headers: { authorization: 'Bearer t' }, payload: validBody,
    })
    expect(res.statusCode).toBe(204)
    const m = findMetric(lines, 'admin_search_click')
    expect(m!.query_hash).toMatch(/^[0-9a-f]{16}$/)
    expect(m!.clicked_kind).toBe('video')
    expect(m!.clicked_rank).toBe(1)
    expect(m!.clicked_global_rank).toBe(3)
    expect(m!.role).toBe('admin')
    expect(lines.join('')).not.toContain('SECRETCLICK') // PII：明文不落日志
    await app.close()
  })

  it('非法 body（clickedRank<1）→ 422 VALIDATION_ERROR', async () => {
    asUser('admin', 'click-user-2')
    const { stream } = makeCapture()
    const app = await buildApp(stream)
    const res = await app.inject({
      method: 'POST', url: '/admin/search/telemetry',
      headers: { authorization: 'Bearer t' }, payload: { ...validBody, clickedRank: 0 },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    await app.close()
  })

  it('非法 clickedKind（非 SSOT enum）→ 422', async () => {
    asUser('admin', 'click-user-3')
    const { stream } = makeCapture()
    const app = await buildApp(stream)
    const res = await app.inject({
      method: 'POST', url: '/admin/search/telemetry',
      headers: { authorization: 'Bearer t' }, payload: { ...validBody, clickedKind: 'bogus' },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('role 取自 request.user 不信 body（moderator 即使 body 含 admin 也记 moderator）', async () => {
    asUser('moderator', 'click-user-4')
    const { lines, stream } = makeCapture()
    const app = await buildApp(stream)
    await app.inject({
      method: 'POST', url: '/admin/search/telemetry',
      headers: { authorization: 'Bearer t' },
      payload: { ...validBody, role: 'admin' }, // body 注入 role 应被忽略
    })
    expect(findMetric(lines, 'admin_search_click')!.role).toBe('moderator')
    await app.close()
  })

  it('超限 → 429 RATE_LIMITED', async () => {
    asUser('admin', 'rate-limit-user')
    const { stream } = makeCapture()
    const app = await buildApp(stream)
    let last = 0
    for (let i = 0; i < 61; i++) {
      const res = await app.inject({
        method: 'POST', url: '/admin/search/telemetry',
        headers: { authorization: 'Bearer t' }, payload: validBody,
      })
      last = res.statusCode
    }
    expect(last).toBe(429)
    await app.close()
  })

  it('普通 user 角色 → 403（requireRole 拦截）', async () => {
    asUser('user', 'click-user-5')
    const { stream } = makeCapture()
    const app = await buildApp(stream)
    const res = await app.inject({
      method: 'POST', url: '/admin/search/telemetry',
      headers: { authorization: 'Bearer t' }, payload: validBody,
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})
