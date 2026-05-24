/**
 * tests/unit/api/datatable-distinct-endpoint.test.ts —
 * ADR-150 阶段 3 / CHG-SN-9-DT-AUTOFILTER-EP-2 GET /admin/_dt/distinct 单测
 *
 * 覆盖（含 SQL 注入 4 case 三重防御验证）：
 *   #1 未鉴权 → 401
 *   #2 role=user → 403
 *   #3 表名不在白名单 → 422 VALIDATION_ERROR (zod enum 第 1 道防御)
 *   #4 表名合法 + 列名不在白名单 → 403 COLUMN_NOT_WHITELISTED (lookup 第 2 道防御)
 *   #5 正常查询无 q → 200 + DistinctResult[]
 *   #6 q 模糊匹配 → ILIKE param
 *   #7 limit 超过 200 → 422 (zod max 强制)
 *   #8 limit 负数 → 422 (zod min 强制)
 *   #9 sources 逻辑名 → 实际查 video_sources 表
 *   #10 SQL 注入 col=`*` → 403 (字符串不在白名单)
 *   #11 SQL 注入 col=`'; DROP TABLE users; --` → 403 (字符串不在白名单)
 *   #12 SQL 注入 q=`'; DROP TABLE users; --` → ILIKE 转义不命中危险
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import { db } from '@/api/lib/postgres'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockDbQuery = db.query as ReturnType<typeof vi.fn>

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => { vi.clearAllMocks() })

async function buildApp() {
  const { registerDataTableRoutes } = await import('@/api/routes/admin/_datatable')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(registerDataTableRoutes)
  await app.ready()
  return app
}

function adminAuth() {
  mockVerify.mockReturnValue({ userId: ADMIN_ID, role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}
function userAuth() {
  mockVerify.mockReturnValue({ userId: USER_ID, role: 'user', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

describe('GET /admin/_dt/distinct (ADR-150 D-150-3)', () => {
  it('#1 未鉴权 → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/_dt/distinct?table=crawler_runs&col=status' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('#2 role=user → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=crawler_runs&col=status',
      headers: userAuth(),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('#3 表名不在白名单 → 422 VALIDATION_ERROR (zod enum 第 1 道防御)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=evil_table&col=status',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    await app.close()
  })

  it('#4 表合法 + 列不在白名单 → 403 COLUMN_NOT_WHITELISTED (lookup 第 2 道防御)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=crawler_runs&col=evil_col',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('COLUMN_NOT_WHITELISTED')
    expect(mockDbQuery).not.toHaveBeenCalled()
    await app.close()
  })

  it('#5 正常查询无 q → 200 + DistinctResult[]', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        { value: 'running', count: 12 },
        { value: 'done', count: 5 },
      ],
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=crawler_runs&col=status',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([
      { value: 'running', count: 12 },
      { value: 'done', count: 5 },
    ])
    const [sql, params] = mockDbQuery.mock.calls[0]
    expect(sql).toContain('FROM crawler_runs')
    expect(sql).toContain('crawler_runs.status')
    expect(params).toEqual([50])
    await app.close()
  })

  it('#6 q 模糊匹配 → ILIKE param 含 %', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ value: 'running', count: 1 }] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=crawler_runs&col=status&q=run',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    const [sql, params] = mockDbQuery.mock.calls[0]
    expect(sql).toContain('ILIKE $1')
    expect(params[0]).toBe('%run%')
    expect(params[1]).toBe(50)
    await app.close()
  })

  it('#7 limit > 200 → 422 (zod max 强制)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=crawler_runs&col=status&limit=500',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('#8 limit 负数 → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=crawler_runs&col=status&limit=-5',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('#9 sources 逻辑名 → SQL FROM video_sources', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ value: 'youku', count: 100 }] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=sources&col=site_key',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    const [sql] = mockDbQuery.mock.calls[0]
    expect(sql).toContain('FROM video_sources')
    expect(sql).toContain('video_sources.source_site_key')
    await app.close()
  })

  it('#10 SQL 注入 col=* → 403 (字符串不在白名单 / lookup miss)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/_dt/distinct?table=crawler_runs&col=' + encodeURIComponent('*'),
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('COLUMN_NOT_WHITELISTED')
    expect(mockDbQuery).not.toHaveBeenCalled()
    await app.close()
  })

  it('#11 SQL 注入 col=DROP TABLE → 403 (字符串不在白名单)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/_dt/distinct?table=crawler_runs&col=' + encodeURIComponent("'; DROP TABLE users; --"),
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('COLUMN_NOT_WHITELISTED')
    expect(mockDbQuery).not.toHaveBeenCalled()
    await app.close()
  })

  it('#12 SQL 注入 q=DROP TABLE → ILIKE 参数化转义不命中危险', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/_dt/distinct?table=crawler_runs&col=status&q=' + encodeURIComponent("'; DROP TABLE users; --"),
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    const [sql, params] = mockDbQuery.mock.calls[0]
    expect(sql).not.toContain('DROP TABLE')
    expect(sql).toContain('ILIKE $1')
    expect(params[0]).toContain('%')
    await app.close()
  })

  it('#13 audit_log action_type → SQL 含 admin_audit_log.action_type', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ value: 'video.publish', count: 50 }] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=admin_audit_log&col=action_type',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    const [sql] = mockDbQuery.mock.calls[0]
    expect(sql).toContain('admin_audit_log.action_type')
    await app.close()
  })

  it('#14 row.value null → 转空字符串 / row.count 保留', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        { value: null, count: 3 },
        { value: 'x', count: 1 },
      ],
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=users&col=role',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data[0]).toEqual({ value: '', count: 3 })
    await app.close()
  })

  it('#15 DB query throw → 500 INTERNAL_ERROR', async () => {
    mockDbQuery.mockRejectedValueOnce(new Error('boom'))
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/_dt/distinct?table=crawler_runs&col=status',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(500)
    expect(res.json().error.code).toBe('INTERNAL_ERROR')
    await app.close()
  })
})
