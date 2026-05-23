/**
 * webhook-api.ts — admin webhook 测试端点 lib
 * ADR-146 / CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B
 */
import { apiClient } from '@/lib/api-client'

export interface WebhookTestResult {
  success: boolean
  httpStatus: number | null
  latencyMs: number
  error: string | null
}

export async function testWebhook(): Promise<WebhookTestResult> {
  const res = await apiClient.post<{ data: WebhookTestResult }>('/admin/webhook/test', {})
  return res.data
}

// CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B / ADR-146 D-146-2：5 事件 enum 真源
export const WEBHOOK_EVENT_TYPES = [
  'crawler.run.failed',
  'storage.r2.alert',
  'moderation.pending.threshold',
  'submission.created',
  'video.batch.complete',
] as const

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number]

export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  'crawler.run.failed':            '采集任务失败',
  'storage.r2.alert':              'R2 存储配额告警',
  'moderation.pending.threshold':  '审核待处理积压超阈值',
  'submission.created':            '用户投稿新增',
  'video.batch.complete':          '批量发布/导入完成',
}
