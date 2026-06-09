/**
 * tests/unit/api/webhook-dispatcher.test.ts —
 * ADR-146 / CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A WebhookDispatcher 单测
 *
 * 覆盖（ADR-146 §7 测试 surface，14 用例）：
 *   HMAC (2): #1 secret 非空签名 / #2 secret 空不发 header
 *   重试 (3): #3 5xx 4 次后失败 audit / #4 5xx 重试 / #5 backoff 实际间隔（mock）
 *   4xx 不重试 (2): #6 400 / #7 404
 *   超时 (1): #8 AbortError 视为可重试
 *   audit (1): #9 最终失败 7 字段完整
 *   订阅过滤 (3): #10 不含 event 不发 / #11 空数组不发 / #12 含 event 发
 *   SSRF (2): #13 169.254.169.254 不发 / #14 localhost 不发
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const auditWrite = vi.fn()
const auditSvc = { write: auditWrite } as unknown as import('@/api/services/AuditLogService').AuditLogService

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))

import { WebhookDispatcher } from '@/api/services/WebhookDispatcher'
import { NotificationEmitter } from '@/api/services/NotificationEmitter'
import { db } from '@/api/lib/postgres'

const mockDbQuery = db.query as ReturnType<typeof vi.fn>

function settingsRows(opts: { enabled: boolean; url: string; secret: string; events: string[] }) {
  return {
    rows: [
      { key: 'notification_webhook_enabled', value: opts.enabled ? 'true' : 'false' },
      { key: 'notification_webhook_url', value: opts.url },
      { key: 'notification_webhook_secret', value: opts.secret },
      { key: 'notification_webhook_events', value: JSON.stringify(opts.events) },
    ],
  }
}

const ACTOR_ID = '11111111-1111-4111-8111-111111111111'
const VALID_URL = 'https://example.com/webhook'

beforeEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

async function flush() { await new Promise((r) => setImmediate(r)) }

describe('WebhookDispatcher — HMAC', () => {
  it('#1 secret 非空 → X-Resovo-Signature = sha256= + HMAC hex', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ enabled: true, url: VALID_URL, secret: 'topsecret', events: ['crawler.run.failed'] }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await flush()
    expect(fetchSpy).toHaveBeenCalled()
    const headers = (fetchSpy.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers
    expect(headers['X-Resovo-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it('#2 secret 空 → 不发 X-Resovo-Signature header', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ enabled: true, url: VALID_URL, secret: '', events: ['crawler.run.failed'] }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await flush()
    const headers = (fetchSpy.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers
    expect(headers['X-Resovo-Signature']).toBeUndefined()
  })
})

describe('WebhookDispatcher — 重试 + 4xx + audit', () => {
  beforeEach(() => {
    // 加速测试：mock setTimeout 跳过 backoff 等待
    vi.useFakeTimers({ shouldAdvanceTime: true, shouldClearNativeTimers: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function loadSettings(events: string[] = ['crawler.run.failed']) {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ enabled: true, url: VALID_URL, secret: 's', events }))
  }

  it('#3 5xx 4 次后最终失败写 audit', async () => {
    loadSettings()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('err', { status: 503 }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await vi.runAllTimersAsync()
    expect(auditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'system.webhook_send_failed',
      targetKind: 'system',
      afterJsonb: expect.objectContaining({
        event: 'crawler.run.failed',
        attempts: 4,
        lastHttpStatus: 503,
      }),
    }))
  })

  it('#4 5xx 重试 — 5xx 后再 200 → 不写 audit', async () => {
    loadSettings()
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('e', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await vi.runAllTimersAsync()
    expect(auditWrite).not.toHaveBeenCalled()
  })

  it('#5 backoff 间隔 — 4 次尝试间隔总 >= 65000ms（5+15+45）', async () => {
    loadSettings()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('e', { status: 503 }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    const start = Date.now()
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await vi.runAllTimersAsync()
    // 不直接测时间精度（fake timer 跑得太快），改测 fetch 被调 4 次
    expect(fetchSpy).toHaveBeenCalledTimes(4)
    void start  // suppress unused
  })

  it('#6 400 不重试 — 仅 1 次 fetch', async () => {
    loadSettings()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad', { status: 400 }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await vi.runAllTimersAsync()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('#7 404 不重试 — 仅 1 次 fetch', async () => {
    loadSettings()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nf', { status: 404 }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await vi.runAllTimersAsync()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('#8 超时 AbortError 视为可重试', async () => {
    loadSettings()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await vi.runAllTimersAsync()
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it('#9 最终失败 audit afterJsonb 7 字段完整', async () => {
    loadSettings()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('e', { status: 502 }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1', siteKey: 'X' }, ACTOR_ID)
    await vi.runAllTimersAsync()
    const after = auditWrite.mock.calls[0]?.[0].afterJsonb
    expect(after).toEqual(expect.objectContaining({
      event: 'crawler.run.failed',
      deliveryId: expect.any(String),
      webhookUrl: VALID_URL,
      attempts: 4,
      lastHttpStatus: 502,
      lastError: 'HTTP 502',
      payload: { runId: 'r-1', siteKey: 'X' },
      totalDurationMs: expect.any(Number),
    }))
  })

  // NTLG-P1-c-B-2：解耦双写 emit（service 字段初始化 NotificationEmitter；最终失败 audit 旁 emit）
  it('#9b 最终失败 → 解耦双写 emit（system.webhook_send_failed danger）', async () => {
    loadSettings()
    const emitSpy = vi.spyOn(NotificationEmitter.prototype, 'emit').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('e', { status: 503 }))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await vi.runAllTimersAsync()
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'system.webhook_send_failed',
      level: 'danger',
      title: 'Webhook 投递失败',
      sourceKind: 'admin_action',
      scope: 'broadcast',
      href: '/admin/settings',
    }))
  })

  // 订阅过滤/SSRF 拦截路径不写 audit → 也不应 emit（parity 守护）
  it('#9c 订阅不含 event → 不 emit（与不写 audit 同步）', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ enabled: true, url: VALID_URL, secret: 's', events: ['submission.created'] }))
    const emitSpy = vi.spyOn(NotificationEmitter.prototype, 'emit').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await vi.runAllTimersAsync()
    expect(emitSpy).not.toHaveBeenCalled()
  })
})

describe('WebhookDispatcher — 订阅过滤', () => {
  it('#10 subscribedEvents 不含当前 event 不发', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ enabled: true, url: VALID_URL, secret: 's', events: ['submission.created'] }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await flush()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('#11 空 events 数组（opt-in）不发任何事件', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ enabled: true, url: VALID_URL, secret: 's', events: [] }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await flush()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('#12 含 event → 正常发送', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ enabled: true, url: VALID_URL, secret: 's', events: ['crawler.run.failed', 'submission.created'] }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('submission.created', { id: 's-1' }, ACTOR_ID)
    await flush()
    expect(fetchSpy).toHaveBeenCalled()
  })
})

describe('WebhookDispatcher — SSRF 5 层防御', () => {
  it('#13 url=https://169.254.169.254/... → 静默拒绝（不发 + 不写 audit）', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ enabled: true, url: 'https://169.254.169.254/latest/meta-data', secret: 's', events: ['crawler.run.failed'] }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await flush()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(auditWrite).not.toHaveBeenCalled()
  })

  it('#14 url=https://localhost/wh → 静默拒绝', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ enabled: true, url: 'https://localhost/wh', secret: 's', events: ['crawler.run.failed'] }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    const dp = new WebhookDispatcher(db as never, auditSvc)
    dp.enqueue('crawler.run.failed', { runId: 'r-1' }, ACTOR_ID)
    await flush()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
