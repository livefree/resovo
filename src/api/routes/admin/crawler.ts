/**
 * admin/crawler.ts — 爬虫任务管理后台接口
 * CRAWLER-04
 *
 * GET  /admin/crawler/tasks           — 任务列表（需 admin）
 * POST /admin/crawler/tasks           — 手动触发采集（需 admin）
 * POST /admin/sources/:id/verify      — 手动触发单条验证（需 admin）
 * POST /admin/sources/submit          — 用户投稿播放源（需登录）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { CrawlerService, parseCrawlerSources } from '@/api/services/CrawlerService'
import { VerifyService } from '@/api/services/VerifyService'
import { findSourceById } from '@/api/db/queries/sources'
import { listTasks } from '@/api/db/queries/crawlerTasks'
import { enqueueVerifySingle } from '@/api/workers/verifyWorker'
import { enqueueFullCrawl, enqueueIncrementalCrawl } from '@/api/workers/crawlerWorker'
import { es } from '@/api/lib/elasticsearch'

export async function adminCrawlerRoutes(fastify: FastifyInstance) {
  const crawlerService = new CrawlerService(db, es)
  const verifyService = new VerifyService(db)

  // ── GET /admin/crawler/tasks ──────────────────────────────────

  fastify.get(
    '/admin/crawler/tasks',
    { preHandler: [fastify.authenticate, fastify.requireRole(['admin'])] },
    async (request, reply) => {
      const QuerySchema = z.object({
        status: z.enum(['pending', 'running', 'done', 'failed']).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
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
        pagination: {
          total,
          page,
          limit,
          hasNext: page * limit < total,
        },
      })
    }
  )

  // ── POST /admin/crawler/tasks — 手动触发采集 ─────────────────

  fastify.post(
    '/admin/crawler/tasks',
    { preHandler: [fastify.authenticate, fastify.requireRole(['admin'])] },
    async (request, reply) => {
      const BodySchema = z.object({
        type: z.enum(['full-crawl', 'incremental-crawl']).default('incremental-crawl'),
        sourceUrl: z.string().url().optional(),
        hoursAgo: z.number().int().min(1).max(720).optional(),
      })

      const parsed = BodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
        })
      }

      const { type, sourceUrl, hoursAgo } = parsed.data

      if (type === 'full-crawl') {
        const job = await enqueueFullCrawl(sourceUrl)
        return reply.code(202).send({ data: { jobId: job.id, type } })
      } else {
        const job = await enqueueIncrementalCrawl(sourceUrl, hoursAgo ?? 24)
        return reply.code(202).send({ data: { jobId: job.id, type } })
      }
    }
  )

  // ── POST /admin/sources/:id/verify — 管理员触发单条验证 ──────

  fastify.post(
    '/admin/sources/:id/verify',
    { preHandler: [fastify.authenticate, fastify.requireRole(['admin'])] },
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

  // ── POST /admin/sources/submit — 用户投稿播放源 ──────────────
  // 注意：submit 路由必须在 :id 之前注册，避免被识别为 id

  fastify.post(
    '/admin/sources/submit',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const BodySchema = z.object({
        videoId: z.string().uuid(),
        sourceUrl: z.string().url().max(2000),
        sourceName: z.string().max(100).default('用户投稿'),
        episodeNumber: z.number().int().positive().nullable().default(null),
      })

      const parsed = BodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
        })
      }

      const { videoId, sourceUrl, sourceName, episodeNumber } = parsed.data

      // 投稿进入高优先级验证队列（is_active 默认 false，验证通过后才激活）
      // 先在 DB 创建非活跃记录，再触发验证
      await db.query(
        `INSERT INTO video_sources
           (video_id, episode_number, source_url, source_name, type, is_active, submitted_by)
         VALUES ($1, $2, $3, $4, 'hls', false, $5)
         ON CONFLICT (video_id, source_url) DO NOTHING`,
        [videoId, episodeNumber, sourceUrl, sourceName, request.user!.userId]
      )

      // 查询刚插入的 source id
      const result = await db.query<{ id: string }>(
        `SELECT id FROM video_sources WHERE video_id = $1 AND source_url = $2`,
        [videoId, sourceUrl]
      )

      if (result.rows[0]) {
        await verifyService.verifyFromUserReport(result.rows[0].id, sourceUrl)
      }

      return reply.code(202).send({
        data: { message: '投稿已接收，正在验证可用性' },
      })
    }
  )

  // ── POST /admin/crawler/reindex — 重建 ES 索引 ───────────────
  // 用于修复 ES 文档缺失字段（如 cover_url）时全量重新索引

  fastify.post(
    '/admin/crawler/reindex',
    { preHandler: [fastify.authenticate, fastify.requireRole(['admin'])] },
    async (_request, reply) => {
      const result = await crawlerService.reindexAll()
      return reply.send({ data: result })
    }
  )
}
