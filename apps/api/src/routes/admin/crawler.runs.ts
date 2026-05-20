/**
 * crawler.runs.ts — 爬虫批次（Run）管理路由
 * 从 crawler.ts 拆出，覆盖 POST /runs + GET /runs + GET /runs/:id 全系列
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { AuditLogService } from '@/api/services/AuditLogService'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import {
  listTasksByRunId,
  cancelPendingTasksByRun,
  requestCancelRunningTasksByRun,
} from '@/api/db/queries/crawlerTasks'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import { mapTaskDto } from './crawler.tasks'

export async function registerCrawlerRunRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const auditSvc = new AuditLogService(db)
  const runService = new CrawlerRunService(db)

  // ── POST /admin/crawler/runs — 统一触发入口 ────────────────
  fastify.post('/admin/crawler/runs', { preHandler: auth }, async (request, reply) => {
    const BodySchema = z.object({
      triggerType: z.enum(['single', 'batch', 'all']).default('single'),
      mode: z.enum(['incremental', 'full']).default('incremental'),
      siteKeys: z.array(z.string().min(1)).optional(),
      hoursAgo: z.number().int().min(1).max(720).optional(),
      timeoutSeconds: z.number().int().min(60).max(7200).optional(),
      crawlMode: z.enum(['batch', 'keyword', 'source-refetch']).optional(),
      keyword: z.string().min(1).max(100).optional(),
      targetVideoId: z.string().uuid().optional(),
    })
    const parsed = BodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const { triggerType, mode, siteKeys, hoursAgo, timeoutSeconds, crawlMode, keyword, targetVideoId } = parsed.data
    if ((triggerType === 'single' || triggerType === 'batch') && (!siteKeys || siteKeys.length === 0)) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'siteKeys 不能为空', status: 422 } })
    }
    if (crawlMode === 'keyword' && !keyword) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'crawlMode=keyword 时 keyword 必填', status: 422 } })
    }
    if (crawlMode === 'source-refetch' && !targetVideoId) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'crawlMode=source-refetch 时 targetVideoId 必填', status: 422 } })
    }
    try {
      const createdBy = (request.user as { userId?: string } | undefined)?.userId ?? null
      const result = await runService.createAndEnqueueRun({
        triggerType,
        mode,
        siteKeys,
        hoursAgo,
        timeoutSeconds,
        createdBy,
        crawlMode: crawlMode as 'batch' | 'keyword' | 'source-refetch' | undefined,
        keyword: keyword ?? null,
        targetVideoId: targetVideoId ?? null,
      })

      // CHG-SN-6-26-RETRO：审计 — crawler.run_create（统一触发入口）
      const runResult = result as { id?: string } & Record<string, unknown>
      auditSvc.write({
        actorId: request.user!.userId,
        actionType: 'crawler.run_create',
        targetKind: 'system',
        targetId: typeof runResult.id === 'string' ? runResult.id : 'run',
        afterJsonb: {
          triggerType, mode, siteKeys: siteKeys ?? null,
          hoursAgo: hoursAgo ?? null, crawlMode: crawlMode ?? null,
          keyword: keyword ?? null, targetVideoId: targetVideoId ?? null,
        },
        requestId: request.id,
      })

      return reply.code(202).send({ data: result })
    } catch (err) {
      return reply.code(503).send({
        error: {
          code: 'CRAWLER_QUEUE_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'run enqueue failed',
          status: 503,
        },
      })
    }
  })

  // ── GET /admin/crawler/runs ────────────────────────────────
  fastify.get('/admin/crawler/runs', { preHandler: auth }, async (request, reply) => {
    const QuerySchema = z.object({
      status: z.enum(['queued', 'running', 'paused', 'success', 'partial_failed', 'failed', 'cancelled']).optional(),
      triggerType: z.enum(['single', 'batch', 'all', 'schedule']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const { status, triggerType, page, limit } = parsed.data
    const { rows, total } = await crawlerRunsQueries.listRuns(db, {
      status, triggerType, limit, offset: (page - 1) * limit,
    })
    return reply.send({ data: rows, pagination: { total, page, limit, hasNext: page * limit < total } })
  })

  // ── GET /admin/crawler/runs/:id ────────────────────────────
  fastify.get('/admin/crawler/runs/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const run = await crawlerRunsQueries.getRunById(db, id)
    if (!run) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '批次不存在', status: 404 } })
    }
    await crawlerRunsQueries.syncRunStatusFromTasks(db, id)
    const refreshed = await crawlerRunsQueries.getRunById(db, id)
    return reply.send({ data: refreshed })
  })

  // ── GET /admin/crawler/runs/:id/tasks ──────────────────────
  fastify.get('/admin/crawler/runs/:id/tasks', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const QuerySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(500).default(200),
    })
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const { page, limit } = parsed.data
    const { rows, total } = await listTasksByRunId(db, id, { limit, offset: (page - 1) * limit })
    return reply.send({
      data: rows.map(mapTaskDto),
      pagination: { total, page, limit, hasNext: page * limit < total },
    })
  })

  // ── POST /admin/crawler/runs/:id/cancel ────────────────────
  fastify.post('/admin/crawler/runs/:id/cancel', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const run = await crawlerRunsQueries.getRunById(db, id)
    if (!run) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '批次不存在', status: 404 } })
    }
    await crawlerRunsQueries.updateRunControlStatus(db, id, 'cancelling')
    const cancelledPending = await cancelPendingTasksByRun(db, id)
    const signaledRunning = await requestCancelRunningTasksByRun(db, id)
    await crawlerRunsQueries.syncRunStatusFromTasks(db, id)
    const refreshed = await crawlerRunsQueries.getRunById(db, id)

    // CHG-SN-6-16-A：审计 — crawler_run.cancel
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'crawler_run.cancel',
      targetKind: 'system',
      targetId: id,
      beforeJsonb: { runId: id, status: run.status, controlStatus: run.controlStatus },
      afterJsonb: { runId: id, controlStatus: 'cancelling', cancelledPending, signaledRunning },
      requestId: request.id,
    })

    return reply.send({ data: { run: refreshed, cancelledPending, signaledRunning } })
  })

  // ── POST /admin/crawler/runs/:id/pause ─────────────────────
  fastify.post('/admin/crawler/runs/:id/pause', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const run = await crawlerRunsQueries.getRunById(db, id)
    if (!run) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '批次不存在', status: 404 } })
    }
    const nextControlStatus = run.status === 'running' ? 'pausing' : 'paused'
    await crawlerRunsQueries.updateRunControlStatus(db, id, nextControlStatus)
    await crawlerRunsQueries.syncRunStatusFromTasks(db, id)

    // CHG-SN-6-16-A：审计 — crawler_run.pause
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'crawler_run.pause',
      targetKind: 'system',
      targetId: id,
      beforeJsonb: { runId: id, status: run.status, controlStatus: run.controlStatus },
      afterJsonb: { runId: id, controlStatus: nextControlStatus },
      requestId: request.id,
    })

    return reply.send({ data: { runId: id, controlStatus: nextControlStatus } })
  })

  // ── POST /admin/crawler/runs/:id/resume ────────────────────
  fastify.post('/admin/crawler/runs/:id/resume', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const run = await crawlerRunsQueries.getRunById(db, id)
    if (!run) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '批次不存在', status: 404 } })
    }
    await crawlerRunsQueries.updateRunControlStatus(db, id, 'active')
    await crawlerRunsQueries.syncRunStatusFromTasks(db, id)

    // CHG-SN-6-16-A：审计 — crawler_run.resume
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'crawler_run.resume',
      targetKind: 'system',
      targetId: id,
      beforeJsonb: { runId: id, status: run.status, controlStatus: run.controlStatus },
      afterJsonb: { runId: id, controlStatus: 'active' },
      requestId: request.id,
    })

    return reply.send({ data: { runId: id, controlStatus: 'active' } })
  })
}
