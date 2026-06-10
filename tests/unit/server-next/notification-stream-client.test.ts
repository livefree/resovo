/**
 * notification-stream-client.test.ts — SSE fetch-stream 客户端单测（ADR-196 D-196-1/6 / NTLG-P2-c-B-2）
 *
 * 覆盖：parseSSEEvent（event/data 多行 + `:` 心跳跳过 + 无 data → null）/
 *       parseUnreadCount（{count} 守卫 + 非法/缺失/非数 → null）/
 *       connectNotificationStream（happy-path unread → onUnread + state open / Bearer header 注入 /
 *       无 token → 无 Authorization / 非 200 退避重连 / close() 停循环）
 */
import { describe, it, expect, vi } from 'vitest'

// `@/` 别名对 tests/unit/server-next/ 解析到 web-next → 用相对路径引 server-next（参 messages.test.ts）。
// node env 无 localStorage → mock authStore（persist）+ api-client（避真链副作用）；connect 测试注入 deps。
vi.mock('../../../apps/server-next/src/lib/api-client', () => ({ API_BASE_URL: 'http://test/v1' }))
vi.mock('../../../apps/server-next/src/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: null }) },
}))

import {
  parseSSEEvent,
  parseUnreadCount,
  connectNotificationStream,
} from '../../../apps/server-next/src/lib/notification-stream-client'

/** 长连接流：enqueue 完块后保持开放（pull 挂起，模拟服务端不主动关）。 */
function openStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(enc.encode(chunks[i++]))
        return undefined
      }
      return new Promise<void>(() => {}) // 永不 resolve → 流保持开放
    },
  })
}

describe('parseSSEEvent', () => {
  it('event + data → {event, data}', () => {
    expect(parseSSEEvent('event: unread\ndata: {"count":3}')).toEqual({ event: 'unread', data: '{"count":3}' })
  })

  it('仅 data → event 缺省 message', () => {
    expect(parseSSEEvent('data: hello')).toEqual({ event: 'message', data: 'hello' })
  })

  it('心跳 `: ping` → null（无 data 行）', () => {
    expect(parseSSEEvent(': ping')).toBeNull()
  })

  it('多 data 行 → join 换行', () => {
    expect(parseSSEEvent('event: x\ndata: a\ndata: b')).toEqual({ event: 'x', data: 'a\nb' })
  })

  it('空块 → null', () => {
    expect(parseSSEEvent('')).toBeNull()
  })
})

describe('parseUnreadCount', () => {
  it('{"count":5} → 5；{"count":0} → 0（边界）', () => {
    expect(parseUnreadCount('{"count":5}')).toBe(5)
    expect(parseUnreadCount('{"count":0}')).toBe(0)
  })

  it('非法 JSON / 缺 count / 非数 count → null', () => {
    expect(parseUnreadCount('not-json')).toBeNull()
    expect(parseUnreadCount('{"foo":1}')).toBeNull()
    expect(parseUnreadCount('{"count":"5"}')).toBeNull()
    expect(parseUnreadCount('null')).toBeNull()
  })
})

describe('connectNotificationStream', () => {
  it('happy-path：unread 帧 → onUnread(count) 逐个 + 心跳跳过 + state open', async () => {
    const onUnread = vi.fn()
    const states: string[] = []
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: openStream(['event: unread\ndata: {"count":3}\n\n', ': ping\n\n', 'event: unread\ndata: {"count":5}\n\n']),
    })
    const ctrl = connectNotificationStream(
      { onUnread, onStateChange: (s: string) => states.push(s) },
      { fetchImpl, getToken: () => 'tok', baseUrl: 'http://api/v1', backoffBaseMs: 1 },
    )
    await vi.waitFor(() => expect(onUnread).toHaveBeenCalledTimes(2))
    ctrl.close()
    expect(onUnread).toHaveBeenNthCalledWith(1, 3)
    expect(onUnread).toHaveBeenNthCalledWith(2, 5)
    expect(states).toContain('open')
  })

  it('携带 Bearer header + 正确 URL（token 注入）', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, body: openStream([]) })
    const ctrl = connectNotificationStream(
      { onUnread: vi.fn() },
      { fetchImpl, getToken: () => 'mytoken', baseUrl: 'http://api/v1' },
    )
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('http://api/v1/admin/notifications/stream')
    expect(init.headers).toEqual({ Authorization: 'Bearer mytoken' })
    ctrl.close()
  })

  it('无 token → 不带 Authorization header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, body: openStream([]) })
    const ctrl = connectNotificationStream(
      { onUnread: vi.fn() },
      { fetchImpl, getToken: () => null, baseUrl: 'http://api/v1' },
    )
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    const [, init] = fetchImpl.mock.calls[0]! as [string, RequestInit]
    expect(init.headers).toEqual({})
    ctrl.close()
  })

  it('非 200（503 降级）→ 退避重连（多次 fetch）+ state closed', async () => {
    const states: string[] = []
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, body: null })
    const ctrl = connectNotificationStream(
      { onUnread: vi.fn(), onStateChange: (s: string) => states.push(s) },
      { fetchImpl, getToken: () => null, baseUrl: 'http://api/v1', backoffBaseMs: 1 },
    )
    await vi.waitFor(() => expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2))
    ctrl.close()
    expect(states).toContain('closed')
  })

  it('close() 停止重连循环（之后不再 fetch）', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, body: null })
    const ctrl = connectNotificationStream(
      { onUnread: vi.fn() },
      { fetchImpl, getToken: () => null, baseUrl: 'http://api/v1', backoffBaseMs: 10_000 },
    )
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    ctrl.close()
    const callsAfterClose = fetchImpl.mock.calls.length
    await new Promise((r) => setTimeout(r, 40))
    expect(fetchImpl.mock.calls.length).toBe(callsAfterClose)
  })
})
