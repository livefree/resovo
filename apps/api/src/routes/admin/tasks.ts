/**
 * admin/tasks.ts — POST /admin/tasks/:id/{cancel,retry}（ADR-191 / NTLG-P0-3）
 *
 * 统一任务控制端点：top bar 任务抽屉聚合 crawler_runs + task_runs 成统一 AdminTaskItem，
 * 本端点按 :id 方案分派（裸 UUID=crawler run / `bull-{queue}-{jobId}`=bull job /
 *   `taskrun-{id}`=task_run 持久登记，ADR-194 D-194-6 re-point），
 * cancel/retry 状态机分派，响应 data.target 标注真实目标类型。
 * task_run 协作式取消：当前登记的 maintenance 作业无 abortController → running 退回 409 诚实暴露
 *   （ADR-194 D-194-6 黄线②，status='cancelling' 信号待 worker 具备 abortController 后启用）。
 *
 * 鉴权：admin-only（requireRole(['admin'])，对齐既有 crawler/runs/:id/cancel）。
 * 错误码复用 ADR-110：404 NOT_FOUND / 409 STATE_CONFLICT / 401 / 403。
 */

import type { FastifyInstance, FastifyReply } from 'fastify'
import type { AdminTaskControlTarget } from '@resovo/types'
import { db } from '@/api/lib/postgres'
import { crawlerQueue, maintenanceQueue } from '@/api/lib/queue'
import { AuditLogService } from '@/api/services/AuditLogService'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import { getTaskRunById } from '@/api/db/queries/taskRuns'
import {
  cancelPendingTasksByRun,
  requestCancelRunningTasksByRun,
  listDistinctSiteKeysByRun,
} from '@/api/db/queries/crawlerTasks'

type BullQueueName = 'crawler' | 'maintenance'

type TaskTarget =
  | { kind: 'bull_job'; queue: BullQueueName; jobId: string }
  | { kind: 'task_run'; taskRunId: string }
  | { kind: 'crawler_run'; runId: string }

const CRAWLER_TERMINAL = new Set(['failed', 'partial_failed', 'cancelled'])
const TASK_RUN_TERMINAL = new Set(['success', 'failed', 'cancelled'])

/** task_runs.kind → bull 队列名（ADR-194 D-194-2/-B：当前仅 maintenance 登记；未来 enrichment/imageHealth 加性扩展）。 */
const TASK_RUN_QUEUE: Partial<Record<string, BullQueueName>> = { maintenance: 'maintenance' }

/** 按 TaskAggregator id 方案分派（ADR-194 D-194-6）：`bull-{queue}-{jobId}` → bull job /
 *  `taskrun-{id}` → task_run（-B 副源持久登记）/ 否则 → crawler runId。 */
function parseTaskId(id: string): TaskTarget {
  const bull = id.match(/^bull-(crawler|maintenance)-(.+)$/)
  if (bull) return { kind: 'bull_job', queue: bull[1] as BullQueueName, jobId: bull[2]! }
  const taskRun = id.match(/^taskrun-(.+)$/)
  if (taskRun) return { kind: 'task_run', taskRunId: taskRun[1]! }
  return { kind: 'crawler_run', runId: id }
}

function bullQueue(name: BullQueueName) {
  return name === 'crawler' ? crawlerQueue : maintenanceQueue
}

function notFound(reply: FastifyReply, message: string) {
  return reply.code(404).send({ error: { code: 'NOT_FOUND', message, status: 404 } })
}

function stateConflict(reply: FastifyReply, message: string) {
  return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message, status: 409 } })
}

export async function adminTaskControlRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const auditSvc = new AuditLogService(db)
  const runService = new CrawlerRunService(db)

  // ── POST /admin/tasks/:id/cancel ─────────────────────────────────
  fastify.post('/admin/tasks/:id/cancel', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const target = parseTaskId(id)
    const actorId = request.user!.userId

    if (target.kind === 'crawler_run') {
      const run = await crawlerRunsQueries.getRunById(db, target.runId)
      if (!run) return notFound(reply, '批次不存在')
      await crawlerRunsQueries.updateRunControlStatus(db, target.runId, 'cancelling')
      const cancelledPending = await cancelPendingTasksByRun(db, target.runId)
      const signaledRunning = await requestCancelRunningTasksByRun(db, target.runId)
      await crawlerRunsQueries.syncRunStatusFromTasks(db, target.runId)
      auditSvc.write({
        actorId,
        actionType: 'crawler_run.cancel',
        targetKind: 'system',
        targetId: target.runId,
        beforeJsonb: { runId: target.runId, status: run.status, controlStatus: run.controlStatus },
        afterJsonb: { runId: target.runId, controlStatus: 'cancelling', cancelledPending, signaledRunning },
        requestId: request.id,
      })
      const result: AdminTaskControlTarget = { kind: 'crawler_run', id }
      return reply.send({ data: { target: result, cancelled: true } })
    }

    if (target.kind === 'task_run') {
      const run = await getTaskRunById(db, target.taskRunId)
      if (!run) return notFound(reply, '任务不存在')
      // 终态（success/failed/cancelled）→ 幂等 no-op（无状态变更，不写 audit）
      if (TASK_RUN_TERMINAL.has(run.status)) {
        const result: AdminTaskControlTarget = { kind: 'task_run', id }
        return reply.send({ data: { target: result, cancelled: false } })
      }
      // running/cancelling/pending：当前登记的 bull 作业（maintenance）无 abortController 协作取消支持
      //   → 退回 ADR-191 P0 的 409 诚实暴露（ADR-194 D-194-6 黄线②；status='cancelling' 信号待
      //   worker 具备 abortController 后启用，schema 已预留 cancelling 态）。
      return stateConflict(reply, '运行中的任务不支持取消，请等待完成或失败后重试')
    }

    // bull_job：waiting/delayed/paused → remove；active → 409；终态 → no-op
    const job = await bullQueue(target.queue).getJob(target.jobId)
    if (!job) return notFound(reply, '任务不存在')
    const state = await job.getState()
    if (state === 'active') {
      return stateConflict(reply, '运行中的队列作业不支持取消，请等待完成或失败后重试')
    }
    let cancelled = false
    if (state === 'waiting' || state === 'delayed' || state === 'paused') {
      await job.remove()
      cancelled = true
    }
    auditSvc.write({
      actorId,
      actionType: 'task.cancel',
      targetKind: 'system',
      targetId: id,
      beforeJsonb: { jobId: target.jobId, queue: target.queue, state },
      afterJsonb: { jobId: target.jobId, queue: target.queue, removed: cancelled },
      requestId: request.id,
    })
    const result: AdminTaskControlTarget = { kind: 'bull_job', id, queue: target.queue }
    return reply.send({ data: { target: result, cancelled } })
  })

  // ── POST /admin/tasks/:id/retry ──────────────────────────────────
  fastify.post('/admin/tasks/:id/retry', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const target = parseTaskId(id)
    const actorId = request.user!.userId

    if (target.kind === 'bull_job') {
      const job = await bullQueue(target.queue).getJob(target.jobId)
      if (!job) return notFound(reply, '任务不存在')
      const state = await job.getState()
      if (state !== 'failed') return stateConflict(reply, '仅失败的队列作业可重试')
      await job.retry()
      auditSvc.write({
        actorId,
        actionType: 'task.retry',
        targetKind: 'system',
        targetId: id,
        afterJsonb: { jobId: target.jobId, queue: target.queue, retried: true },
        requestId: request.id,
      })
      const result: AdminTaskControlTarget = { kind: 'bull_job', id, queue: target.queue }
      return reply.send({ data: { target: result, retried: true } })
    }

    if (target.kind === 'task_run') {
      const run = await getTaskRunById(db, target.taskRunId)
      if (!run) return notFound(reply, '任务不存在')
      if (run.status !== 'failed') return stateConflict(reply, '仅失败的任务可重试')
      // 经 run.kind→queue 映射 + run.ref（bull jobId）重试原 bull 作业（task_runs 不存 job data，schema 锁定 D-194-3）。
      const queueName = TASK_RUN_QUEUE[run.kind]
      if (!queueName || !run.ref) return stateConflict(reply, '该任务无可重试的关联队列作业')
      const job = await bullQueue(queueName).getJob(run.ref)
      if (!job) return stateConflict(reply, '原队列作业记录已清理，无法重试')
      const state = await job.getState()
      if (state !== 'failed') return stateConflict(reply, '原队列作业非失败态，无法重试')
      await job.retry()
      auditSvc.write({
        actorId,
        actionType: 'task.retry',
        targetKind: 'system',
        targetId: id,
        afterJsonb: { taskRunId: target.taskRunId, queue: queueName, ref: run.ref, retried: true },
        requestId: request.id,
      })
      const result: AdminTaskControlTarget = { kind: 'task_run', id }
      return reply.send({ data: { target: result, retried: true } })
    }

    // crawler_run：终态 → 以原 run 配置 + 重建 siteKeys 新建 run（保审计链 / run 不可变）
    const run = await crawlerRunsQueries.getRunById(db, target.runId)
    if (!run) return notFound(reply, '批次不存在')
    if (!CRAWLER_TERMINAL.has(run.status)) {
      return stateConflict(reply, '仅终态（失败/部分失败/已取消）批次可重试')
    }
    const siteKeys = await listDistinctSiteKeysByRun(db, target.runId)
    const created = await runService.createAndEnqueueRun({
      triggerType: run.triggerType,
      mode: run.mode,
      siteKeys: siteKeys.length > 0 ? siteKeys : undefined,
      crawlMode: run.crawlMode,
      keyword: run.keyword,
      targetVideoId: run.targetVideoId,
      createdBy: actorId,
    })
    auditSvc.write({
      actorId,
      actionType: 'task.retry',
      targetKind: 'system',
      targetId: target.runId,
      beforeJsonb: { runId: target.runId, status: run.status },
      afterJsonb: { originalRunId: target.runId, retryRunId: created.runId, siteKeys },
      requestId: request.id,
    })
    const result: AdminTaskControlTarget = { kind: 'crawler_run', id, retryRunId: created.runId }
    return reply.send({ data: { target: result, retried: true } })
  })
}
