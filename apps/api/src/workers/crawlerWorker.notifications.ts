/**
 * crawlerWorker.notifications.ts — 采集 run 完成通知构造（NTLG-P1-c-B-1 / ADR-193 D-193-4）
 *
 * crawler run 终态时由 crawlerWorker emit 结构化 digest 通知（解耦双写：emit 写 notifications 新表，
 * 与 webhook / audit 互不依赖）。digest 走 path A——复用 TaskAggregator.buildTaskResultDigest（run summary 投影），
 * 不建 task_runs（D-193-5）。纯函数沉淀本文件（crawlerWorker.ts 既有 505 行超限，避加重主体 + 单测友好）。
 */
import type { SyncRunStatusResult } from '@/api/db/queries/crawlerRuns'
import type { EmitNotificationInput } from '@/api/services/NotificationEmitter'
import { buildTaskResultDigest } from '@/api/services/TaskAggregator'

/** run 终态 status → 通知 level/title（仅终态产出通知；非终态不在表内 → buildRunCompletedNotification 返 null） */
const TERMINAL_NOTIFICATION: Record<string, { readonly level: 'info' | 'warn' | 'danger'; readonly title: string }> = {
  success: { level: 'info', title: '采集完成' },
  partial_failed: { level: 'warn', title: '采集部分失败' },
  failed: { level: 'danger', title: '采集失败' },
  cancelled: { level: 'warn', title: '采集已取消' },
}

/**
 * 从 run 终态同步结果构造采集完成通知（ADR-193 D-193-4 path A）。
 * 非终态 status（queued / running / paused）→ null（不 emit；多 site run 仅最后一个 job 见终态）。
 * 终态 → EmitNotificationInput：digest 投影 payload + 人读 body + dedupKey 幂等（防 multi-site 并发 finally 重复 emit）。
 */
export function buildRunCompletedNotification(
  syncResult: SyncRunStatusResult,
  runId: string,
): EmitNotificationInput | null {
  const meta = TERMINAL_NOTIFICATION[syncResult.status]
  if (!meta) return null
  const digest = buildTaskResultDigest(syncResult.summary)
  return {
    type: 'crawler.run.completed',
    level: meta.level,
    title: meta.title,
    sourceKind: 'crawler',
    ...(digest?.summary !== undefined && { body: digest.summary }),
    ...(digest !== undefined && { payload: digest }),
    href: '/admin/crawler',
    scope: 'broadcast',
    sourceRef: runId,
    dedupKey: `crawler.run.completed:${runId}`,
  }
}
