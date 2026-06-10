/**
 * notification-pubsub.ts — 通知变更 Redis pub/sub 信号封装（ADR-196 D-196-2 / NTLG-P2-c-B-1）
 *
 * 多实例 fan-out（D-196-2，arch-reviewer 红线 1 论据）：SSE 长连接绑单实例，emit 可落任意实例
 *   → 进程内事件总线无法跨实例 fan-out。NotificationEmitter.emit 写库成功后 publish 轻量信号到
 *   `notifications:changed` channel（载荷仅含 scope 供端点按订阅 scope 过滤）；每个 API 实例由
 *   NotificationStreamService 用单一共享 `redis.duplicate()` subscribe 同 channel → 全实例都收信号
 *   → 各自推本实例持有的连接。
 *
 * fire-and-forget（D-196-3 可靠性）：publish 失败仅 warn 不抛——pub/sub 无持久化，丢信号由前端
 *   60s 轮询 fallback 兜底（D-196-6 最终一致上界 60s），不引入持久队列（YAGNI）。
 *
 * publish 用主 `redis` 连接（非 subscribe 模式）；subscribe 侧 duplicate 连接归 NotificationStreamService。
 */

import { redis } from '@/api/lib/redis'
import { baseLogger } from '@/api/lib/logger'

/** 通知变更广播 channel（全实例 subscribe 同一 channel） */
export const NOTIFICATIONS_CHANGED_CHANNEL = 'notifications:changed'

/** pub/sub 信号载荷：仅含发生变更的 scope（broadcast / role:<role> / user:<id>），供端点按订阅过滤。 */
export interface NotificationChangedSignal {
  readonly scope: string
}

export function encodeNotificationSignal(signal: NotificationChangedSignal): string {
  return JSON.stringify(signal)
}

/** 解码信号；非法/缺 scope → null（防御异常载荷，调用方静默丢弃）。 */
export function decodeNotificationSignal(raw: string): NotificationChangedSignal | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const scope = (parsed as Record<string, unknown>).scope
    if (typeof scope !== 'string' || scope.length === 0) return null
    return { scope }
  } catch {
    return null
  }
}

/**
 * 发布通知变更信号（fire-and-forget）：写库成功后调用，触发各实例 SSE fan-out 重算 unread。
 * 失败仅 warn——丢信号由前端轮询 fallback 兜底（D-196-3/6）。
 */
export function publishNotificationChanged(scope: string): void {
  redis
    .publish(NOTIFICATIONS_CHANGED_CHANNEL, encodeNotificationSignal({ scope }))
    .catch((err: unknown) => {
      baseLogger.warn({ err, scope }, '[notification-pubsub] publish failed')
    })
}
