/**
 * tests/unit/api/notification-pubsub.test.ts —
 * ADR-196 D-196-2 / NTLG-P2-c-B-1 通知变更 Redis pub/sub 信号封装单测
 *
 * 覆盖：信号 encode/decode 往返 + 非法载荷防御 → null /
 *       publishNotificationChanged 用主 redis publish channel + 编码 scope /
 *       publish reject → 吞错不抛（fire-and-forget，丢信号靠轮询 fallback D-196-3/6）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// lib/redis 在 import 时校验 REDIS_URL（测试环境未设）→ 必须 mock 避免 throw（既有范式）
vi.mock('@/api/lib/redis', () => ({
  redis: { publish: vi.fn().mockResolvedValue(1) },
}))

import { redis } from '@/api/lib/redis'
import {
  NOTIFICATIONS_CHANGED_CHANNEL,
  encodeNotificationSignal,
  decodeNotificationSignal,
  publishNotificationChanged,
} from '@/api/lib/notification-pubsub'

const mockedPublish = vi.mocked(redis.publish)
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
  mockedPublish.mockReset().mockResolvedValue(1)
})

describe('notification-pubsub — 信号 codec', () => {
  it('encode → decode 往返保 scope', () => {
    const enc = encodeNotificationSignal({ scope: 'role:admin' })
    expect(decodeNotificationSignal(enc)).toEqual({ scope: 'role:admin' })
  })

  it('decode 非 JSON → null', () => {
    expect(decodeNotificationSignal('not-json')).toBeNull()
  })

  it('decode 非对象 / 缺 scope / 空 scope → null', () => {
    expect(decodeNotificationSignal('123')).toBeNull()
    expect(decodeNotificationSignal('null')).toBeNull()
    expect(decodeNotificationSignal('{"foo":1}')).toBeNull()
    expect(decodeNotificationSignal('{"scope":""}')).toBeNull()
    expect(decodeNotificationSignal('{"scope":42}')).toBeNull()
  })
})

describe('notification-pubsub — publishNotificationChanged', () => {
  it('publish 到 notifications:changed channel + 编码 {scope}', async () => {
    publishNotificationChanged('broadcast')
    await flush()
    expect(mockedPublish).toHaveBeenCalledTimes(1)
    const [channel, payload] = mockedPublish.mock.calls[0]!
    expect(channel).toBe(NOTIFICATIONS_CHANGED_CHANNEL)
    expect(decodeNotificationSignal(payload as string)).toEqual({ scope: 'broadcast' })
  })

  it('返回 void（同步不抛）', () => {
    expect(publishNotificationChanged('user:1')).toBeUndefined()
  })

  it('publish reject → 吞错不抛（fire-and-forget）', async () => {
    mockedPublish.mockRejectedValueOnce(new Error('Redis down'))
    expect(() => publishNotificationChanged('broadcast')).not.toThrow()
    await flush()
    expect(mockedPublish).toHaveBeenCalled()
  })
})
