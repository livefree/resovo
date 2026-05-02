/**
 * admin/videoSources.ts — 视频线路管理接口（CHG-SN-4-05）
 *
 * PATCH /admin/videos/:id/sources/:sourceId  线路 toggle
 * POST  /admin/videos/:id/sources/disable-dead  批量禁用 dead 线路
 * POST  /admin/videos/:id/refetch-sources  触发线路重新抓取
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { es } from '@/api/lib/elasticsearch'
import { ModerationService } from '@/api/services/ModerationService'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import { findAdminVideoById } from '@/api/db/queries/videos'

const SourcePatchSchema = z.object({
  isActive: z.boolean(),
})

export async function adminVideoSourcesRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const moderationSvc = new ModerationService(db, es)
  const runService = new CrawlerRunService(db)

  // ── PATCH /admin/videos/:id/sources/:sourceId — 线路 toggle（CHG-SN-4-05）──
  fastify.patch('/admin/videos/:id/sources/:sourceId', { preHandler: auth }, async (request, reply) => {
    const { id, sourceId } = request.params as { id: string; sourceId: string }
    const parsed = SourcePatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    try {
      const result = await moderationSvc.toggleSource({
        videoId: id,
        sourceId,
        isActive: parsed.data.isActive,
        actorId: request.user!.userId,
        requestId: request.id,
      })
      if (!result) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '线路不存在', status: 404 } })
      }
      return reply.send({ data: result })
    } catch (err) {
      request.log.error({ err }, 'source toggle unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── POST /admin/videos/:id/sources/disable-dead（CHG-SN-4-05）───
  fastify.post('/admin/videos/:id/sources/disable-dead', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const result = await moderationSvc.disableDead({
        videoId: id,
        actorId: request.user!.userId,
        requestId: request.id,
      })
      return reply.send({ data: result })
    } catch (err) {
      request.log.error({ err }, 'disable-dead unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── POST /admin/videos/:id/refetch-sources ────────────────────
  // CRAWLER-04: 创建 source-refetch run，进入 run/task/queue，不同步执行
  fastify.post('/admin/videos/:id/refetch-sources', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (!/^[0-9a-f-]{36}$/.test(id)) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    const BodySchema = z.object({
      siteKeys: z.array(z.string().min(1)).optional(),
    })
    const parsed = BodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const video = await findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    const siteKeys = parsed.data.siteKeys
    const hasSiteFilter = (siteKeys ?? []).length > 0
    const result = await runService.createAndEnqueueRun({
      triggerType: hasSiteFilter ? 'batch' : 'all',
      mode: 'incremental',
      crawlMode: 'source-refetch',
      targetVideoId: id,
      ...(hasSiteFilter ? { siteKeys } : {}),
    })
    return reply.code(202).send({ data: result })
  })
}
