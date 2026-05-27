/**
 * admin/crawler.ts — 爬虫任务管理后台接口（主路由聚合）
 * CHG-36: 支持 siteKey 参数；新增 GET /admin/crawler/sites-status
 *
 * 任务/批次路由已拆分到子文件：
 *   crawler.tasks.ts — GET/POST /tasks, /stop-all, /freeze, /tasks/:id, /tasks/latest
 *   crawler.runs.ts  — POST/GET /runs, /runs/:id, /runs/:id/cancel, /pause, /resume
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { CrawlerService } from '@/api/services/CrawlerService'
import { CrawlerPreviewService } from '@/api/services/CrawlerPreviewService'
import { CrawlerRefetchService } from '@/api/services/CrawlerRefetchService'
import { ContentService } from '@/api/services/ContentService'
import { AuditLogService } from '@/api/services/AuditLogService'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import { getEnabledSources } from '@/api/workers/crawlerWorker'
import {
  getCrawlerOverview,
  countOrphanActiveTasks,
} from '@/api/db/queries/crawlerTasks'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import { es } from '@/api/lib/elasticsearch'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import { findAdminVideoById } from '@/api/db/queries/videos'
import { registerCrawlerTaskRoutes } from './crawler.tasks'
import { registerCrawlerRunRoutes } from './crawler.runs'
// CW1-E-EP step 1a / ADR-152 G-152-1：computeNextTrigger 抽到 lib/ 复用
import { computeNextTrigger } from '@/api/lib/crawler-scheduling'

export async function adminCrawlerRoutes(fastify: FastifyInstance) {
  const crawlerService = new CrawlerService(db, es)
  const previewService = new CrawlerPreviewService(db, es)
  const refetchService = new CrawlerRefetchService(db, es)
  const contentService = new ContentService(db)
  const runService = new CrawlerRunService(db)
  const auditSvc = new AuditLogService(db)
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ADR-155 D-155-6 / EP-1C-1b R-155-6：兼容旧 {dailyTime} POST + 新 {dailyTimes} POST
  // ADR-155 D-155-6 CLEANUP-C：dailyTimes 主字段（required min 1 max 24）；dailyTime alias 已删
  const HHMM = /^\d{2}:\d{2}$/
  const AutoCrawlConfigSchema = z.object({
    globalEnabled: z.boolean(),
    // ADR-154 D-154-1：scheduleType 两态（向后兼容 default='daily'）
    scheduleType: z.enum(['daily', 'interval']).default('daily'),
    // ADR-155 D-155-6 CLEANUP-C：dailyTimes 唯一字段（min 1 max 24）
    dailyTimes: z.array(z.string().regex(HHMM)).min(1).max(24),
    // ADR-154 D-154-1：intervalMinutes min=5（< TICK_MS=60s 无意义），max=1440（1 天）
    intervalMinutes: z.number().int().min(5).max(1440).default(60),
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

    // CHG-SN-6-25-RETRO：审计 — crawler.auto_config（before 取当前 config）
    const beforeConfig = await systemSettingsQueries.getAutoCrawlConfig(db)

    await systemSettingsQueries.setAutoCrawlConfig(db, parsed.data)

    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'crawler.auto_config',
      targetKind: 'system',
      targetId: 'auto_crawl_config',
      beforeJsonb: { config: beforeConfig },
      afterJsonb: { config: parsed.data },
      requestId: request.id,
    })

    return reply.send({ data: { ok: true } })
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
    const [freeze, orphanTaskCount, autoConfig] = await Promise.all([
      systemSettingsQueries.getSetting(db, 'crawler_global_freeze'),
      countOrphanActiveTasks(db),
      systemSettingsQueries.getAutoCrawlConfig(db),
    ])
    const schedulerEnabled = process.env.CRAWLER_SCHEDULER_ENABLED === 'true'
    return reply.send({
      data: {
        schedulerEnabled,
        freezeEnabled: freeze === 'true',
        orphanTaskCount,
        autoCrawlNext: computeNextTrigger(autoConfig),
      },
    })
  })

  // ── GET /admin/crawler/monitor-snapshot ──────────────────────
  // 聚合接口：一次返回 overview + runs（最近 20 条）+ systemStatus
  // 供 useCrawlerMonitor 使用，将 3 个独立轮询请求合并为 1 个
  fastify.get('/admin/crawler/monitor-snapshot', { preHandler: auth }, async (_request, reply) => {
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

  // ── POST /admin/crawler/keyword-preview — 关键词搜索预览 ─────
  // CRAWLER-03: 对各启用站点执行关键词搜索，返回匹配视频预览（不写库）

  fastify.post('/admin/crawler/keyword-preview', { preHandler: auth }, async (request, reply) => {
    const BodySchema = z.object({
      keyword: z.string().min(1).max(100),
      siteKeys: z.array(z.string().min(1)).optional(),
      type: z.string().optional(),
    })
    const parsed = BodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const { keyword, siteKeys, type } = parsed.data

    let sources = await getEnabledSources(db)
    if (siteKeys && siteKeys.length > 0) {
      sources = sources.filter((s) => siteKeys.includes(s.name))
    }

    if (sources.length === 0) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '没有可用的采集站点', status: 422 },
      })
    }

    const results = await previewService.previewKeywordSearch(keyword, sources, type)
    return reply.send({ data: { keyword, results } })
  })

  // ── POST /admin/crawler/refetch-sources — 单视频补源采集（入队） ──
  // CRAWLER-04: 创建 source-refetch run，进入 run/task/queue，不同步执行

  fastify.post('/admin/crawler/refetch-sources', { preHandler: auth }, async (request, reply) => {
    const BodySchema = z.object({
      videoId: z.string().uuid(),
      siteKeys: z.array(z.string().min(1)).optional(),
    })
    const parsed = BodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const { videoId, siteKeys } = parsed.data

    const video = await findAdminVideoById(db, videoId)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    const hasSiteFilter = (siteKeys ?? []).length > 0
    const result = await runService.createAndEnqueueRun({
      triggerType: hasSiteFilter ? 'batch' : 'all',
      mode: 'incremental',
      crawlMode: 'source-refetch',
      targetVideoId: videoId,
      ...(hasSiteFilter ? { siteKeys } : {}),
    })
    // CHG-SN-4-10-A2：admin 触发补源采集 → 写 audit（video.refetch_sources）
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'video.refetch_sources',
      targetKind: 'video',
      targetId: videoId,
      afterJsonb: { triggeredAt: new Date().toISOString(), siteKeys: siteKeys ?? null },
      requestId: request.id,
    })
    return reply.code(202).send({ data: result })
  })

  // ── POST /admin/crawler/reindex — 重建 ES 索引 ───────────────

  fastify.post('/admin/crawler/reindex', { preHandler: auth }, async (request, reply) => {
    const result = await crawlerService.reindexAll()

    // CHG-SN-6-26-RETRO：审计 — crawler.reindex（ES 重建索引 / 全局操作）
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'crawler.reindex',
      targetKind: 'system',
      targetId: 'reindex',
      afterJsonb: { result, triggeredAt: new Date().toISOString() },
      requestId: request.id,
    })

    return reply.send({ data: result })
  })

  // ── 子路由注册 ──────────────────────────────────────────────
  await registerCrawlerTaskRoutes(fastify)
  await registerCrawlerRunRoutes(fastify)
}
