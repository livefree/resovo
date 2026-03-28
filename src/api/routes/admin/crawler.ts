/**
 * admin/crawler.ts — 爬虫任务管理后台接口
 * CHG-36: 支持 siteKey 参数；新增 GET /admin/crawler/sites-status
 *
 * GET  /admin/crawler/tasks           — 任务列表（需 admin）
 * POST /admin/crawler/tasks           — 手动触发采集（需 admin）
 * GET  /admin/crawler/sites-status    — 各源站采集状态（需 admin）
 * POST /admin/sources/:id/verify      — 手动触发单条同步验证（需 moderator+）
 * POST /admin/sources/batch-verify    — 按范围批量验证播放源（需 moderator+）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { CrawlerService } from '@/api/services/CrawlerService'
import { ContentService } from '@/api/services/ContentService'
import {
  listTasks,
  listTasksByRunId,
  cancelPendingTasksByRun,
  requestCancelRunningTasksByRun,
  cancelAllActiveTasks,
  findActiveTaskBySite,
  getLatestTaskBySite,
  getLatestTasksBySites,
  getCrawlerOverview,
  countOrphanActiveTasks,
  markStalePendingTasks,
  type CrawlerTask,
} from '@/api/db/queries/crawlerTasks'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import { es } from '@/api/lib/elasticsearch'
import { crawlerQueue } from '@/api/lib/queue'
import { createCrawlerTaskLog, listCrawlerTaskLogs } from '@/api/db/queries/crawlerTaskLogs'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'

function mapTaskDto(task: CrawlerTask) {
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

export async function adminCrawlerRoutes(fastify: FastifyInstance) {
  const crawlerService = new CrawlerService(db, es)
  const contentService = new ContentService(db)
  const runService = new CrawlerRunService(db)
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const logTask = async (input: Parameters<typeof createCrawlerTaskLog>[1]) => {
    try {
      await createCrawlerTaskLog(db, input)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      fastify.log.warn({ err: message, input }, 'failed to persist crawler task log')
    }
  }

  const AutoCrawlConfigSchema = z.object({
    globalEnabled: z.boolean(),
    scheduleType: z.literal('daily').default('daily'),
    dailyTime: z.string().regex(/^\d{2}:\d{2}$/),
    defaultMode: z.enum(['incremental', 'full']),
    onlyEnabledSites: z.boolean(),
    conflictPolicy: z.enum(['skip_running', 'queue_after_running']),
    perSiteOverrides: z.record(
      z.string().min(1),
      z.object({
        enabled: z.boolean(),
        mode: z.enum(['inherit', 'incremental', 'full']),
      }),
    ).default({}),
  })

  // ── GET /admin/crawler/auto-config ─────────────────────────
  fastify.get('/admin/crawler/auto-config', { preHandler: auth }, async (_request, reply) => {
    const config = await systemSettingsQueries.getAutoCrawlConfig(db)
    return reply.send({ data: config })
  })

  // ── POST /admin/crawler/auto-config ────────────────────────
  fastify.post('/admin/crawler/auto-config', { preHandler: auth }, async (request, reply) => {
    const parsed = AutoCrawlConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    await systemSettingsQueries.setAutoCrawlConfig(db, parsed.data)
    return reply.send({ data: { ok: true } })
  })

  // ── GET /admin/crawler/tasks ──────────────────────────────────

  fastify.get('/admin/crawler/tasks', { preHandler: auth }, async (request, reply) => {
    const QuerySchema = z.object({
      status: z.enum(['pending', 'running', 'paused', 'done', 'failed', 'cancelled', 'timeout']).optional(),
      triggerType: z.enum(['single', 'batch', 'all', 'schedule']).optional(),
      runId: z.string().uuid().optional(),
      page:   z.coerce.number().int().min(1).default(1),
      limit:  z.coerce.number().int().min(1).max(100).default(20),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { status, triggerType, runId, page, limit } = parsed.data
    const { rows, total } = await listTasks(db, {
      status,
      triggerType,
      runId,
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

    if (freeze) {
      await systemSettingsQueries.setSetting(db, 'crawler_global_freeze', 'true')
    }

    const { count: runMarked, runIds: cancelledRunIds } = await crawlerRunsQueries.requestCancelAllActiveRuns(db)
    const taskChanges = await cancelAllActiveTasks(db)

    // Sync run status immediately so control_status transitions from 'cancelling' → 'cancelled'
    // without waiting for the next watchdog tick (up to 60 seconds).
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

    await systemSettingsQueries.setSetting(db, 'crawler_global_freeze', parsed.data.enabled ? 'true' : 'false')
    const freeze = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')
    const orphanTaskCount = await countOrphanActiveTasks(db)
    const schedulerEnabled = process.env.CRAWLER_SCHEDULER_ENABLED === 'true'

    return reply.send({
      data: {
        schedulerEnabled,
        freezeEnabled: freeze === 'true',
        orphanTaskCount,
      },
    })
  })

  // ── POST /admin/crawler/runs — 统一触发入口 ────────────────
  fastify.post('/admin/crawler/runs', { preHandler: auth }, async (request, reply) => {
    const BodySchema = z.object({
      triggerType: z.enum(['single', 'batch', 'all']).default('single'),
      mode: z.enum(['incremental', 'full']).default('incremental'),
      siteKeys: z.array(z.string().min(1)).optional(),
      hoursAgo: z.number().int().min(1).max(720).optional(),
      timeoutSeconds: z.number().int().min(60).max(7200).optional(),
    })
    const parsed = BodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const { triggerType, mode, siteKeys, hoursAgo, timeoutSeconds } = parsed.data
    if ((triggerType === 'single' || triggerType === 'batch') && (!siteKeys || siteKeys.length === 0)) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'siteKeys 不能为空', status: 422 } })
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
      status,
      triggerType,
      limit,
      offset: (page - 1) * limit,
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
    const { rows, total } = await listTasksByRunId(db, id, {
      limit,
      offset: (page - 1) * limit,
    })
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
    return reply.send({
      data: {
        run: refreshed,
        cancelledPending,
        signaledRunning,
      },
    })
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
    return reply.send({ data: { runId: id, controlStatus: 'active' } })
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

  // ── GET /admin/crawler/sites-status ──────────────────────────

  fastify.get('/admin/crawler/sites-status', { preHandler: auth }, async (_request, reply) => {
    const sites = await crawlerSitesQueries.listCrawlerSites(db)
    return reply.send({
      data: sites.map((s) => ({
        key:             s.key,
        name:            s.name,
        apiUrl:          s.apiUrl,
        disabled:        s.disabled,
        weight:          s.weight,
        lastCrawledAt:   s.lastCrawledAt,
        lastCrawlStatus: s.lastCrawlStatus,
      })),
    })
  })

  // ── GET /admin/crawler/overview ──────────────────────────────

  fastify.get('/admin/crawler/overview', { preHandler: auth }, async (_request, reply) => {
    const data = await getCrawlerOverview(db)
    return reply.send({ data })
  })

  // ── GET /admin/crawler/system-status ─────────────────────────
  fastify.get('/admin/crawler/system-status', { preHandler: auth }, async (_request, reply) => {
    const freeze = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')
    const orphanTaskCount = await countOrphanActiveTasks(db)
    const schedulerEnabled = process.env.CRAWLER_SCHEDULER_ENABLED === 'true'
    return reply.send({
      data: {
        schedulerEnabled,
        freezeEnabled: freeze === 'true',
        orphanTaskCount,
      },
    })
  })

  // ── GET /admin/crawler/monitor-snapshot ──────────────────────
  // 聚合接口：一次返回 overview + runs（最近 20 条）+ systemStatus
  // 供 useCrawlerMonitor 使用，将 3 个独立轮询请求合并为 1 个
  fastify.get('/admin/crawler/monitor-snapshot', { preHandler: auth }, async (_request, reply) => {
    // 实时同步所有活跃状态的任务批次数据，确保前台能准确实时获取到 item-level 数据(包含进度和统计信息)
    const activeRunIds = await crawlerRunsQueries.listActiveRunIds(db)
    for (const runId of activeRunIds) {
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    }

    const [overview, runsResult, systemStatusData] = await Promise.all([
      getCrawlerOverview(db),
      crawlerRunsQueries.listRuns(db, { limit: 20, offset: 0 }),
      (async () => {
        const freeze = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')
        const orphanTaskCount = await countOrphanActiveTasks(db)
        return {
          schedulerEnabled: process.env.CRAWLER_SCHEDULER_ENABLED === 'true',
          freezeEnabled: freeze === 'true',
          orphanTaskCount,
        }
      })(),
    ])
    return reply.send({
      data: {
        overview,
        runs: runsResult.rows,
        systemStatus: systemStatusData,
      },
    })
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

  // ── GET /admin/crawler/sites/:key/latest-task ──────────────

  fastify.get('/admin/crawler/sites/:key/latest-task', { preHandler: auth }, async (request, reply) => {
    const { key } = request.params as { key: string }
    const task = await getLatestTaskBySite(db, key)
    return reply.send({ data: { task: task ? mapTaskDto(task) : null } })
  })

  // ── POST /admin/sources/:id/verify — 管理员触发单条验证 ──────

  fastify.post(
    '/admin/sources/:id/verify',
    { preHandler: [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const result = await contentService.verifySource(id)

      if (!result) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '播放源不存在', status: 404 },
        })
      }

      return reply.send({ data: result })
    }
  )

  // ── POST /admin/sources/batch-verify — 按范围批量验证 ────────

  fastify.post(
    '/admin/sources/batch-verify',
    { preHandler: [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])] },
    async (request, reply) => {
      const BatchVerifySchema = z.object({
        scope: z.enum(['video', 'site', 'video_site']),
        videoId: z.string().uuid().optional(),
        siteKey: z.string().trim().min(1).max(100).optional(),
        activeOnly: z.boolean().optional().default(true),
        limit: z.coerce.number().int().min(1).max(500).optional().default(200),
      })

      const parsed = BatchVerifySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
        })
      }

      const { scope, videoId, siteKey, activeOnly, limit } = parsed.data
      if (scope === 'video' && !videoId) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: 'scope=video 时必须传 videoId', status: 422 },
        })
      }
      if (scope === 'site' && !siteKey) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: 'scope=site 时必须传 siteKey', status: 422 },
        })
      }
      if (scope === 'video_site' && (!videoId || !siteKey)) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: 'scope=video_site 时必须同时传 videoId 和 siteKey', status: 422 },
        })
      }

      const result = await contentService.batchVerifySources({
        scope,
        videoId,
        siteKey,
        activeOnly,
        limit,
      })
      return reply.send({ data: result })
    },
  )

  // ── POST /admin/crawler/reindex — 重建 ES 索引 ───────────────

  fastify.post('/admin/crawler/reindex', { preHandler: auth }, async (_request, reply) => {
    const result = await crawlerService.reindexAll()
    return reply.send({ data: result })
  })
}
