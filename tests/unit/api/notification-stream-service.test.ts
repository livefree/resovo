/**
 * tests/unit/api/notification-stream-service.test.ts —
 * ADR-196 D-196-3 / NTLG-P2-c-B-1 SSE 连接编排单测
 *
 * 覆盖（连接治理黄线 3）：init/ready → isAvailable / register 初始 unread 推送 /
 *   scope fan-out（broadcast 全推 + role/user 定向路由）/ unregister 出表 + 空时停心跳 /
 *   软上限 isAtCapacity / 心跳 ping / 写失败 → unregister 防泄漏 /
 *   Redis-down（connect 拒 / subscribe 拒）→ isAvailable=false 降级 / shutdown 关连接清表
 */
import { describe, it, expect, vi } from 'vitest'

// lib/redis import 时校验 REDIS_URL（测试未设）→ mock 避免 throw；subscriberFactory 注入接管 duplicate
vi.mock('@/api/lib/redis', () => ({
  redis: { duplicate: vi.fn() },
}))

import {
  NotificationStreamService,
  unreadFrame,
  PING_FRAME,
  type StreamSink,
} from '@/api/services/NotificationStreamService'
import { encodeNotificationSignal, NOTIFICATIONS_CHANGED_CHANNEL } from '@/api/lib/notification-pubsub'
import type Redis from 'ioredis'

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

/** 可驱动 fake Redis subscribe 连接（捕获 message/ready 等 handler 供测试触发）。 */
class FakeRedis {
  private readonly handlers = new Map<string, Array<(...args: unknown[]) => void>>()
  connect = vi.fn().mockResolvedValue(undefined)
  subscribe = vi.fn().mockResolvedValue(1)
  quit = vi.fn().mockResolvedValue('OK')
  disconnect = vi.fn()
  on(event: string, fn: (...args: unknown[]) => void): this {
    const list = this.handlers.get(event) ?? []
    list.push(fn)
    this.handlers.set(event, list)
    return this
  }
  fire(event: string, ...args: unknown[]): void {
    for (const fn of this.handlers.get(event) ?? []) fn(...args)
  }
}

/** 写入捕获 sink。 */
function makeSink(): StreamSink & { writes: string[] } {
  const writes: string[] = []
  return { writes, write: (chunk: string) => { writes.push(chunk) } }
}

interface Harness {
  service: NotificationStreamService
  sub: FakeRedis
  getUnreadCount: ReturnType<typeof vi.fn>
}

function makeHarness(opts?: { maxConnections?: number; heartbeatMs?: number }): Harness {
  const sub = new FakeRedis()
  // 默认 unread 计数按 userId 区分（a→3, 其它→7）
  const getUnreadCount = vi.fn(async (userId: string) => (userId === 'a' ? 3 : 7))
  const service = new NotificationStreamService({
    getUnreadCount,
    subscriberFactory: () => sub as unknown as Redis,
    ...(opts?.maxConnections != null && { maxConnections: opts.maxConnections }),
    ...(opts?.heartbeatMs != null && { heartbeatMs: opts.heartbeatMs }),
  })
  return { service, sub, getUnreadCount }
}

/** init + ready 驱动到 available（subscribe 成功）。 */
async function bringUp(h: Harness): Promise<void> {
  h.service.init()
  h.sub.fire('ready')
  await flush()
}

describe('NotificationStreamService — init / 可用性', () => {
  it('init + ready → subscribe 到 channel + isAvailable=true', async () => {
    const h = makeHarness()
    await bringUp(h)
    expect(h.sub.connect).toHaveBeenCalled()
    expect(h.sub.subscribe).toHaveBeenCalledWith(NOTIFICATIONS_CHANGED_CHANNEL)
    expect(h.service.isAvailable()).toBe(true)
  })

  it('connect 拒绝（Redis down）→ isAvailable=false（路由 503 降级）', async () => {
    const h = makeHarness()
    h.sub.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    h.service.init()
    await flush()
    expect(h.service.isAvailable()).toBe(false)
  })

  it('subscribe 拒绝 → isAvailable=false', async () => {
    const h = makeHarness()
    h.sub.subscribe.mockRejectedValueOnce(new Error('subscribe failed'))
    h.service.init()
    h.sub.fire('ready')
    await flush()
    expect(h.service.isAvailable()).toBe(false)
  })

  it('subscriber error / end → isAvailable=false', async () => {
    const h = makeHarness()
    await bringUp(h)
    expect(h.service.isAvailable()).toBe(true)
    h.sub.fire('error', new Error('reset'))
    expect(h.service.isAvailable()).toBe(false)
  })
})

describe('NotificationStreamService — register / 初始推送', () => {
  it('register → 入表 + 推一次初始 unread + connectionCount', async () => {
    const h = makeHarness()
    await bringUp(h)
    const sink = makeSink()
    h.service.register({ userId: 'a', role: 'admin', sink })
    await flush()
    expect(h.service.connectionCount()).toBe(1)
    expect(sink.writes).toEqual([unreadFrame(3)])
    expect(h.getUnreadCount).toHaveBeenCalledWith('a', 'admin')
  })
})

describe('NotificationStreamService — scope fan-out', () => {
  it('broadcast 信号 → 全部连接重算推送', async () => {
    const h = makeHarness()
    await bringUp(h)
    const sa = makeSink()
    const sb = makeSink()
    h.service.register({ userId: 'a', role: 'admin', sink: sa })
    h.service.register({ userId: 'b', role: 'moderator', sink: sb })
    await flush()
    sa.writes.length = 0
    sb.writes.length = 0
    h.sub.fire('message', NOTIFICATIONS_CHANGED_CHANNEL, encodeNotificationSignal({ scope: 'broadcast' }))
    await flush()
    expect(sa.writes).toEqual([unreadFrame(3)])
    expect(sb.writes).toEqual([unreadFrame(7)])
  })

  it('role:admin 信号 → 仅 admin 连接；user:b 信号 → 仅该用户连接', async () => {
    const h = makeHarness()
    await bringUp(h)
    const sa = makeSink()
    const sb = makeSink()
    h.service.register({ userId: 'a', role: 'admin', sink: sa })
    h.service.register({ userId: 'b', role: 'moderator', sink: sb })
    await flush()
    sa.writes.length = 0
    sb.writes.length = 0

    h.sub.fire('message', NOTIFICATIONS_CHANGED_CHANNEL, encodeNotificationSignal({ scope: 'role:admin' }))
    await flush()
    expect(sa.writes).toEqual([unreadFrame(3)])
    expect(sb.writes).toEqual([])

    sa.writes.length = 0
    h.sub.fire('message', NOTIFICATIONS_CHANGED_CHANNEL, encodeNotificationSignal({ scope: 'user:b' }))
    await flush()
    expect(sa.writes).toEqual([])
    expect(sb.writes).toEqual([unreadFrame(7)])
  })

  it('非法信号载荷 → 静默忽略（无推送）', async () => {
    const h = makeHarness()
    await bringUp(h)
    const sink = makeSink()
    h.service.register({ userId: 'a', role: 'admin', sink })
    await flush()
    sink.writes.length = 0
    h.sub.fire('message', NOTIFICATIONS_CHANGED_CHANNEL, 'not-json')
    await flush()
    expect(sink.writes).toEqual([])
  })

  it('未匹配 scope 信号 → 无推送', async () => {
    const h = makeHarness()
    await bringUp(h)
    const sink = makeSink()
    h.service.register({ userId: 'a', role: 'admin', sink })
    await flush()
    sink.writes.length = 0
    h.sub.fire('message', NOTIFICATIONS_CHANGED_CHANNEL, encodeNotificationSignal({ scope: 'user:zzz' }))
    await flush()
    expect(sink.writes).toEqual([])
  })
})

describe('NotificationStreamService — unregister / 上限', () => {
  it('unregister → 出表 + 后续信号不再推该连接', async () => {
    const h = makeHarness()
    await bringUp(h)
    const sa = makeSink()
    const sb = makeSink()
    const ca = h.service.register({ userId: 'a', role: 'admin', sink: sa })
    h.service.register({ userId: 'b', role: 'moderator', sink: sb })
    await flush()
    h.service.unregister(ca)
    expect(h.service.connectionCount()).toBe(1)
    sa.writes.length = 0
    sb.writes.length = 0
    h.sub.fire('message', NOTIFICATIONS_CHANGED_CHANNEL, encodeNotificationSignal({ scope: 'broadcast' }))
    await flush()
    expect(sa.writes).toEqual([])
    expect(sb.writes).toEqual([unreadFrame(7)])
  })

  it('unregister 幂等（重复调用安全）', async () => {
    const h = makeHarness()
    await bringUp(h)
    const c = h.service.register({ userId: 'a', role: 'admin', sink: makeSink() })
    h.service.unregister(c)
    expect(() => h.service.unregister(c)).not.toThrow()
    expect(h.service.connectionCount()).toBe(0)
  })

  it('isAtCapacity：达软上限返 true', async () => {
    const h = makeHarness({ maxConnections: 2 })
    await bringUp(h)
    expect(h.service.isAtCapacity()).toBe(false)
    h.service.register({ userId: 'a', role: 'admin', sink: makeSink() })
    expect(h.service.isAtCapacity()).toBe(false)
    h.service.register({ userId: 'b', role: 'moderator', sink: makeSink() })
    expect(h.service.isAtCapacity()).toBe(true)
  })
})

describe('NotificationStreamService — 写失败 / 心跳 / shutdown', () => {
  it('sink.write 抛错 → 自动 unregister 防泄漏', async () => {
    const h = makeHarness()
    await bringUp(h)
    const badSink: StreamSink = { write: () => { throw new Error('socket closed') } }
    h.service.register({ userId: 'a', role: 'admin', sink: badSink })
    await flush() // 初始 pushUnread → safeWrite 抛 → unregister
    expect(h.service.connectionCount()).toBe(0)
  })

  it('心跳定时写 PING_FRAME', async () => {
    const h = makeHarness({ heartbeatMs: 20 })
    await bringUp(h)
    const sink = makeSink()
    h.service.register({ userId: 'a', role: 'admin', sink })
    await flush()
    sink.writes.length = 0
    await new Promise((r) => setTimeout(r, 60)) // ≥2 个心跳周期
    expect(sink.writes.filter((w: string) => w === PING_FRAME).length).toBeGreaterThanOrEqual(1)
    await h.service.shutdown()
  })

  it('shutdown → quit 连接 + 清表 + isAvailable=false', async () => {
    const h = makeHarness()
    await bringUp(h)
    h.service.register({ userId: 'a', role: 'admin', sink: makeSink() })
    await flush()
    await h.service.shutdown()
    expect(h.sub.quit).toHaveBeenCalled()
    expect(h.service.connectionCount()).toBe(0)
    expect(h.service.isAvailable()).toBe(false)
  })
})
