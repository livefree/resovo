/**
 * logger-client.test.ts — INFRA-10 浏览器 client logger 行为测试
 *
 * 守门 C 三输入的机械化覆盖（jsdom 模拟 Chrome devtools 三种触发路径）：
 *   ① window 'error' (synchronous throw)
 *   ② 'unhandledrejection' (uncaught Promise.reject)
 *   ③ console.error monkey-patch (dev only)
 *
 * 真实 Chrome devtools 验证留作开发者最后一英里手动测试（changelog 记录步骤）。
 *
 * 实施备注：
 * - jsdom Blob 不实现 .text()，所有断言走 fetch keepalive 路径（sendBeacon mock 返回 false）
 * - jsdom window 在 it 间共享，vi.resetModules() 不能移除已注册 window listener；
 *   故守门 C 三输入合并为单 it 串行验证，避免 cross-it 状态污染
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

interface FetchCall { url: string; body: string }

function setupSendBeaconReturnsFalse(): void {
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: () => false,
  })
}

function setupFetchMock(): FetchCall[] {
  const calls: FetchCall[] = []
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? '') })
    return new Response(null, { status: 200 })
  }) as unknown as typeof fetch
  return calls
}

function parseLastEntry(calls: FetchCall[]): { level: string; msg: string; ctx?: Record<string, unknown> } {
  const last = calls[calls.length - 1]
  const payload = JSON.parse(last.body) as {
    entries: Array<{ level: string; msg: string; ctx?: Record<string, unknown> }>
  }
  return payload.entries[0]
}

describe('clientLogger.pushEntry & flush', () => {
  let fetchCalls: FetchCall[]

  beforeEach(() => {
    vi.resetModules()
    setupSendBeaconReturnsFalse()
    fetchCalls = setupFetchMock()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('error level triggers immediate flush', async () => {
    const { clientLogger } = await import('@/lib/logger.client')
    clientLogger.error('boom', { source: 'unit-test' })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fetchCalls.length).toBe(1)
    expect(fetchCalls[0].url).toContain('/v1/internal/client-log')
    const entry = parseLastEntry(fetchCalls)
    expect(entry.level).toBe('error')
    expect(entry.msg).toBe('boom')
    expect(entry.ctx?.source).toBe('unit-test')
  })

  it('info level buffers and flushes after 2s timeout', async () => {
    vi.useFakeTimers()
    const { clientLogger } = await import('@/lib/logger.client')
    clientLogger.info('msg-1')
    clientLogger.info('msg-2')
    expect(fetchCalls.length).toBe(0)
    await vi.advanceTimersByTimeAsync(2100)
    vi.useRealTimers()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fetchCalls.length).toBe(1)
    const payload = JSON.parse(fetchCalls[0].body) as { entries: unknown[] }
    expect(payload.entries).toHaveLength(2)
  })

  it('sendBeacon attempted first, fetch is fallback', async () => {
    let beaconAttempts = 0
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: () => { beaconAttempts++; return false },
    })
    const { clientLogger } = await import('@/lib/logger.client')
    clientLogger.error('test')
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(beaconAttempts).toBe(1)
    expect(fetchCalls.length).toBe(1)
  })

  // INFRA-16 F1: 默认 ENDPOINT 必须用绝对 URL 指向 API 端口（NEXT_PUBLIC_API_URL fallback）
  // 防止真实浏览器路径退回到相对路径打到 web-next 自身（INFRA-10 P1 真实 bug）
  it('default ENDPOINT uses absolute URL with NEXT_PUBLIC_API_URL fallback', async () => {
    const { clientLogger } = await import('@/lib/logger.client')
    clientLogger.error('endpoint-test')
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fetchCalls.length).toBe(1)
    // 默认 fallback 是 http://localhost:4000/v1/internal/client-log
    expect(fetchCalls[0].url).toBe('http://localhost:4000/v1/internal/client-log')
    // 显式断言：非相对路径（不会打到 web-next 自身）
    expect(fetchCalls[0].url.startsWith('http')).toBe(true)
    expect(fetchCalls[0].url).not.toBe('/v1/internal/client-log')
  })
})

// 守门 C 三输入：合并为单 it 串行验证（jsdom window 在 it 间共享）
describe('installGlobalHooks — 守门 C 三输入（串行）', () => {
  it('① window error / ② unhandledrejection / ③ console.error 全捕获 + 幂等性', async () => {
    setupSendBeaconReturnsFalse()
    const fetchCalls = setupFetchMock()

    const { installGlobalHooks } = await import('@/lib/logger.client')
    installGlobalHooks()
    installGlobalHooks()  // 第二次调用应被 hooksInstalled 守卫拦截

    // ── ① 同步异常 → window 'error' event ──
    window.dispatchEvent(new ErrorEvent('error', {
      message: 'sync throw test',
      filename: 'test.js',
      lineno: 42,
      colno: 7,
      error: new Error('sync throw test'),
    }))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fetchCalls.length).toBe(1)
    {
      const entry = parseLastEntry(fetchCalls)
      expect(entry.level).toBe('error')
      expect(entry.msg).toBe('sync throw test')
      expect(entry.ctx?.source).toBe('window.onerror')
      expect(entry.ctx?.lineno).toBe(42)
    }

    // ── ② 未 catch Promise rejection → 'unhandledrejection' event ──
    const rejEvent = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(rejEvent, 'reason', { value: new Error('promise reject test') })
    window.dispatchEvent(rejEvent)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fetchCalls.length).toBe(2)
    {
      const entry = parseLastEntry(fetchCalls)
      expect(entry.level).toBe('error')
      expect(entry.msg).toBe('promise reject test')
      expect(entry.ctx?.source).toBe('unhandledrejection')
    }

    // ── ③ dev mode: console.error monkey-patch ──
    // eslint-disable-next-line no-console
    console.error('console error test', 42)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fetchCalls.length).toBe(3)
    {
      const entry = parseLastEntry(fetchCalls)
      expect(entry.level).toBe('error')
      expect(entry.msg).toContain('console error test')
      expect(entry.ctx?.source).toBe('console.error')
    }

    // ── 幂等性：再触发一次 ErrorEvent，因首次幂等保护，listener 仅 1 个，单次 flush 仅 1 entry ──
    window.dispatchEvent(new ErrorEvent('error', {
      message: 'idem test',
      error: new Error('idem test'),
    }))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fetchCalls.length).toBe(4)
    const lastPayload = JSON.parse(fetchCalls[3].body) as { entries: unknown[] }
    expect(lastPayload.entries).toHaveLength(1)
  })
})
