/**
 * sources.ts — 播放源路由
 * GET  /videos/:id/sources         获取播放源列表（ADR-001: 直链）
 * POST /videos/:id/sources/:sid/report  举报失效播放源（需登录）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '@/api/lib/postgres'
import { SourceService, NotFoundError } from '@/api/services/SourceService'
import * as sourceQueries from '@/api/db/queries/sources'

const ReportReasonEnum = z.enum(['broken', 'low_quality', 'wrong_episode', 'other'])

export async function sourceRoutes(fastify: FastifyInstance) {
  const sourceService = new SourceService(db)

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
