/**
 * TaskRunReporter.ts — 任务登记/汇报中枢（ADR-193 D-193-3 契约 + ADR-194 path B 真实实装）
 *
 * 两实装并存：
 *   - NoopTaskRunReporter（P1 / NTLG-P1-c-A）：契约先行 + log-only，不写 DB；作降级/测试兜底。
 *   - DbTaskRunReporter（P2 / NTLG-P2-a-A，ADR-194 D-194-4）：真实写 task_runs（仅登记无持久 run 表的
 *     bull 作业；crawler 不接 Reporter，digest 走 path A summary 投影 D-194-DEV-2）。interface 契约零改动。
 *
 * start 登记失败不阻断作业（§11 D4）：DbTaskRunReporter.start 内部 catch DB 错误 → 降级返回 sentinel
 *   `UNLINKED_TASK_RUN_ID` + log warn；后续 progress/finish 对 sentinel id no-op（不写 DB、不抛错）。
 *   DB 抖动不拖垮后台作业（与 audit fire-and-forget 哲学一致）。
 */

import type { Pool } from 'pg'
import type { TaskRunId, TaskRunReporter, TaskResultDigest } from '@resovo/types'
import { baseLogger } from '@/api/lib/logger'
import {
  insertTaskRun,
  updateTaskRunProgress,
  finishTaskRun,
  type TaskRunFinishStatus,
} from '@/api/db/queries/taskRuns'

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

/**
 * P2 真实实装（ADR-194 D-194-4）：写 task_runs 表（仅无持久 run 表的 bull 作业；crawler 不接，D-194-DEV-2）。
 * 注入范式同 AuditLogService / NotificationEmitter（constructor(db: Pool)）；SQL 落 db/queries/taskRuns.ts（D-192-7 同约束）。
 * 接入归 NTLG-P2-a-B（各 bull worker reporter.start/progress/finish + TaskAggregator 投影收敛）。
 */
export class DbTaskRunReporter implements TaskRunReporter {
  constructor(private readonly db: Pool) {}

  /** 登记失败不阻断作业（§11 D4）：catch DB 错误 → 降级 sentinel + log warn，后续 progress/finish 对其 no-op。 */
  async start(input: { readonly kind: string; readonly title: string; readonly ref?: string }): Promise<TaskRunId> {
    try {
      const { id } = await insertTaskRun(this.db, { kind: input.kind, title: input.title, ref: input.ref })
      return id
    } catch (err) {
      baseLogger.warn(
        { err, kind: input.kind, title: input.title, ref: input.ref },
        '[DbTaskRunReporter] start 登记失败，降级 sentinel（作业照常跑，§11 D4）',
      )
      return UNLINKED_TASK_RUN_ID
    }
  }

  /** sentinel id → no-op；真实 id → 更新进度（clamp 0-100）。失败仅 log warn，不阻断。 */
  async progress(id: TaskRunId, pct: number): Promise<void> {
    if (id === UNLINKED_TASK_RUN_ID) return
    const clamped = Math.max(0, Math.min(100, Math.round(pct)))
    try {
      await updateTaskRunProgress(this.db, id, clamped)
    } catch (err) {
      baseLogger.warn({ err, id, pct }, '[DbTaskRunReporter] progress 更新失败（不阻断）')
    }
  }

  /** sentinel id → no-op；真实 id → 终态登记 + digest 落库。失败仅 log warn，不阻断。 */
  async finish(
    id: TaskRunId,
    result: { readonly status: TaskRunFinishStatus; readonly digest?: TaskResultDigest; readonly error?: string },
  ): Promise<void> {
    if (id === UNLINKED_TASK_RUN_ID) return
    try {
      await finishTaskRun(this.db, id, { status: result.status, digest: result.digest, error: result.error })
    } catch (err) {
      baseLogger.warn({ err, id, status: result.status }, '[DbTaskRunReporter] finish 登记失败（不阻断）')
    }
  }
}
