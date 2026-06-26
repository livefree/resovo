/**
 * play-stats.test.ts — STATS-03-B（ADR-216 / SEQ-20260624-02）
 * Qualified Play 上报 helper 纯函数 + detector + 确定性 key + 上报封装边界。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  QUALIFIED_PLAY_MIN_SECONDS,
  SHORT_MEDIA_MAX_SECONDS,
  isQualifiedPlay,
  createQualifiedPlayDetector,
  buildPlaySessionId,
  buildPlayEventIdempotencyKey,
  reportVideoPlayEvent,
  type PlayEventApiClient,
} from '../../../apps/web-next/src/lib/play-stats'

describe('isQualifiedPlay（基于真实观看时长 watchSeconds）', () => {
  it('长媒体 watchSeconds≥20 → qualified', () => {
    expect(isQualifiedPlay({ watchSeconds: 20, duration: 3600 })).toBe(true)
    expect(isQualifiedPlay({ watchSeconds: 19.9, duration: 3600 })).toBe(false)
  })

  it('短媒体（duration<25）按 0.8×duration 比例', () => {
    // duration=10 → 阈值 8s
    expect(isQualifiedPlay({ watchSeconds: 8, duration: 10 })).toBe(true)
    expect(isQualifiedPlay({ watchSeconds: 7.9, duration: 10 })).toBe(false)
  })

  it('duration=null（未知时长）只看 20s 长媒体阈值', () => {
    expect(isQualifiedPlay({ watchSeconds: 21, duration: null })).toBe(true)
    expect(isQualifiedPlay({ watchSeconds: 5, duration: null })).toBe(false)
  })

  it('阈值常量与 ADR-216 一致', () => {
    expect(QUALIFIED_PLAY_MIN_SECONDS).toBe(20)
    expect(SHORT_MEDIA_MAX_SECONDS).toBe(25)
  })
})

describe('createQualifiedPlayDetector（真实观看时长累加器，排除 seek/续播跳跃）', () => {
  it('正常逐 tick 累加真实增量', () => {
    const d = createQualifiedPlayDetector()
    expect(d.track(0, 3600).watchSeconds).toBe(0)
    expect(d.track(1, 3600).watchSeconds).toBe(1)
    expect(d.track(2, 3600).watchSeconds).toBe(2)
  })

  it('seek 大跳跃（delta>maxGap）不计入观看时长', () => {
    const d = createQualifiedPlayDetector(2)
    d.track(0, 3600)
    d.track(1, 3600) // watchSeconds=1
    const afterSeek = d.track(500, 3600) // 跳跃 +499 不计
    expect(afterSeek.watchSeconds).toBe(1)
    const next = d.track(501, 3600) // 续播 +1 计入
    expect(next.watchSeconds).toBe(2)
  })

  it('断点续播：从 currentTime=600 起播，不把起点位置当观看时长', () => {
    const d = createQualifiedPlayDetector(2)
    // 首 tick 在 600（续播起点）→ lastTime 初始化、不累加
    expect(d.track(600, 3600).watchSeconds).toBe(0)
    expect(d.track(601, 3600).watchSeconds).toBe(1)
  })

  it('累计跨 20s 阈值时 qualified 转 true', () => {
    const d = createQualifiedPlayDetector(2)
    let last = { watchSeconds: 0, qualified: false }
    for (let t = 0; t <= 25; t += 1) last = d.track(t, 3600)
    expect(last.watchSeconds).toBeGreaterThanOrEqual(20)
    expect(last.qualified).toBe(true)
  })

  it('reset 清零重新累计', () => {
    const d = createQualifiedPlayDetector()
    d.track(0, 100)
    d.track(5, 100)
    d.reset()
    expect(d.track(0, 100).watchSeconds).toBe(0)
  })
})

describe('buildPlaySessionId', () => {
  it('生成 hex 串且长度命中端点 zod 16–32', () => {
    const id = buildPlaySessionId()
    expect(id).toMatch(/^[0-9a-f]+$/)
    expect(id.length).toBeGreaterThanOrEqual(16)
    expect(id.length).toBeLessThanOrEqual(32)
  })

  it('多次生成不重复', () => {
    const a = buildPlaySessionId()
    const b = buildPlaySessionId()
    expect(a).not.toBe(b)
  })
})

describe('buildPlayEventIdempotencyKey（D-216-8 确定性 sha256）', () => {
  it('同输入同值（确定性，retry 安全）', async () => {
    const input = { playSessionId: 'sess-abc-123456', shortId: 'AbCdEf12', episodeNumber: 3 }
    const k1 = await buildPlayEventIdempotencyKey(input)
    const k2 = await buildPlayEventIdempotencyKey(input)
    expect(k1).toBe(k2)
    expect(k1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('episodeNumber null 归一为 0（与后端 COALESCE 一致）', async () => {
    const withNull = await buildPlayEventIdempotencyKey({ playSessionId: 's0123456789abcd', shortId: 'AbCdEf12', episodeNumber: null })
    const withZero = await buildPlayEventIdempotencyKey({ playSessionId: 's0123456789abcd', shortId: 'AbCdEf12', episodeNumber: 0 })
    expect(withNull).toBe(withZero)
  })

  it('不同 session/short/episode → 不同 key', async () => {
    const base = { playSessionId: 's0123456789abcd', shortId: 'AbCdEf12', episodeNumber: 1 }
    const k = await buildPlayEventIdempotencyKey(base)
    expect(await buildPlayEventIdempotencyKey({ ...base, episodeNumber: 2 })).not.toBe(k)
    expect(await buildPlayEventIdempotencyKey({ ...base, shortId: 'ZzZzZz99' })).not.toBe(k)
    expect(await buildPlayEventIdempotencyKey({ ...base, playSessionId: 'other-session-99' })).not.toBe(k)
  })
})

describe('reportVideoPlayEvent（fire-and-forget 上报封装）', () => {
  function mockClient(): { client: PlayEventApiClient; post: ReturnType<typeof vi.fn> } {
    const post = vi.fn().mockResolvedValue(undefined)
    return { client: { post }, post }
  }

  it('POST 到正确端点 + 必填字段 + watchSeconds 取整', async () => {
    const { client, post } = mockClient()
    await reportVideoPlayEvent(client, {
      shortId: 'AbCdEf12',
      sourceId: 'src-uuid',
      episodeNumber: 2,
      playSessionId: 'sess-abc-123456',
      watchSeconds: 23.8,
      durationSeconds: 3600.5,
      locale: 'zh-CN',
    })
    expect(post).toHaveBeenCalledTimes(1)
    const [path, body] = post.mock.calls[0]
    expect(path).toBe('/videos/AbCdEf12/play-events')
    expect(body).toMatchObject({
      playSessionId: 'sess-abc-123456',
      episodeNumber: 2,
      sourceId: 'src-uuid',
      watchSeconds: 23, // floor
      durationSeconds: 3600,
      locale: 'zh-CN',
    })
    expect(body.idempotencyKey).toMatch(/^[0-9a-f]{64}$/)
    expect(typeof body.occurredAt).toBe('string')
    // referrerPath v1 暂不采集
    expect(body).not.toHaveProperty('referrerPath')
  })

  it('可选字段缺省时省略（sourceId/durationSeconds/locale）', async () => {
    const { client, post } = mockClient()
    await reportVideoPlayEvent(client, {
      shortId: 'AbCdEf12',
      episodeNumber: 1,
      playSessionId: 'sess-abc-123456',
      watchSeconds: 20,
    })
    const [, body] = post.mock.calls[0]
    expect(body).not.toHaveProperty('sourceId')
    expect(body).not.toHaveProperty('durationSeconds')
    expect(body).not.toHaveProperty('locale')
  })

  it('post 抛错被吞掉，不向上传播（不影响播放）', async () => {
    const post = vi.fn().mockRejectedValue(new Error('network down'))
    await expect(reportVideoPlayEvent({ post }, {
      shortId: 'AbCdEf12',
      episodeNumber: 1,
      playSessionId: 'sess-abc-123456',
      watchSeconds: 20,
    })).resolves.toBeUndefined()
  })
})
