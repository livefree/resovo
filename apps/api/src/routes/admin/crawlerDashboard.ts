/**
 * admin/crawlerDashboard.ts — Crawler 重做 dashboard 专用 4 端点（CHG-SN-7-REDO-01-B / ADR-122）
 *
 * 端点：
 *   GET    /admin/crawler/kpi                    — 5 KPI + siteStats（dashboard 头部）
 *   GET    /admin/crawler/timeline?range&limit   — 实时任务时间轴
 *   POST   /admin/crawler/sites/:key/run         — 单站触发采集（runService alias）
 *   POST   /admin/crawler/run-all                — 全站触发采集（runService alias）
 *
 * 设计决策（ADR-122）：
 *   - D-122-1：文件归属方案 A（单文件 / crawler.ts 960 行不可追加）
 *   - D-122-3：POST 端点委托 runService.createAndEnqueueRun
 *   - D-122-5：audit 复用 'crawler.run_create' actionType + afterJsonb.triggerType 区分
 *              → ADR-121 7 文件框架降为 4 文件框架（不扩 types/ACTION_TYPES/两 set-equal）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { getCrawlerKpi } from '@/api/db/queries/crawlerKpi'
import {
  getCrawlerTimeline,
  type CrawlerTimelineRange,
} from '@/api/db/queries/crawlerTimeline'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import { AuditLogService } from '@/api/services/AuditLogService'

const TimelineQuerySchema = z.object({
  range: z.enum(['30m', '1h', '2h', '6h']).default('1h'),
  limit: z.coerce.number().int().min(1).max(20).default(8),
})

const RunModeSchema = z.object({
  mode: z.enum(['incremental', 'full']).optional(),
})

const SITE_KEY_RE = /^[a-zA-Z0-9_.\-]+$/

export async function adminCrawlerDashboardRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const auditSvc = new AuditLogService(db)
  const runService = new CrawlerRunService(db)

  // ── GET /admin/crawler/kpi ───────────────────────────────────

  fastify.get('/admin/crawler/kpi', { preHandler: auth }, async (_request, reply) => {
    const data = await getCrawlerKpi(db)
    return reply.send({ data })
  })

  // ── GET /admin/crawler/timeline ──────────────────────────────

  fastify.get('/admin/crawler/timeline', { preHandler: auth }, async (request, reply) => {
    const parsed = TimelineQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'range/limit 参数错误',
          status: 422,
        },
      })
    }
    const data = await getCrawlerTimeline(
      db,
      parsed.data.range as CrawlerTimelineRange,
      parsed.data.limit,
    )
    return reply.send({ data })
  })

  // ── POST /admin/crawler/sites/:key/run ───────────────────────

  fastify.post('/admin/crawler/sites/:key/run', { preHandler: auth }, async (request, reply) => {
    const params = request.params as { key?: string } | undefined
    const key = params?.key
    if (!key || !SITE_KEY_RE.test(key) || key.length > 100) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'site key 不合法', status: 422 },
      })
    }

    const site = await crawlerSitesQueries.findCrawlerSite(db, key)
    if (!site) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: `site key "${key}" 不存在`, status: 404 },
      })
    }

    const parsed = RunModeSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'mode 参数错误', status: 422 },
      })
    }
    const mode = parsed.data.mode ?? 'incremental'

    try {
      const createdBy = (request.user as { userId?: string } | undefined)?.userId ?? null
      const result = await runService.createAndEnqueueRun({
        triggerType: 'single',
        mode,
        siteKeys: [key],
        createdBy,
      })

      // ADR-121 4 文件框架 / ADR-122 D-122-5：复用 'crawler.run_create' actionType
      auditSvc.write({
        actorId: request.user!.userId,
        actionType: 'crawler.run_create',
        targetKind: 'crawler_site',
        targetId: key,
        afterJsonb: {
          triggerType: 'single',
          mode,
          siteKeys: [key],
          runId: result.runId,
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

  // ── POST /admin/crawler/run-all ──────────────────────────────

  fastify.post('/admin/crawler/run-all', { preHandler: auth }, async (request, reply) => {
    const parsed = RunModeSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'mode 参数错误', status: 422 },
      })
    }
    const mode = parsed.data.mode ?? 'full'

    try {
      const createdBy = (request.user as { userId?: string } | undefined)?.userId ?? null
      const result = await runService.createAndEnqueueRun({
        triggerType: 'all',
        mode,
        createdBy,
      })

      auditSvc.write({
        actorId: request.user!.userId,
        actionType: 'crawler.run_create',
        targetKind: 'system',
        targetId: result.runId,
        afterJsonb: {
          triggerType: 'all',
          mode,
          runId: result.runId,
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
}
