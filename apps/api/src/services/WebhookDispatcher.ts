/**
 * WebhookDispatcher.ts — admin webhook outbound 调度器（ADR-146）
 * CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A
 *
 * 设计：
 *   - fire-and-forget 异步执行（与 AuditLogService.write 同模式）；调用方零阻塞
 *   - 单例：从 system_settings KV 读 enabled / url / secret / subscribedEvents
 *   - HMAC-SHA256 签名 + 4 自定义 header
 *   - retry [5s/15s/45s] + jitter + 30s 超时 + 4xx 不重试 + 5xx 重试
 *   - 最终失败写 R-MID-1 `system.webhook_send_failed` audit
 *   - SSRF 防御复用 lib/ssrf-guard.ts
 *
 * 不依赖 bull/Redis（仓内 bull 已装但无 Redis 部署，避免引入新依赖）。
 */
import crypto from 'node:crypto'
import type { Pool } from 'pg'
import type { WebhookEventType, WebhookDispatchBody } from '@/types'
import { isAllowedWebhookUrl } from '@/api/lib/ssrf-guard'
import { createLogger } from '@/api/lib/logger'
import type { AuditLogService } from './AuditLogService'

const baseLogger = createLogger({ service: 'webhook-dispatcher' })

// 系统操作 actor ID 占位（cron / 自动事件触发场景）
export const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000000'

// retry 间隔（ADR-146 D-146-5）
const BACKOFF_MS = [5_000, 15_000, 45_000] as const
const HTTP_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 4  // 含首次 + 3 次重试

interface WebhookSettings {
  enabled: boolean
  url: string
  secret: string
  subscribedEvents: WebhookEventType[]
}

async function readWebhookSettings(db: Pool): Promise<WebhookSettings> {
  const res = await db.query<{ key: string; value: string }>(
    `SELECT key, value FROM system_settings
     WHERE key IN ('notification_webhook_enabled', 'notification_webhook_url',
                   'notification_webhook_secret', 'notification_webhook_events')`,
  )
  const map = new Map(res.rows.map((r) => [r.key, r.value]))
  const enabled = map.get('notification_webhook_enabled') === 'true'
  const url = map.get('notification_webhook_url') ?? ''
  const secret = map.get('notification_webhook_secret') ?? ''
  let subscribedEvents: WebhookEventType[] = []
  const eventsRaw = map.get('notification_webhook_events')
  if (eventsRaw) {
    try {
      const parsed = JSON.parse(eventsRaw)
      if (Array.isArray(parsed)) subscribedEvents = parsed as WebhookEventType[]
    } catch {
      // ignore — malformed JSON treated as empty subscription
    }
  }
  return { enabled, url, secret, subscribedEvents }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildHeaders(event: string, deliveryId: string, signature: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Resovo-Webhook/1.0',
    'X-Resovo-Event': event,
    'X-Resovo-Delivery': deliveryId,
    'X-Resovo-Timestamp': new Date().toISOString(),
  }
  if (signature) headers['X-Resovo-Signature'] = signature
  return headers
}

function computeSignature(body: string, secret: string): string | null {
  if (!secret) return null
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
}

export interface DispatchTestResult {
  success: boolean
  httpStatus: number | null
  latencyMs: number
  error: string | null
}

export class WebhookDispatcher {
  constructor(
    private readonly db: Pool,
    private readonly auditSvc: AuditLogService,
  ) {}

  /**
   * Fire-and-forget 入口；调用方零阻塞。
   * 各 Service 触发点（CrawlerRunService 失败 / UserSubmissionService.create /
   * StagingPublishService.batchPublish 等）调用此方法。
   */
  enqueue(event: WebhookEventType, payload: Record<string, unknown>, actorId: string): void {
    this.dispatch(event, payload, actorId).catch((err: unknown) => {
      baseLogger.warn({ err, event }, '[WebhookDispatcher] unhandled dispatch error')
    })
  }

  /**
   * 异步执行：读 KV → 订阅过滤 → SSRF → HMAC → retry fetch → audit on final failure
   */
  private async dispatch(event: WebhookEventType, payload: Record<string, unknown>, actorId: string): Promise<void> {
    const settings = await readWebhookSettings(this.db)
    if (!settings.enabled || !settings.url) return
    if (settings.subscribedEvents.length === 0) return  // opt-in 语义
    if (!settings.subscribedEvents.includes(event)) return

    if (!isAllowedWebhookUrl(settings.url)) {
      baseLogger.warn({ url: settings.url, event }, '[WebhookDispatcher] SSRF blocked')
      return
    }

    const deliveryId = crypto.randomUUID()
    const body: WebhookDispatchBody = {
      event,
      deliveryId,
      occurredAt: new Date().toISOString(),
      payload,
    }
    const bodyStr = JSON.stringify(body)
    const signature = computeSignature(bodyStr, settings.secret)
    const headers = buildHeaders(event, deliveryId, signature)

    const startedAt = Date.now()
    let lastStatus: number | null = null
    let lastError: string | null = null
    let attempts = 0

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      attempts = i + 1
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
        const res = await fetch(settings.url, {
          method: 'POST',
          headers,
          body: bodyStr,
          signal: controller.signal,
        })
        clearTimeout(timer)
        lastStatus = res.status

        if (res.ok) return  // 2xx 成功
        if (res.status >= 400 && res.status < 500) {
          lastError = `HTTP ${res.status}`
          break  // 4xx 不重试
        }
        lastError = `HTTP ${res.status}`  // 5xx 继续重试
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err)
      }

      if (i < BACKOFF_MS.length) {
        const jitter = Math.random() * 2000
        await sleep(BACKOFF_MS[i]! + jitter)
      }
    }

    // 最终失败 R-MID-1 audit
    this.auditSvc.write({
      actorId,
      actionType: 'system.webhook_send_failed',
      targetKind: 'system',
      targetId: null,
      beforeJsonb: null,
      afterJsonb: {
        event,
        deliveryId,
        webhookUrl: settings.url,
        attempts,
        lastHttpStatus: lastStatus,
        lastError,
        payload,
        totalDurationMs: Date.now() - startedAt,
      },
    })
  }

  /**
   * POST /admin/webhook/test 端点用：单次 fetch（不重试）+ 返回结果。
   * 不写 audit（测试发送非业务操作）。
   */
  async sendTest(): Promise<DispatchTestResult> {
    const settings = await readWebhookSettings(this.db)
    if (!settings.url) {
      return { success: false, httpStatus: null, latencyMs: 0, error: '请先在通知设置中配置 Webhook URL' }
    }
    if (!isAllowedWebhookUrl(settings.url)) {
      return { success: false, httpStatus: null, latencyMs: 0, error: 'Webhook URL 不安全（仅允许 https 公网地址）' }
    }
    const deliveryId = crypto.randomUUID()
    const body: WebhookDispatchBody = {
      event: 'webhook.test',
      deliveryId,
      occurredAt: new Date().toISOString(),
      payload: { message: 'Resovo webhook 连通性测试' },
    }
    const bodyStr = JSON.stringify(body)
    const signature = computeSignature(bodyStr, settings.secret)
    const headers = buildHeaders('webhook.test', deliveryId, signature)

    const startedAt = Date.now()
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
      const res = await fetch(settings.url, { method: 'POST', headers, body: bodyStr, signal: controller.signal })
      clearTimeout(timer)
      return {
        success: res.ok,
        httpStatus: res.status,
        latencyMs: Date.now() - startedAt,
        error: res.ok ? null : `HTTP ${res.status}`,
      }
    } catch (err: unknown) {
      return {
        success: false,
        httpStatus: null,
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
