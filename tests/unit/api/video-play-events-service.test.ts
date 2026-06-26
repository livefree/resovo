/**
 * video-play-events-service.test.ts — VideoPlayEventService 业务编排单测（ADR-216 / STATS-03-A2）
 *
 * 覆盖门禁：not_found / invalid_source / 双维限流命中 / **限流 fail-closed** / occurredAt 非对称 clamp /
 *   幂等（ON CONFLICT inserted:false → ok）/ **23505 双约束**（第二防线 → ok；其余约束 → 上抛 500）/
 *   匿名 userId 透传 / visitor 身份 null 回退 ephemeral。mock query 模块 + redis，不连真 DB/Redis。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../apps/api/src/db/queries/videos', () => ({ findVideoByShortId: vi.fn() }))
vi.mock('../../../apps/api/src/db/queries/videoPlayStats', () => ({
  insertVideoPlayEvent: vi.fn(),
  isActiveSourceOfVideo: vi.fn(),
}))

import type { Pool } from 'pg'
import type { Redis } from 'ioredis'
import { findVideoByShortId } from '../../../apps/api/src/db/queries/videos'
import {
  insertVideoPlayEvent,
  isActiveSourceOfVideo,
} from '../../../apps/api/src/db/queries/videoPlayStats'
import {
  VideoPlayEventService,
  type RecordPlayEventInput,
} from '../../../apps/api/src/services/VideoPlayEventService'

const mockFindVideo = vi.mocked(findVideoByShortId)
const mockInsert = vi.mocked(insertVideoPlayEvent)
const mockSourceValid = vi.mocked(isActiveSourceOfVideo)

const VIDEO = { id: 'video-uuid-1', shortId: 'abcd1234' } as unknown as Awaited<
  ReturnType<typeof findVideoByShortId>
>

function makeRedis(over: Partial<Record<'incr' | 'expire' | 'set' | 'del', unknown>> = {}): Redis {
  return {
    set: vi.fn().mockResolvedValue('OK'), // SET NX marker：'OK'=acquired
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ...over,
  } as unknown as Redis
}

function baseInput(over: Partial<RecordPlayEventInput> = {}): RecordPlayEventInput {
  return {
    shortId: 'abcd1234',
    sourceId: null,
    episodeNumber: null,
    playSessionId: 'session-0123456789abcd',
    idempotencyKey: 'a'.repeat(64),
    watchSeconds: 42,
    durationSeconds: 1200,
    occurredAt: new Date().toISOString(),
    locale: null,
    referrerPath: null,
    visitorHash: 'visitor-hash-1',
    visitorIsEphemeral: false,
    userId: null,
    ip: '203.0.113.9',
    userAgent: 'UA/1.0',
    ...over,
  }
}

const db = {} as Pool

beforeEach(() => {
  vi.clearAllMocks()
  mockFindVideo.mockResolvedValue(VIDEO)
  mockSourceValid.mockResolvedValue(true)
  mockInsert.mockResolvedValue({ inserted: true })
})

describe('VideoPlayEventService.recordPlayEvent', () => {
  it('happy path → ok，insert 收到 trusted occurredAt + 解析 videoId；成功路径**不释放** marker（保留至 TTL）', async () => {
    const redis = makeRedis()
    const svc = new VideoPlayEventService(db, redis)
    const res = await svc.recordPlayEvent(baseInput())
    expect(res).toEqual({ ok: true })
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert.mock.calls[0][1]).toMatchObject({ videoId: 'video-uuid-1', idempotencyKey: 'a'.repeat(64) })
    expect(redis.del).not.toHaveBeenCalled() // 成功 → marker 保留至 TTL（不 DEL）
  })

  it('原子 marker：并发/近期同 key（SET NX→null）→ ok 且**不消耗限流 INCR**、不插入（Codex BLOCK-B 复审）', async () => {
    const redis = makeRedis({ set: vi.fn().mockResolvedValue(null) }) // null = 已存在（duplicate）
    const svc = new VideoPlayEventService(db, redis)
    const res = await svc.recordPlayEvent(baseInput())
    expect(res).toEqual({ ok: true })
    expect(redis.incr).not.toHaveBeenCalled() // 关键：并发/重试不烧限流计数（TOCTOU 关闭）
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('marker SET NX EX NX 语义：首次 acquired 才走限流+插入（参数核验）', async () => {
    const setSpy = vi.fn().mockResolvedValue('OK')
    const svc = new VideoPlayEventService(db, makeRedis({ set: setSpy }))
    await svc.recordPlayEvent(baseInput())
    // 原子 SET key '1' EX <ttl> NX
    expect(setSpy).toHaveBeenCalledWith(expect.stringContaining('pe:idem:'), '1', 'EX', 300, 'NX')
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  it('marker redis 故障 → fail-closed（rate_limited），不插入', async () => {
    const redis = makeRedis({ set: vi.fn().mockRejectedValue(new Error('redis down')) })
    const svc = new VideoPlayEventService(db, redis)
    expect(await svc.recordPlayEvent(baseInput())).toEqual({ ok: false, reason: 'rate_limited' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('限流拦截 → 释放 marker（del）允许后续合法重试，且不插入', async () => {
    const redis = makeRedis({ incr: vi.fn().mockResolvedValue(11) })
    const svc = new VideoPlayEventService(db, redis)
    expect(await svc.recordPlayEvent(baseInput())).toEqual({ ok: false, reason: 'rate_limited' })
    expect(redis.del).toHaveBeenCalledTimes(1)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('插入瞬态错误（非 23505）→ 释放 marker（del）+ 上抛（防 marker 残留丢事件）', async () => {
    mockInsert.mockRejectedValue(Object.assign(new Error('conn'), { code: '08006' }))
    const redis = makeRedis()
    const svc = new VideoPlayEventService(db, redis)
    await expect(svc.recordPlayEvent(baseInput())).rejects.toThrow()
    expect(redis.del).toHaveBeenCalledTimes(1)
  })

  it('occurredAt 缺失/非法 → 回退 ingested_at，且 occurred_at == ingested_at（单一基准，Codex MEDIUM-C）', async () => {
    const svc = new VideoPlayEventService(db, makeRedis())
    await svc.recordPlayEvent(baseInput({ occurredAt: 'not-a-date' }))
    const arg = mockInsert.mock.calls[0][1]
    expect(arg.occurredAt).toBe(arg.ingestedAt) // 回退值与显式 ingested_at 完全一致
  })

  describe('occurredAt clamp 精确边界（fake timers；−30min/+2min 整 ±1ms，Codex F）', () => {
    const FIXED = new Date('2026-06-25T12:00:00.000Z')
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(FIXED)
      mockFindVideo.mockResolvedValue(VIDEO)
      mockSourceValid.mockResolvedValue(true)
      mockInsert.mockResolvedValue({ inserted: true })
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    async function occurredAtFor(clientISO: string): Promise<string> {
      const svc = new VideoPlayEventService(db, makeRedis())
      await svc.recordPlayEvent(baseInput({ occurredAt: clientISO }))
      return mockInsert.mock.calls[0][1].occurredAt
    }

    it('过去 −30min 整（下界含）→ 信任 client', async () => {
      const t = new Date(FIXED.getTime() - 30 * 60 * 1000).toISOString()
      expect(await occurredAtFor(t)).toBe(t)
    })
    it('过去 −30min−1ms（超下界）→ 回退 ingested_at', async () => {
      const t = new Date(FIXED.getTime() - 30 * 60 * 1000 - 1).toISOString()
      expect(await occurredAtFor(t)).toBe(FIXED.toISOString())
    })
    it('未来 +2min 整（上界含）→ 信任 client', async () => {
      const t = new Date(FIXED.getTime() + 2 * 60 * 1000).toISOString()
      expect(await occurredAtFor(t)).toBe(t)
    })
    it('未来 +2min+1ms（超上界）→ 回退 ingested_at', async () => {
      const t = new Date(FIXED.getTime() + 2 * 60 * 1000 + 1).toISOString()
      expect(await occurredAtFor(t)).toBe(FIXED.toISOString())
    })
  })

  it('short_id 无公开视频 → not_found（不插入）', async () => {
    mockFindVideo.mockResolvedValue(null)
    const svc = new VideoPlayEventService(db, makeRedis())
    const res = await svc.recordPlayEvent(baseInput())
    expect(res).toEqual({ ok: false, reason: 'not_found' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('sourceId 非该 video 的 active 线路 → invalid_source（不插入）', async () => {
    mockSourceValid.mockResolvedValue(false)
    const svc = new VideoPlayEventService(db, makeRedis())
    const res = await svc.recordPlayEvent(baseInput({ sourceId: 'src-uuid-1' }))
    expect(res).toEqual({ ok: false, reason: 'invalid_source' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('无 sourceId → 跳过 source 校验', async () => {
    const svc = new VideoPlayEventService(db, makeRedis())
    await svc.recordPlayEvent(baseInput({ sourceId: null }))
    expect(mockSourceValid).not.toHaveBeenCalled()
  })

  it('双维限流命中（visitor 维超阈）→ rate_limited（不插入）', async () => {
    const redis = makeRedis({ incr: vi.fn().mockResolvedValue(11) }) // > VISITOR_MAX(10)
    const svc = new VideoPlayEventService(db, redis)
    const res = await svc.recordPlayEvent(baseInput())
    expect(res).toEqual({ ok: false, reason: 'rate_limited' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('限流 fail-closed：redis incr 抛错 → rate_limited（不放行刷量）', async () => {
    const redis = makeRedis({ incr: vi.fn().mockRejectedValue(new Error('redis down')) })
    const svc = new VideoPlayEventService(db, redis)
    const res = await svc.recordPlayEvent(baseInput())
    expect(res).toEqual({ ok: false, reason: 'rate_limited' })
  })

  it('occurredAt 非对称 clamp：未来 +10min 超窗 → 回退 ingested_at（非 client 值）', async () => {
    const svc = new VideoPlayEventService(db, makeRedis())
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await svc.recordPlayEvent(baseInput({ occurredAt: future }))
    const occurredAt = mockInsert.mock.calls[0][1].occurredAt
    expect(new Date(occurredAt).getTime()).toBeLessThan(new Date(future).getTime())
    // 回退值接近 now（ingested），远小于 future
    expect(Math.abs(new Date(occurredAt).getTime() - Date.now())).toBeLessThan(5000)
  })

  it('occurredAt 过去 −60min 超窗 → 回退 ingested_at', async () => {
    const svc = new VideoPlayEventService(db, makeRedis())
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    await svc.recordPlayEvent(baseInput({ occurredAt: past }))
    const occurredAt = mockInsert.mock.calls[0][1].occurredAt
    expect(new Date(occurredAt).getTime()).toBeGreaterThan(new Date(past).getTime())
  })

  it('occurredAt 窗内（−5min）→ 信任 client 值', async () => {
    const svc = new VideoPlayEventService(db, makeRedis())
    const within = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    await svc.recordPlayEvent(baseInput({ occurredAt: within }))
    const occurredAt = mockInsert.mock.calls[0][1].occurredAt
    expect(new Date(occurredAt).getTime()).toBeCloseTo(new Date(within).getTime(), -3)
  })

  it('幂等：insert ON CONFLICT 跳过（inserted:false）→ ok（不报错）', async () => {
    mockInsert.mockResolvedValue({ inserted: false })
    const svc = new VideoPlayEventService(db, makeRedis())
    expect(await svc.recordPlayEvent(baseInput())).toEqual({ ok: true })
  })

  it('幂等第二防线：23505 命中 session/video/episode 约束 → ok（不 500）', async () => {
    mockInsert.mockRejectedValue(
      Object.assign(new Error('dup'), {
        code: '23505',
        constraint: 'uq_video_play_events_session_video_episode',
      }),
    )
    const svc = new VideoPlayEventService(db, makeRedis())
    expect(await svc.recordPlayEvent(baseInput())).toEqual({ ok: true })
  })

  it('幂等收敛：23505 命中 idempotency_key 约束 → ok', async () => {
    mockInsert.mockRejectedValue(
      Object.assign(new Error('dup'), {
        code: '23505',
        constraint: 'uq_video_play_events_idempotency_key',
      }),
    )
    const svc = new VideoPlayEventService(db, makeRedis())
    expect(await svc.recordPlayEvent(baseInput())).toEqual({ ok: true })
  })

  it('23505 命中其它约束（如未来新约束）→ 上抛（不无差别吞，M1）', async () => {
    mockInsert.mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint: 'some_other_uq' }),
    )
    const svc = new VideoPlayEventService(db, makeRedis())
    await expect(svc.recordPlayEvent(baseInput())).rejects.toThrow()
  })

  it('非 23505 错误（如连接断）→ 上抛', async () => {
    mockInsert.mockRejectedValue(Object.assign(new Error('conn'), { code: '08006' }))
    const svc = new VideoPlayEventService(db, makeRedis())
    await expect(svc.recordPlayEvent(baseInput())).rejects.toThrow()
  })

  it('匿名 userId=null 透传至 insert（D-216-5，不查 users）', async () => {
    const svc = new VideoPlayEventService(db, makeRedis())
    await svc.recordPlayEvent(baseInput({ userId: null }))
    expect(mockInsert.mock.calls[0][1].userId).toBeNull()
  })

  it('登录 userId 透传至 insert', async () => {
    const svc = new VideoPlayEventService(db, makeRedis())
    await svc.recordPlayEvent(baseInput({ userId: 'user-uuid-9' }))
    expect(mockInsert.mock.calls[0][1].userId).toBe('user-uuid-9')
  })

  it('visitor 身份 null（A1 fail-safe）→ 回退 ephemeral hash + visitorIsEphemeral=true（不计 UV）', async () => {
    const svc = new VideoPlayEventService(db, makeRedis())
    await svc.recordPlayEvent(baseInput({ visitorHash: null, visitorIsEphemeral: false }))
    const arg = mockInsert.mock.calls[0][1]
    expect(arg.visitorHash).toMatch(/^[0-9a-f]{32}$/) // 回退 hash 非空
    expect(arg.visitorIsEphemeral).toBe(true)
  })

  it('ip/ua 仅以 hash 存储（不存原值，核心不变量⑤）', async () => {
    const svc = new VideoPlayEventService(db, makeRedis())
    await svc.recordPlayEvent(baseInput({ ip: '198.51.100.1', userAgent: 'SecretUA' }))
    const arg = mockInsert.mock.calls[0][1]
    expect(arg.ipHash).toMatch(/^[0-9a-f]{32}$/)
    expect(arg.ipHash).not.toContain('198.51.100.1')
    expect(arg.userAgentHash).not.toContain('SecretUA')
  })
})
