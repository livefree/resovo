/**
 * card-size-public.test.ts — 公开 GET /card-sizes Redis 读穿缓存（ADR-215 D-215-6 / SEQ-20260622-03）
 *
 * 覆盖（CardSizeService.getPublicCardSizes 经真 Fastify app inject，mock redis + queries）：
 *   - cache hit：redis.get 命中 → JSON.parse 直返，不触 DB（listCardSizeSettings 0 次）
 *   - cache miss：redis.get null → DB listCardSizeSettings（枚举序）+ setex TTL 兜底
 *   - 无鉴权 200（公开只读，前台 SSR 取数）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { CardSizeClass, CardSizeSettings } from '@resovo/types'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))

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
vi.mock('@/api/db/queries/card-size-settings', () => ({
  listCardSizeSettings: (...args: unknown[]) => mockList(...args),
  findCardSizeSettings: vi.fn(),
  updateCardSizeSettings: vi.fn(),
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
  const { cardSizeRoutes } = await import('@/api/routes/card-sizes')
  const app = Fastify({ logger: false })
  await app.register(cardSizeRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

// ── GET /card-sizes ──────────────────────────────────────────────────────────

describe('GET /card-sizes（公开读穿缓存）', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('cache hit：redis.get 命中 → 直返不触 DB', async () => {
    const cached = [row('standard'), row('compact'), row('scroll')]
    mockRedisGet.mockResolvedValue(JSON.stringify(cached))

    const res = await app.inject({ method: 'GET', url: '/v1/card-sizes' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.map((r: CardSizeSettings) => r.sizeClass)).toEqual(['standard', 'compact', 'scroll'])
    expect(mockList).not.toHaveBeenCalled()
    expect(mockRedisSetex).not.toHaveBeenCalled()
  })

  it('cache miss：redis.get null → DB 枚举序 + setex TTL 兜底', async () => {
    mockRedisGet.mockResolvedValue(null)
    // DB 字典序返回 → Service 重排为枚举序 standard/compact/scroll
    mockList.mockResolvedValue([row('compact'), row('scroll'), row('standard')])
    mockRedisSetex.mockResolvedValue('OK')

    const res = await app.inject({ method: 'GET', url: '/v1/card-sizes' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.map((r: CardSizeSettings) => r.sizeClass)).toEqual(['standard', 'compact', 'scroll'])
    expect(mockList).toHaveBeenCalledOnce()
    expect(mockRedisSetex).toHaveBeenCalledWith('card-sizes:v1', 60, expect.any(String))
  })

  it('无鉴权 200（公开只读，前台 SSR 取数）', async () => {
    mockRedisGet.mockResolvedValue(null)
    mockList.mockResolvedValue([row('standard'), row('compact'), row('scroll')])
    mockRedisSetex.mockResolvedValue('OK')

    const res = await app.inject({ method: 'GET', url: '/v1/card-sizes' })
    expect(res.statusCode).toBe(200)
  })
})
