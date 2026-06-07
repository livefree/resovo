/**
 * home-cache-invalidation.test.ts — 发布后公开缓存主动失效
 * （CHG-HOME-CACHE-INVALIDATE / ADR-185 D-185-5）
 *
 * 覆盖：
 *   - 子前缀级精确 scan 删（home:shelf:* + home:top10:* 两族独立；
 *     不触 home:* 整前缀——D-185-5.3 非目标 home key 保护）
 *   - SCAN 游标分页聚合 / 空键族合法态（unlink 不调）
 *   - 失败容忍（D-185-5.2：schedule 包装 warn 不上抛，TTL 兜底）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Redis } from 'ioredis'

vi.mock('@/api/lib/redis', () => ({
  redis: { scan: vi.fn(), unlink: vi.fn() },
}))

const mockWarn = vi.fn()
const mockDebug = vi.fn()
vi.mock('@/api/lib/logger', () => ({
  baseLogger: {
    warn: (...args: unknown[]) => mockWarn(...args),
    debug: (...args: unknown[]) => mockDebug(...args),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  HOME_PUBLISH_INVALIDATION_PREFIXES,
  invalidatePublishedHomeCaches,
  schedulePublishedHomeCacheInvalidation,
} from '@/api/services/home-cache-invalidation'

function fakeRedis(keysByPattern: Record<string, string[]>): Redis & { scan: ReturnType<typeof vi.fn>; unlink: ReturnType<typeof vi.fn> } {
  const scan = vi.fn(async (_cursor: string, _m: string, pattern: string) => {
    return ['0', keysByPattern[pattern] ?? []]
  })
  const unlink = vi.fn(async (...keys: string[]) => keys.length)
  return { scan, unlink } as unknown as Redis & { scan: typeof scan; unlink: typeof unlink }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('invalidatePublishedHomeCaches（D-185-5.1/-5.3）', () => {
  it('接口位对账：失效目标 = shelf + top10 两个子前缀（D-184-5.2 接口位消费）', () => {
    expect(HOME_PUBLISH_INVALIDATION_PREFIXES).toEqual(['home:shelf:', 'home:top10:'])
  })

  it('两族键 scan + unlink；返回删除计数；不触 home:* 整前缀', async () => {
    const redis = fakeRedis({
      'home:shelf:*': ['home:shelf:hot_movies:b:none', 'home:shelf:hot_series:b:alpha'],
      'home:top10:*': ['home:top10:none'],
    })
    const deleted = await invalidatePublishedHomeCaches(redis)
    expect(deleted).toBe(3)
    // 子前缀级精确 MATCH（D-185-5.3：禁 home:* 整删——非目标 home key 保护）
    const patterns = redis.scan.mock.calls.map((c) => c[2])
    expect(patterns).toEqual(['home:shelf:*', 'home:top10:*'])
    expect(redis.unlink).toHaveBeenCalledWith('home:shelf:hot_movies:b:none', 'home:shelf:hot_series:b:alpha')
    expect(redis.unlink).toHaveBeenCalledWith('home:top10:none')
  })

  it('空键族 → 0 且 unlink 不调（合法态，冷缓存）', async () => {
    const redis = fakeRedis({})
    expect(await invalidatePublishedHomeCaches(redis)).toBe(0)
    expect(redis.unlink).not.toHaveBeenCalled()
  })

  it('SCAN 游标分页：跨批次聚合后一次 unlink', async () => {
    const scan = vi.fn()
      .mockResolvedValueOnce(['7', ['home:shelf:a']])
      .mockResolvedValueOnce(['0', ['home:shelf:b']])
      .mockResolvedValueOnce(['0', []]) // top10 族为空
    const unlink = vi.fn(async () => 2)
    const redis = { scan, unlink } as unknown as Redis
    expect(await invalidatePublishedHomeCaches(redis)).toBe(2)
    expect(unlink).toHaveBeenCalledTimes(1)
    expect(unlink).toHaveBeenCalledWith('home:shelf:a', 'home:shelf:b')
  })
})

describe('schedulePublishedHomeCacheInvalidation（D-185-5.2 失败容忍）', () => {
  it('成功 → debug 携 trigger/versionNo/deleted', async () => {
    const redis = fakeRedis({ 'home:shelf:*': ['home:shelf:x'] })
    schedulePublishedHomeCacheInvalidation({ trigger: 'publish', versionNo: 5 }, redis)
    await vi.waitFor(() => expect(mockDebug).toHaveBeenCalled())
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'publish', versionNo: 5, deleted: 1 }),
      expect.stringContaining('invalidated'),
    )
    expect(mockWarn).not.toHaveBeenCalled()
  })

  it('redis 故障 → warn 不上抛（发布不回滚，60s TTL 兜底自愈）', async () => {
    const scan = vi.fn().mockRejectedValue(new Error('redis down'))
    const redis = { scan, unlink: vi.fn() } as unknown as Redis
    expect(() =>
      schedulePublishedHomeCacheInvalidation({ trigger: 'rollback', versionNo: 3 }, redis),
    ).not.toThrow()
    await vi.waitFor(() => expect(mockWarn).toHaveBeenCalled())
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'rollback', versionNo: 3, err: expect.any(Error) }),
      expect.stringContaining('TTL 兜底'),
    )
  })
})
