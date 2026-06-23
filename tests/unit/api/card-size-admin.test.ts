/**
 * card-size-admin.test.ts — admin /admin/card-sizes 读写路由 + audit（ADR-215 + Amendment A1 / SEQ-20260623-01）
 *
 * 覆盖（CardSizeService 经真 Fastify app inject，mock queries + AuditLogService）：
 *   GET  /admin/card-sizes            — 200 + 2 档按 CARD_SIZE_CLASSES 枚举序（非 DB 字典序）
 *   PUT  /admin/card-sizes/:sizeClass — 200 + audit card_size.update 内容断言（targetId=row.id + before/after）
 *     · 未知字段 422（.strict()）：带 desktopColumns（A1 护栏不暴露编辑）或其他 unknown key
 *     · 范围越界 422（D-214-10）：卡宽 401 > 400 / 119 < 120 / gap 65
 *     · 缺必填 cardWidthPx 422
 *     · 枚举外 sizeClass 422（先于 404）；行缺失 404（迁移漂移兜底）
 *
 * Amendment A1：单位统一为卡宽（standard size-driven / scroll 横滚同构），body = { cardWidthPx [120,400], gapPx }。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'
import type { CardSizeClass, CardSizeSettings } from '@resovo/types'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))

// PUT 写提交后 best-effort 失效公开缓存（unlink）；admin GET/PUT 经真 CardSizeService 消费 redis
const mockRedisGet = vi.fn()
const mockRedisSetex = vi.fn()
const mockRedisUnlink = vi.fn()
vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    setex: (...args: unknown[]) => mockRedisSetex(...args),
    unlink: (...args: unknown[]) => mockRedisUnlink(...args),
  },
}))

const mockList = vi.fn()
const mockFind = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/api/db/queries/card-size-settings', () => ({
  listCardSizeSettings: (...args: unknown[]) => mockList(...args),
  findCardSizeSettings: (...args: unknown[]) => mockFind(...args),
  updateCardSizeSettings: (...args: unknown[]) => mockUpdate(...args),
}))

const mockAuditWrite = vi.fn()
vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: class {
    write = mockAuditWrite
  },
}))

// ── Fixtures（Amendment A1：2 档、单位统一为卡宽）──────────────────────────────

function row(sizeClass: CardSizeClass, over: Partial<CardSizeSettings> = {}): CardSizeSettings {
  const base: Record<CardSizeClass, CardSizeSettings> = {
    standard: { id: 'cs-standard', sizeClass: 'standard', desktopColumns: null, cardWidthPx: 200, gapPx: 16, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
    scroll: { id: 'cs-scroll', sizeClass: 'scroll', desktopColumns: null, cardWidthPx: 170, gapPx: 16, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
  }
  return { ...base[sizeClass], ...over }
}

async function buildApp() {
  const { adminCardSizeRoutes } = await import('@/api/routes/admin/card-sizes')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminCardSizeRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function adminToken() {
  return `Bearer ${await signAccessToken({ userId: 'u-admin', role: 'admin' })}`
}

// ── GET /admin/card-sizes ────────────────────────────────────────────────────

describe('GET /admin/card-sizes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    // DB 字典序返回（scroll/standard）——断言 Service 重排为枚举序 standard/scroll
    mockList.mockResolvedValue([row('scroll'), row('standard')])
    app = await buildApp()
  })

  it('200 + 2 档按 CARD_SIZE_CLASSES 枚举序（非 DB 字典序）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/card-sizes',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.map((r: CardSizeSettings) => r.sizeClass)).toEqual(['standard', 'scroll'])
  })

  it('未鉴权 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/card-sizes' })
    expect(res.statusCode).toBe(401)
  })
})

// ── PUT /admin/card-sizes/:sizeClass ─────────────────────────────────────────

describe('PUT /admin/card-sizes/:sizeClass', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFind.mockResolvedValue(row('standard'))
    mockUpdate.mockResolvedValue(row('standard', { cardWidthPx: 220 }))
    mockRedisUnlink.mockResolvedValue(1)
    app = await buildApp()
  })

  it('standard 更新成功 200 + data（cardWidthPx 单位）', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 220, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.cardWidthPx).toBe(220)
    expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), 'standard', expect.objectContaining({ cardWidthPx: 220, gapPx: 16 }))
  })

  it('audit R-MID-1 内容断言：actionType/targetKind/targetId=row.id + before/after', async () => {
    await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 220, gapPx: 16 }),
    })
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'card_size.update',
      targetKind: 'card_size',
      targetId: 'cs-standard',
      beforeJsonb: expect.objectContaining({ cardWidthPx: 200 }),
      afterJsonb: expect.objectContaining({ cardWidthPx: 220 }),
    }))
  })

  it('PUT 成功 → 失效公开缓存（redis.unlink card-sizes:v1，D-215-6）', async () => {
    await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 220, gapPx: 16 }),
    })
    expect(mockRedisUnlink).toHaveBeenCalledWith('card-sizes:v1')
  })

  it('redis.unlink 失败 → PUT 仍 200（best-effort 不上抛，D-215-6 / Codex-R3）', async () => {
    mockRedisUnlink.mockRejectedValueOnce(new Error('redis down'))
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 220, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.cardWidthPx).toBe(220)
  })

  it('scroll 档更新成功 200（cardWidthPx 单位，与 standard 同构）', async () => {
    mockFind.mockResolvedValue(row('scroll'))
    mockUpdate.mockResolvedValue(row('scroll', { cardWidthPx: 200 }))
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/scroll',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 200, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.cardWidthPx).toBe(200)
  })

  // ── 未知字段 422（.strict()：A1 后 desktopColumns 护栏不暴露编辑）─────────────

  it('未知字段 422：standard 带 desktopColumns（护栏不暴露）被拒', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 200, desktopColumns: 5, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('未知字段 422：scroll 带 desktopColumns 被拒', async () => {
    mockFind.mockResolvedValue(row('scroll'))
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/scroll',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 170, desktopColumns: 5, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── 范围越界 422（D-214-10 双层下层 zod；A1 卡宽 [120,400]）──────────────────

  it('范围越界 422：cardWidthPx 401 > 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 401, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('范围越界 422：cardWidthPx 119 < 120', async () => {
    mockFind.mockResolvedValue(row('scroll'))
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/scroll',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 119, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('范围内 422 边界放宽验证：cardWidthPx 350（原 [120,280] 拒、A1 [120,400] 允）→ 200', async () => {
    mockUpdate.mockResolvedValue(row('standard', { cardWidthPx: 350 }))
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 350, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.cardWidthPx).toBe(350)
  })

  it('范围越界 422：gapPx 65 > 64', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 200, gapPx: 65 }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('缺必填字段 422：缺 cardWidthPx', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
  })

  // ── sizeClass 枚举 + 404 ─────────────────────────────────────────────────────

  it('枚举外 sizeClass 422（先于 404，不触 find）', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/huge',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 200, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('退役档 compact（A1 枚举外）422（先于 404）', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/compact',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 200, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('行缺失（迁移漂移兜底）404', async () => {
    mockFind.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 220, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })
})
