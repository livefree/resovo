/**
 * tests/unit/api/notification-emitter.test.ts —
 * ADR-193 D-193-2 / NTLG-P1-c-A NotificationEmitter fire-and-forget 单测
 *
 * 覆盖：emit 入参映射 insertNotification / scope 默认 broadcast / 显式 scope 透传 /
 *       payload JSON 序列化 / 返回 void 同步不抛 / insertNotification reject 被 .catch 吞错（fire-and-forget）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'

// publish 侧用主 redis（lib/redis import 校验 REDIS_URL）→ mock pubsub 隔离 redis + 断言 publish 接线
vi.mock('@/api/lib/notification-pubsub', () => ({
  publishNotificationChanged: vi.fn(),
}))

import { NotificationEmitter } from '@/api/services/NotificationEmitter'
import { publishNotificationChanged } from '@/api/lib/notification-pubsub'

const mockedPublish = vi.mocked(publishNotificationChanged)

// insertNotification SQL VALUES 参数索引（db/queries/notifications.ts）
const P = {
  type: 0, level: 1, title: 2, body: 3, payload: 4, href: 5,
  sourceKind: 6, sourceRef: 7, dedupKey: 8, scope: 9, expiresAt: 10,
} as const

function makeEmitter(queryImpl: ReturnType<typeof vi.fn>): NotificationEmitter {
  const db = { query: queryImpl } as unknown as Pool
  return new NotificationEmitter(db)
}

// emit fire-and-forget（insertNotification 异步），flush 微任务 + 宏任务后再断言
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe('NotificationEmitter.emit — fire-and-forget (ADR-193 D-193-2)', () => {
  it('emit → insertNotification 入参映射 + scope 默认 broadcast', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: '1' }] })
    makeEmitter(queryMock).emit({
      type: 'crawler.run.completed', level: 'info', title: '采集完成', sourceKind: 'crawler',
    })
    await flush()
    expect(queryMock).toHaveBeenCalledTimes(1)
    const params = queryMock.mock.calls[0]![1] as unknown[]
    expect(params[P.type]).toBe('crawler.run.completed')
    expect(params[P.level]).toBe('info')
    expect(params[P.title]).toBe('采集完成')
    expect(params[P.sourceKind]).toBe('crawler')
    expect(params[P.scope]).toBe('broadcast')
  })

  it('emit → 显式 scope 透传（不被默认覆盖）+ payload JSON 序列化', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: '2' }] })
    makeEmitter(queryMock).emit({
      type: 'x', level: 'warn', title: 'T', sourceKind: 'system',
      scope: 'role:admin', payload: { metrics: [{ key: 'k', value: 1 }] },
    })
    await flush()
    const params = queryMock.mock.calls[0]![1] as unknown[]
    expect(params[P.scope]).toBe('role:admin')
    expect(params[P.payload]).toBe(JSON.stringify({ metrics: [{ key: 'k', value: 1 }] }))
  })

  it('emit → 返回 void（同步，不抛错）', () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: '3' }] })
    const r = makeEmitter(queryMock).emit({ type: 'x', level: 'info', title: 'T', sourceKind: 'system' })
    expect(r).toBeUndefined()
  })

  it('emit fire-and-forget：insertNotification reject → 不抛错（吞错，主流程不受影响）', async () => {
    const queryMock = vi.fn().mockRejectedValue(new Error('DB down'))
    const emitter = makeEmitter(queryMock)
    expect(() => emitter.emit({ type: 'x', level: 'danger', title: 'T', sourceKind: 'system' })).not.toThrow()
    await flush()
    expect(queryMock).toHaveBeenCalled()
  })

  it('emit 省略 expiresAt → 按 type TTL 策略注入 expires_at（admin_action 90d，P2-d-B 激活 purge）', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: '4' }] })
    const before = Date.now()
    makeEmitter(queryMock).emit({ type: 'video.merge', level: 'info', title: 'T', sourceKind: 'admin_action' })
    await flush()
    const params = queryMock.mock.calls[0]![1] as unknown[]
    const exp = Date.parse(params[P.expiresAt] as string)
    const d90 = 90 * 24 * 3600_000
    expect(exp).toBeGreaterThanOrEqual(before + d90 - 5000)
    expect(exp).toBeLessThanOrEqual(Date.now() + d90 + 5000)
  })

  it('emit 省略 expiresAt + crawler type → 默认 30d', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: '5' }] })
    const before = Date.now()
    makeEmitter(queryMock).emit({ type: 'crawler.run.completed', level: 'info', title: 'T', sourceKind: 'crawler' })
    await flush()
    const params = queryMock.mock.calls[0]![1] as unknown[]
    const exp = Date.parse(params[P.expiresAt] as string)
    const d30 = 30 * 24 * 3600_000
    expect(exp).toBeGreaterThanOrEqual(before + d30 - 5000)
    expect(exp).toBeLessThanOrEqual(Date.now() + d30 + 5000)
  })

  it('emit 显式 expiresAt → 优先于策略（不被覆盖）', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: '6' }] })
    const explicit = '2099-01-01T00:00:00.000Z'
    makeEmitter(queryMock).emit({ type: 'video.merge', level: 'info', title: 'T', sourceKind: 'admin_action', expiresAt: explicit })
    await flush()
    const params = queryMock.mock.calls[0]![1] as unknown[]
    expect(params[P.expiresAt]).toBe(explicit)
  })
})

describe('NotificationEmitter.emit — SSE publish 接线 (ADR-196 D-196-2 / NTLG-P2-c-B-1)', () => {
  beforeEach(() => { mockedPublish.mockReset() })

  it('写库成功 → publishNotificationChanged(scope=broadcast 默认)', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: '1' }] })
    makeEmitter(queryMock).emit({ type: 'x', level: 'info', title: 'T', sourceKind: 'system' })
    await flush()
    expect(mockedPublish).toHaveBeenCalledTimes(1)
    expect(mockedPublish).toHaveBeenCalledWith('broadcast')
  })

  it('写库成功 → publish 用显式 scope（与入库 scope 同源）', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: '2' }] })
    makeEmitter(queryMock).emit({ type: 'x', level: 'warn', title: 'T', sourceKind: 'system', scope: 'role:admin' })
    await flush()
    expect(mockedPublish).toHaveBeenCalledWith('role:admin')
  })

  it('写库失败 → 不 publish（.then 链不执行，丢信号靠轮询 fallback）', async () => {
    const queryMock = vi.fn().mockRejectedValue(new Error('DB down'))
    makeEmitter(queryMock).emit({ type: 'x', level: 'danger', title: 'T', sourceKind: 'system' })
    await flush()
    expect(mockedPublish).not.toHaveBeenCalled()
  })
})
