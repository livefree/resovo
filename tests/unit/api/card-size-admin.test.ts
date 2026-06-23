/**
 * card-size-admin.test.ts — admin /admin/card-sizes 读写路由 + audit（ADR-215 / SEQ-20260622-03）
 *
 * 覆盖（CardSizeService 经真 Fastify app inject，mock queries + AuditLogService）：
 *   GET  /admin/card-sizes            — 200 + 3 档按 CARD_SIZE_CLASSES 枚举序（非 DB 字典序）
 *   PUT  /admin/card-sizes/:sizeClass — 200 + audit card_size.update 内容断言（targetId=row.id + before/after）
 *     · 倒置 body 422（Codex-R1）：grid 档带 cardWidthPx / scroll 档带 desktopColumns（.strict() unknown key）
 *     · 范围越界 422（D-214-10）：列 9 / 卡宽 300 / gap 65
 *     · 枚举外 sizeClass 422（先于 404）
 *     · 行缺失 404（迁移漂移兜底）
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

// ── Fixtures ───────────────────────────────────────────────────────────────

function row(sizeClass: CardSizeClass, over: Partial<CardSizeSettings> = {}): CardSizeSettings {
  const base: Record<CardSizeClass, CardSizeSettings> = {
    standard: { id: 'cs-standard', sizeClass: 'standard', desktopColumns: 5, cardWidthPx: null, gapPx: 16, settings: {}, updatedAt: '2026-06-22T00:00:00Z' },
    compact: { id: 'cs-compact', sizeClass: 'compact', desktopColumns: 3, cardWidthPx: null, gapPx: 12, settings: {}, updatedAt: '2026-06-22T00:00:00Z' },
    scroll: { id: 'cs-scroll', sizeClass: 'scroll', desktopColumns: null, cardWidthPx: 170, gapPx: 16, settings: {}, updatedAt: '2026-06-22T00:00:00Z' },
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
    // DB 字典序返回（compact/scroll/standard）——断言 Service 重排为枚举序 standard/compact/scroll
    mockList.mockResolvedValue([row('compact'), row('scroll'), row('standard')])
    app = await buildApp()
  })

  it('200 + 3 档按 CARD_SIZE_CLASSES 枚举序（非 DB 字典序）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/card-sizes',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.map((r: CardSizeSettings) => r.sizeClass)).toEqual(['standard', 'compact', 'scroll'])
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
    mockUpdate.mockResolvedValue(row('standard', { desktopColumns: 6 }))
    mockRedisUnlink.mockResolvedValue(1)
    app = await buildApp()
  })

  it('网格档更新成功 200 + data', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ desktopColumns: 6, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.desktopColumns).toBe(6)
    expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), 'standard', expect.objectContaining({ desktopColumns: 6, gapPx: 16 }))
  })

  it('audit R-MID-1 内容断言：actionType/targetKind/targetId=row.id + before/after', async () => {
    await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ desktopColumns: 6, gapPx: 16 }),
    })
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'card_size.update',
      targetKind: 'card_size',
      targetId: 'cs-standard',
      beforeJsonb: expect.objectContaining({ desktopColumns: 5 }),
      afterJsonb: expect.objectContaining({ desktopColumns: 6 }),
    }))
  })

  it('PUT 成功 → 失效公开缓存（redis.unlink card-sizes:v1，D-215-6）', async () => {
    await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ desktopColumns: 6, gapPx: 16 }),
    })
    expect(mockRedisUnlink).toHaveBeenCalledWith('card-sizes:v1')
  })

  it('redis.unlink 失败 → PUT 仍 200（best-effort 不上抛，D-215-6 / Codex-R3）', async () => {
    mockRedisUnlink.mockRejectedValueOnce(new Error('redis down'))
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ desktopColumns: 6, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.desktopColumns).toBe(6)
  })

  it('scroll 档更新成功 200（cardWidthPx 单位）', async () => {
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

  // ── 倒置 body 422（Codex-R1 HIGH：档位×单位绑定 zod 守卫）──────────────────

  it('倒置 body 422：网格档（standard）带 cardWidthPx（scroll 单位）被拒', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 170, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('倒置 body 422：scroll 档带 desktopColumns（网格单位）被拒', async () => {
    mockFind.mockResolvedValue(row('scroll'))
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/scroll',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ desktopColumns: 5, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── 范围越界 422（D-214-10 双层下层 zod）────────────────────────────────────

  it('范围越界 422：desktopColumns 9 > 8', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ desktopColumns: 9, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('范围越界 422：cardWidthPx 300 > 280', async () => {
    mockFind.mockResolvedValue(row('scroll'))
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/scroll',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ cardWidthPx: 300, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('范围越界 422：gapPx 65 > 64', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ desktopColumns: 5, gapPx: 65 }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('缺必填字段 422：网格档缺 desktopColumns', async () => {
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
      body: JSON.stringify({ desktopColumns: 5, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('行缺失（迁移漂移兜底）404', async () => {
    mockFind.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/card-sizes/standard',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ desktopColumns: 6, gapPx: 16 }),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })
})
