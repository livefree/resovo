/**
 * TaskRunReporter.ts — 任务登记/汇报中枢 P1 实装（ADR-193 D-193-3 / NTLG-P1-c-A）
 *
 * P1 阶段路径 A（D-193-5：不建 task_runs 表）下，Reporter 退化为 NoopTaskRunReporter：
 *   契约先行 + log-only，不写 DB。digest 走 path A（TaskAggregator summary 投影，NTLG-P1-b），不依赖本 Reporter。
 * 真实 task_runs DB 写实装待 ADR-194（path B）；re-point 时本 Noop 替换为真实实现，TaskRunReporter 契约不变。
 *
 * start 登记失败不阻断作业（§11 D4）：Noop 不写 DB 故无失败，直接返回 sentinel；
 * 未来真实实装 start 内部 catch 降级返回 sentinel + log warn。
 */

import type { TaskRunId, TaskRunReporter, TaskResultDigest } from '@resovo/types'
import { baseLogger } from '@/api/lib/logger'

/** 未登记任务的 sentinel TaskRunId（ADR-193 D-193-3/4）。
 *  start 降级 / Noop 实装返回此值；progress / finish 收到 sentinel → no-op（不写 DB、不抛错）。 */
export const UNLINKED_TASK_RUN_ID: TaskRunId = 'unlinked'

/**
 * P1 no-op / log-only Reporter（ADR-193 D-193-3）。
 * 不写 DB：start 返 sentinel + log；progress / finish 仅 log（sentinel → 不写真实进度 / digest）。
 */
export class NoopTaskRunReporter implements TaskRunReporter {
  start(input: { readonly kind: string; readonly title: string; readonly ref?: string }): Promise<TaskRunId> {
    baseLogger.debug(
      { kind: input.kind, title: input.title, ref: input.ref },
      '[NoopTaskRunReporter] start (P1 no-op; 真实 task_runs DB 写待 ADR-194)',
    )
    return Promise.resolve(UNLINKED_TASK_RUN_ID)
  }

  progress(id: TaskRunId, pct: number): Promise<void> {
    // sentinel id → no-op（P1 不写真实进度）；真实 DB 写待 ADR-194 path B
    baseLogger.debug({ id, pct }, '[NoopTaskRunReporter] progress (no-op)')
    return Promise.resolve()
  }

  finish(
    id: TaskRunId,
    result: { readonly status: 'success' | 'failed' | 'cancelled'; readonly digest?: TaskResultDigest; readonly error?: string },
  ): Promise<void> {
    // sentinel id → no-op；真实终态登记 + digest 落库待 ADR-194 path B
    baseLogger.debug({ id, status: result.status }, '[NoopTaskRunReporter] finish (no-op)')
    return Promise.resolve()
  }
}
