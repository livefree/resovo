/**
 * tests/unit/api/notification-emitter.test.ts —
 * ADR-193 D-193-2 / NTLG-P1-c-A NotificationEmitter fire-and-forget 单测
 *
 * 覆盖：emit 入参映射 insertNotification / scope 默认 broadcast / 显式 scope 透传 /
 *       payload JSON 序列化 / 返回 void 同步不抛 / insertNotification reject 被 .catch 吞错（fire-and-forget）
 */
import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { NotificationEmitter } from '@/api/services/NotificationEmitter'

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
})
