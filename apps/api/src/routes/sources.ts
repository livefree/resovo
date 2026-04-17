/**
 * sources.ts — 播放源路由
 * GET  /videos/:id/sources              获取播放源列表（ADR-001: 直链）
 * POST /sources/:id/report-error        播放器上报加载失败（公开，冷却限速）
 * POST /videos/:id/sources/:sid/report  举报失效播放源（需登录）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '@/api/lib/postgres'
import { SourceService, NotFoundError } from '@/api/services/SourceService'
import * as sourceQueries from '@/api/db/queries/sources'
import { VerifyService } from '@/api/services/VerifyService'
import { enqueueVerifySingle } from '@/api/workers/verifyWorker'

// ── 内存冷却：同一源 5 分钟内只入队一次 ──────────────────────────
const COOLDOWN_MS = 5 * 60 * 1000
const reportCooldown = new Map<string, number>()

const ReportReasonEnum = z.enum(['broken', 'low_quality', 'wrong_episode', 'other'])

export async function sourceRoutes(fastify: FastifyInstance) {
  const sourceService = new SourceService(db)
  const verifyService = new VerifyService(db)

  // ── GET /videos/:id/sources ──────────────────────────────────
  fastify.get('/videos/:id/sources', async (request, reply) => {
    const { id } = request.params as { id: string }

    const QuerySchema = z.object({
      episode: z.coerce.number().int().min(1).optional(),
    })
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    try {
      const sources = await sourceService.listSources(id, parsed.data.episode)
      return reply.send({ data: sources })
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: error.message, status: 404 },
        })
      }
      request.log.error({ error }, 'listSources failed')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '获取播放源失败', status: 500 },
      })
    }
  })

  // ── POST /sources/submit — 用户投稿播放源 ────────────────────
  fastify.post(
    '/sources/submit',
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

      await db.query(
        `INSERT INTO video_sources
           (video_id, episode_number, source_url, source_name, type, is_active, submitted_by)
         VALUES ($1, $2, $3, $4, 'hls', false, $5)
         ON CONFLICT (video_id, source_url) DO NOTHING`,
        [videoId, episodeNumber, sourceUrl, sourceName, request.user!.userId]
      )

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

  // ── POST /sources/:id/report-error ───────────────────────────
  fastify.post('/sources/:id/report-error', async (request, reply) => {
    const { id } = request.params as { id: string }

    // 冷却限速：同一源 5 分钟内只入队一次
    const lastReport = reportCooldown.get(id)
    if (lastReport !== undefined && Date.now() - lastReport < COOLDOWN_MS) {
      return reply.code(429).send({
        error: { code: 'RATE_LIMITED', message: '上报过于频繁，请稍后再试', status: 429 },
      })
    }

    const source = await sourceQueries.findSourceById(db, id)
    if (!source) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '播放源不存在', status: 404 },
      })
    }

    reportCooldown.set(id, Date.now())
    await enqueueVerifySingle(id, source.sourceUrl)

    return reply.code(202).send({
      data: { message: '已收到上报，后台将验证可用性' },
    })
  })

  // ── POST /videos/:id/sources/:sid/report ─────────────────────
  fastify.post(
    '/videos/:id/sources/:sid/report',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sid } = request.params as { id: string; sid: string }

      const parsed = ReportReasonEnum.safeParse(
        (request.body as { reason?: unknown })?.reason
      )
      if (!parsed.success) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: '举报原因无效，可选值：broken, low_quality, wrong_episode, other',
            status: 422,
          },
        })
      }

      // 确认播放源存在
      const source = await sourceQueries.findSourceById(db, sid)
      if (!source) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '播放源不存在', status: 404 },
        })
      }

      // 记录举报日志（future: 写入举报表；当前简化为只记录日志）
      request.log.info(
        { sourceId: sid, reason: parsed.data, reportedBy: request.user?.userId },
        'source reported'
      )

      return reply.code(204).send()
    }
  )
}
