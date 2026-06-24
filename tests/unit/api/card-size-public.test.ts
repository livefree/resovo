/**
 * card-size-public.test.ts — 公开 GET /card-sizes Redis 读穿缓存（ADR-215 D-215-6 + Amendment A2 / SEQ-20260623-02）
 *
 * 覆盖（CardSizeService.getPublicCardSizes 经真 Fastify app inject，mock redis + queries）：
 *   - cache hit：redis.get 命中 → JSON.parse 直返，不触 DB（listCardSizeSettings 0 次）
 *   - cache miss：redis.get null → DB listCardSizeSettings + setex TTL 兜底
 *   - 无鉴权 200（公开只读，前台 SSR 取数）
 *
 * Amendment A2：单行全局（size_class='global'，全站统一卡宽）。
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

// ── Fixtures（Amendment A2：单行全局）──────────────────────────────────────────

function row(sizeClass: CardSizeClass, over: Partial<CardSizeSettings> = {}): CardSizeSettings {
  const base: Record<CardSizeClass, CardSizeSettings> = {
    global: { id: 'cs-global', sizeClass: 'global', cardWidthPx: 160, gapPx: 16, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
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
    const cached = [row('global')]
    mockRedisGet.mockResolvedValue(JSON.stringify(cached))

    const res = await app.inject({ method: 'GET', url: '/v1/card-sizes' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.map((r: CardSizeSettings) => r.sizeClass)).toEqual(['global'])
    expect(mockList).not.toHaveBeenCalled()
    expect(mockRedisSetex).not.toHaveBeenCalled()
  })

  it('cache miss：redis.get null → DB 单行全局 + setex TTL 兜底', async () => {
    mockRedisGet.mockResolvedValue(null)
    mockList.mockResolvedValue([row('global')])
    mockRedisSetex.mockResolvedValue('OK')

    const res = await app.inject({ method: 'GET', url: '/v1/card-sizes' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.map((r: CardSizeSettings) => r.sizeClass)).toEqual(['global'])
    expect(mockList).toHaveBeenCalledOnce()
    expect(mockRedisSetex).toHaveBeenCalledWith('card-sizes:v1', 60, expect.any(String))
  })

  it('无鉴权 200（公开只读，前台 SSR 取数）', async () => {
    mockRedisGet.mockResolvedValue(null)
    mockList.mockResolvedValue([row('global')])
    mockRedisSetex.mockResolvedValue('OK')

    const res = await app.inject({ method: 'GET', url: '/v1/card-sizes' })
    expect(res.statusCode).toBe(200)
  })
})
