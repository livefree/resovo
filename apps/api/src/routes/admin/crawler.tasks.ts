/**
 * crawler.tasks.ts — 爬虫任务（Task）管理路由
 * 从 crawler.ts 拆出，覆盖任务列表/详情/日志/冻结/止血系列
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { AuditLogService } from '@/api/services/AuditLogService'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import {
  listTasks,
  findTaskById,
  cancelAllActiveTasks,
  cancelTaskById,
  batchCancelTasks,
  findActiveTaskBySite,
  getLatestTaskBySite,
  getLatestTasksBySites,
  markStalePendingTasks,
  countOrphanActiveTasks,
  type CrawlerTask,
} from '@/api/db/queries/crawlerTasks'
import { isAppError } from '@/api/lib/errors'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import { crawlerQueue } from '@/api/lib/queue'
import { createCrawlerTaskLog, listCrawlerTaskLogs } from '@/api/db/queries/crawlerTaskLogs'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'

export function mapTaskDto(task: CrawlerTask) {
  const mode = task.type === 'incremental-crawl' ? 'incremental' : 'full'
  const status =
    task.status === 'pending'
      ? 'queued'
      : task.status === 'running'
        ? 'running'
        : task.status === 'paused'
          ? 'paused'
        : task.status === 'done'
          ? 'success'
          : task.status === 'cancelled'
            ? 'cancelled'
            : task.status === 'timeout'
              ? 'timeout'
          : 'failed'

  const result = task.result ?? {}
  const message =
    typeof result.error === 'string'
      ? result.error
      : task.status === 'failed'
        ? '任务执行失败'
        : null
  const itemCount =
    typeof result.videosUpserted === 'number'
      ? result.videosUpserted
      : typeof result.sourcesUpserted === 'number'
        ? result.sourcesUpserted
        : null

  return {
    id: task.id,
    siteKey: task.sourceSite,
    mode,
    status,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    message,
    itemCount,
  }
}

export async function registerCrawlerTaskRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const auditSvc = new AuditLogService(db)
  const runService = new CrawlerRunService(db)

  const logTask = async (input: Parameters<typeof createCrawlerTaskLog>[1]) => {
    try {
      await createCrawlerTaskLog(db, input)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      fastify.log.warn({ err: message, input }, 'failed to persist crawler task log')
    }
  }

  // ── GET /admin/crawler/tasks ──────────────────────────────────

  fastify.get('/admin/crawler/tasks', { preHandler: auth }, async (request, reply) => {
    const QuerySchema = z.object({
      status: z.enum(['pending', 'running', 'paused', 'done', 'failed', 'cancelled', 'timeout']).optional(),
      triggerType: z.enum(['single', 'batch', 'all', 'schedule']).optional(),
      runId: z.string().uuid().optional(),
      sortField: z.enum(['runId', 'type', 'site', 'triggerType', 'status', 'startedAt', 'finishedAt', 'error']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      page:   z.coerce.number().int().min(1).default(1),
      limit:  z.coerce.number().int().min(1).max(100).default(20),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { status, triggerType, runId, sortField, sortDir, page, limit } = parsed.data
    const { rows, total } = await listTasks(db, {
      status,
      triggerType,
      runId,
      sortField,
      sortDir,
      limit,
      offset: (page - 1) * limit,
    })

    return reply.send({
      data: rows,
      pagination: { total, page, limit, hasNext: page * limit < total },
    })
  })

  // ── POST /admin/crawler/tasks — 手动触发采集 ─────────────────
  // @deprecated 使用 POST /admin/crawler/runs 替代（triggerType: 'single' | 'all'）
  // 保留此路由以向后兼容；计划在 CHG-163 正式删除（sunset: 2026-05-01）
  // 所有新调用方请迁移到 POST /admin/crawler/runs

  fastify.post('/admin/crawler/tasks', { preHandler: auth }, async (request, reply) => {
    void reply.header('Deprecation', 'true')
    void reply.header('Sunset', 'Thu, 01 May 2026 00:00:00 GMT')
    void reply.header('Link', '</admin/crawler/runs>; rel="successor-version"')

    const BodySchema = z.object({
      type:    z.enum(['full-crawl', 'incremental-crawl']).default('incremental-crawl'),
      siteKey: z.string().min(1).optional(),
      hoursAgo: z.number().int().min(1).max(720).optional(),
    })

    const parsed = BodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { type, siteKey, hoursAgo } = parsed.data

    if (siteKey) {
      await markStalePendingTasks(db, { siteKey, staleMinutes: 10 })

      const site = await crawlerSitesQueries.findCrawlerSite(db, siteKey)
      if (!site || site.disabled) {
        return reply.code(404).send({
          error: {
            code: 'SITE_NOT_FOUND',
            message: `源站 ${siteKey} 不存在或已停用`,
            status: 404,
          },
        })
      }

      const active = await findActiveTaskBySite(db, siteKey)
      if (active) {
        return reply.code(409).send({
          error: {
            code: 'CRAWL_TASK_CONFLICT',
            message: `源站 ${siteKey} 已存在进行中的采集任务`,
            status: 409,
          },
          data: {
            activeTaskId: active.id,
            activeTaskType: active.type,
            activeTaskStatus: active.status,
          },
        })
      }

      try {
        const createdBy = (request.user as { userId?: string } | undefined)?.userId ?? null
        const result = await runService.createAndEnqueueRun({
          triggerType: 'single',
          mode: type === 'full-crawl' ? 'full' : 'incremental',
          siteKeys: [siteKey],
          hoursAgo: hoursAgo ?? 24,
          createdBy,
        })
        return reply.code(202).send({
          data: {
            runId: result.runId,
            taskId: result.taskIds[0] ?? null,
            type,
            siteKey,
            enqueuedSiteKeys: result.enqueuedSiteKeys,
            skippedSiteKeys: result.skippedSiteKeys,
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await logTask({
          sourceSite: siteKey,
          level: 'error',
          stage: 'api.run.enqueue_failed',
          message: '单站批次创建失败',
          details: { error: message },
        })
        return reply.code(503).send({
          error: {
            code: 'CRAWLER_QUEUE_UNAVAILABLE',
            message: '任务入队失败，请检查 Redis/worker',
            status: 503,
          },
          data: { taskId: null },
        })
      }
    }

    try {
      const createdBy = (request.user as { userId?: string } | undefined)?.userId ?? null
      const result = await runService.createAndEnqueueRun({
        triggerType: 'all',
        mode: type === 'full-crawl' ? 'full' : 'incremental',
        hoursAgo: hoursAgo ?? 24,
        createdBy,
      })
      return reply.code(202).send({
        data: {
          runId: result.runId,
          taskIds: result.taskIds,
          type,
          siteKey: null,
          enqueuedSiteKeys: result.enqueuedSiteKeys,
          skippedSiteKeys: result.skippedSiteKeys,
        },
      })
    } catch (err) {
      return reply.code(503).send({
        error: {
          code: 'CRAWLER_QUEUE_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'crawler queue unavailable',
          status: 503,
        },
      })
    }
  })

  // ── POST /admin/crawler/stop-all — 全局止血 ────────────────
  fastify.post('/admin/crawler/stop-all', { preHandler: auth }, async (request, reply) => {
    const BodySchema = z.object({
      freeze: z.boolean().default(true),
      removeRepeatableTick: z.boolean().default(true),
    })
    const parsed = BodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const { freeze, removeRepeatableTick } = parsed.data

    // CHG-SN-6-25-RETRO：审计 — crawler.stop_all（before 取 freeze 状态）
    const beforeFreezeSetting = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')

    if (freeze) {
      await systemSettingsQueries.setSetting(db, 'crawler_global_freeze', 'true')
    }

    const { count: runMarked, runIds: cancelledRunIds } = await crawlerRunsQueries.requestCancelAllActiveRuns(db)
    const taskChanges = await cancelAllActiveTasks(db)

    for (const runId of cancelledRunIds) {
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    }

    if (removeRepeatableTick) {
      try {
        const repeatables = await crawlerQueue.getRepeatableJobs()
        for (const repeat of repeatables) {
          if (repeat.id === 'auto-crawl-tick' || repeat.key.includes('auto-crawl-tick')) {
            await crawlerQueue.removeRepeatableByKey(repeat.key)
          }
        }
      } catch (err) {
        fastify.log.warn({ err }, 'failed to remove crawler repeatable tick')
      }
    }

    const freezeSetting = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')

    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'crawler.stop_all',
      targetKind: 'system',
      targetId: 'stop_all',
      beforeJsonb: { freezeEnabled: beforeFreezeSetting === 'true' },
      afterJsonb: {
        freezeEnabled: freezeSetting === 'true',
        markedRuns: runMarked,
        removeRepeatableTick,
        ...taskChanges,
      },
      requestId: request.id,
    })

    return reply.send({
      data: {
        freezeEnabled: freezeSetting === 'true',
        markedRuns: runMarked,
        ...taskChanges,
      },
    })
  })

  // ── POST /admin/crawler/freeze — 全局冻结开关 ───────────────
  fastify.post('/admin/crawler/freeze', { preHandler: auth }, async (request, reply) => {
    const BodySchema = z.object({
      enabled: z.boolean(),
    })
    const parsed = BodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }

    // CHG-SN-6-20-A：审计 — crawler.freeze（before 取当前状态）
    const beforeFreeze = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')

    await systemSettingsQueries.setSetting(db, 'crawler_global_freeze', parsed.data.enabled ? 'true' : 'false')
    const freeze = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')
    const orphanTaskCount = await countOrphanActiveTasks(db)
    const schedulerEnabled = process.env.CRAWLER_SCHEDULER_ENABLED === 'true'

    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'crawler.freeze',
      targetKind: 'system',
      targetId: 'crawler_global_freeze',
      beforeJsonb: { freezeEnabled: beforeFreeze === 'true' },
      afterJsonb: {
        freezeEnabled: freeze === 'true',
        schedulerEnabled,
        orphanTaskCount,
      },
      requestId: request.id,
    })

    return reply.send({
      data: {
        schedulerEnabled,
        freezeEnabled: freeze === 'true',
        orphanTaskCount,
      },
    })
  })

  // ── GET /admin/crawler/tasks/:id ─────────────────────────────
  // UX-09: 任务详情（含运行上下文 crawlMode / keyword / targetVideoId）

  fastify.get('/admin/crawler/tasks/:id', { preHandler: auth }, async (request, reply) => {
    const ParamsSchema = z.object({ id: z.string().uuid() })
    const p = ParamsSchema.safeParse(request.params)
    if (!p.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const task = await findTaskById(db, p.data.id)
    if (!task) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '任务不存在', status: 404 },
      })
    }

    const run = task.runId ? await crawlerRunsQueries.getRunById(db, task.runId) : null
    const runContext = run
      ? { crawlMode: run.crawlMode, keyword: run.keyword, targetVideoId: run.targetVideoId }
      : null

    return reply.send({
      data: {
        ...mapTaskDto(task),
        siteBreakdown: {
          siteKey: task.sourceSite,
          videosUpserted: (task.result?.videosUpserted as number | undefined) ?? 0,
          sourcesUpserted: (task.result?.sourcesUpserted as number | undefined) ?? 0,
          sourcesKept: (task.result?.sourcesKept as number | undefined) ?? 0,
          sourcesRemoved: (task.result?.sourcesRemoved as number | undefined) ?? 0,
          errors: (task.result?.errors as number | undefined) ?? 0,
        },
        runContext,
      },
    })
  })

  // ── GET /admin/crawler/tasks/:id/logs ───────────────────────

  fastify.get('/admin/crawler/tasks/:id/logs', { preHandler: auth }, async (request, reply) => {
    const ParamsSchema = z.object({ id: z.string().uuid() })
    const QuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(500).default(200) })

    const p = ParamsSchema.safeParse(request.params)
    const q = QuerySchema.safeParse(request.query)
    if (!p.success || !q.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const logs = await listCrawlerTaskLogs(db, { taskId: p.data.id, limit: q.data.limit })
    return reply.send({ data: { logs } })
  })

  // ── GET /admin/crawler/tasks/latest?siteKeys=a,b ───────────

  fastify.get('/admin/crawler/tasks/latest', { preHandler: auth }, async (request, reply) => {
    const QuerySchema = z.object({
      siteKeys: z.string().min(1),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const siteKeys = parsed.data.siteKeys
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (siteKeys.length === 0) {
      return reply.send({ data: { tasks: [] } })
    }

    const tasks = await getLatestTasksBySites(db, siteKeys)
    return reply.send({ data: { tasks: tasks.map(mapTaskDto) } })
  })

  // ── POST /admin/crawler/tasks/:id/cancel ─────────────────────
  // ADR-151 / CHG-SN-9-CW1-B-EP：task 级单点 cancel（含 R-151-2 幂等守卫）

  fastify.post('/admin/crawler/tasks/:id/cancel', { preHandler: auth }, async (request, reply) => {
    const ParamsSchema = z.object({ id: z.string().uuid() })
    const parsed = ParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    try {
      const result = await cancelTaskById(db, parsed.data.id)
      if (!result) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '任务不存在', status: 404 },
        })
      }

      // D-151-6：cancel 后立即触发 syncRun 同步父 run 状态（best-effort）
      if (result.runId) {
        try {
          await crawlerRunsQueries.syncRunStatusFromTasks(db, result.runId)
        } catch (err) {
          fastify.log.warn({ err, runId: result.runId }, 'syncRunStatusFromTasks failed after task cancel')
        }
      }

      // D-151-4 audit：crawler_task.cancel
      auditSvc.write({
        actorId: request.user!.userId,
        actionType: 'crawler_task.cancel',
        targetKind: 'crawler_task',
        targetId: parsed.data.id,
        beforeJsonb: {
          status: result.task.status,
          cancelRequested: !result.alreadyRequested,
        },
        afterJsonb: {
          finalStatus: result.finalStatus,
          alreadyRequested: result.alreadyRequested,
          runId: result.runId,
          reason: 'task_manual_cancel',
        },
        requestId: request.id,
      })

      return reply.send({
        data: {
          task: mapTaskDto(result.task),
          runId: result.runId,
          finalStatus: result.finalStatus,
          ...(result.alreadyRequested ? { alreadyRequested: true } : {}),
        },
      })
    } catch (err) {
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(422).send({
          error: { code: 'TASK_CANCEL_FORBIDDEN_TERMINAL', message: err.message, status: 422 },
        })
      }
      throw err
    }
  })

  // ── POST /admin/crawler/tasks/batch-cancel ───────────────────
  // ADR-151 / CHG-SN-9-CW1-B-EP：task 级 batch cancel（summary 三元 + best-effort syncRun）

  fastify.post('/admin/crawler/tasks/batch-cancel', { preHandler: auth }, async (request, reply) => {
    const BodySchema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
    })
    const parsed = BodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    const result = await batchCancelTasks(db, parsed.data.ids)

    if (result.failedRunSyncIds.length > 0) {
      fastify.log.warn(
        { failedRunSyncIds: result.failedRunSyncIds, count: result.failedRunSyncIds.length },
        'batch task cancel: syncRunStatusFromTasks failed for some runs',
      )
    }

    // D-151-4 audit：crawler_task.batch_cancel（Y-151-2：含 idsSample 输入快照）
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'crawler_task.batch_cancel',
      targetKind: 'system',
      targetId: 'batch_cancel',
      beforeJsonb: {
        count: parsed.data.ids.length,
        idsSample: parsed.data.ids.slice(0, 5),
      },
      afterJsonb: {
        summary: {
          cancelled: result.summary.cancelled,
          cancelRequested: result.summary.cancelRequested,
          alreadyRequested: result.summary.alreadyRequested,
          errorsCount: result.summary.errors.length,
          errorsSample: result.summary.errors.slice(0, 10),
        },
        runIds: result.runIds.slice(0, 10),
        failedRunSyncCount: result.failedRunSyncIds.length,
      },
      requestId: request.id,
    })

    return reply.send({
      data: {
        summary: result.summary,
        runIds: result.runIds,
        ...(result.failedRunSyncIds.length > 0 ? { failedRunSyncIds: result.failedRunSyncIds } : {}),
      },
      processed: parsed.data.ids.length,
    })
  })

  // ── GET /admin/crawler/sites/:key/latest-task ──────────────

  fastify.get('/admin/crawler/sites/:key/latest-task', { preHandler: auth }, async (request, reply) => {
    const { key } = request.params as { key: string }
    const task = await getLatestTaskBySite(db, key)
    return reply.send({ data: { task: task ? mapTaskDto(task) : null } })
  })
}
