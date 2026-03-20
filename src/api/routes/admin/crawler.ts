/**
 * admin/crawler.ts — 爬虫任务管理后台接口
 * CHG-36: 支持 siteKey 参数；新增 GET /admin/crawler/sites-status
 *
 * GET  /admin/crawler/tasks           — 任务列表（需 admin）
 * POST /admin/crawler/tasks           — 手动触发采集（需 admin）
 * GET  /admin/crawler/sites-status    — 各源站采集状态（需 admin）
 * POST /admin/sources/:id/verify      — 手动触发单条验证（需 admin）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { CrawlerService } from '@/api/services/CrawlerService'
import { findSourceById } from '@/api/db/queries/sources'
import {
  listTasks,
  findActiveTaskBySite,
  getLatestTaskBySite,
  getLatestTasksBySites,
  type CrawlerTask,
} from '@/api/db/queries/crawlerTasks'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import { enqueueVerifySingle } from '@/api/workers/verifyWorker'
import { enqueueFullCrawl, enqueueIncrementalCrawl } from '@/api/workers/crawlerWorker'
import { es } from '@/api/lib/elasticsearch'

export async function adminCrawlerRoutes(fastify: FastifyInstance) {
  const crawlerService = new CrawlerService(db, es)
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/crawler/tasks ──────────────────────────────────

  fastify.get('/admin/crawler/tasks', { preHandler: auth }, async (request, reply) => {
    const QuerySchema = z.object({
      status: z.enum(['pending', 'running', 'done', 'failed']).optional(),
      page:   z.coerce.number().int().min(1).default(1),
      limit:  z.coerce.number().int().min(1).max(100).default(20),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { status, page, limit } = parsed.data
    const { rows, total } = await listTasks(db, {
      status,
      limit,
      offset: (page - 1) * limit,
    })

    return reply.send({
      data: rows,
      pagination: { total, page, limit, hasNext: page * limit < total },
    })
  })

  // ── POST /admin/crawler/tasks — 手动触发采集 ─────────────────

  fastify.post('/admin/crawler/tasks', { preHandler: auth }, async (request, reply) => {
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
    }

    if (type === 'full-crawl') {
      const job = await enqueueFullCrawl(siteKey)
      return reply.code(202).send({ data: { jobId: job.id, type, siteKey } })
    } else {
      const job = await enqueueIncrementalCrawl(siteKey, hoursAgo ?? 24)
      return reply.code(202).send({ data: { jobId: job.id, type, siteKey } })
    }
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
      const source = await findSourceById(db, id)

      if (!source) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '播放源不存在', status: 404 },
        })
      }

      const job = await enqueueVerifySingle(id, source.sourceUrl)
      return reply.code(202).send({ data: { jobId: job.id, sourceId: id } })
    }
  )

  // ── POST /admin/crawler/reindex — 重建 ES 索引 ───────────────

  fastify.post('/admin/crawler/reindex', { preHandler: auth }, async (_request, reply) => {
    const result = await crawlerService.reindexAll()
    return reply.send({ data: result })
  })
}
  function mapTaskDto(task: CrawlerTask) {
    const mode = task.type === 'incremental-crawl' ? 'incremental' : 'full'
    const status =
      task.status === 'pending'
        ? 'queued'
        : task.status === 'running'
          ? 'running'
          : task.status === 'done'
            ? 'success'
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
      startedAt: null as string | null,
      finishedAt: task.finishedAt,
      message,
      itemCount,
    }
  }
