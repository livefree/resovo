/**
 * admin/videoSources.ts — 视频线路管理接口（CHG-SN-4-05）
 *
 * PATCH /admin/videos/:id/sources/:sourceId  线路 toggle
 * POST  /admin/videos/:id/sources/disable-dead  批量禁用 dead 线路
 * POST  /admin/videos/:id/refetch-sources  触发线路重新抓取
 * POST  /admin/videos/:videoId/sources/batch-probe  视频级全线路批量探测（CHG-357 / ADR-158 AMENDMENT 2）
 * POST  /admin/videos/:videoId/sources/batch-render-check  视频级全线路批量试播（CHG-357 / ADR-158 AMENDMENT 2）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { es } from '@/api/lib/elasticsearch'
import { ModerationService } from '@/api/services/ModerationService'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import { AuditLogService } from '@/api/services/AuditLogService'
import { SourceProbeService } from '@/api/services/SourceProbeService'
import { isAppError } from '@/api/lib/errors'
import { findAdminVideoById } from '@/api/db/queries/videos'

const SourcePatchSchema = z.object({
  isActive: z.boolean(),
  // CHG-SN-5-PRE-01-C：可选乐观锁；前端从 GET 响应携带，并发场景下后写者收 409 REVIEW_RACE。
  expectedUpdatedAt: z.string().datetime().optional(),
})

const BatchVideoIdSchema = z.object({ videoId: z.string().uuid() }).strict()

// ADR-198：admin 真实播放反馈 body 契约（success 必填；分辨率/缓冲/错误码可选）
const PlaybackVerifySchema = z
  .object({
    success: z.boolean(),
    resolutionWidth: z.number().int().positive().optional(),
    resolutionHeight: z.number().int().positive().optional(),
    bufferingCount: z.number().int().nonnegative().optional(),
    errorCode: z.string().max(64).optional(),
  })
  .strict()

const UUID_RE = /^[0-9a-f-]{36}$/

export async function adminVideoSourcesRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]
  const moderationSvc = new ModerationService(db, es)
  const runService = new CrawlerRunService(db)
  const auditSvc = new AuditLogService(db)  // CHG-SN-4-10-A2：refetch-sources 入队 audit
  const probeSvc = new SourceProbeService(db)  // CHG-357 / ADR-158 AMENDMENT 2

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
        expectedUpdatedAt: parsed.data.expectedUpdatedAt,
        actorId: request.user!.userId,
        requestId: request.id,
      })
      if (!result) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '线路不存在', status: 404 } })
      }
      return reply.send({ data: result })
    } catch (err) {
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(409).send({ error: { code: 'REVIEW_RACE', message: '已被其他审核员处理，请刷新', status: 409 } })
      }
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
    // CHG-SN-4-10-A2：admin 触发补源采集 → 写 audit（video.refetch_sources）
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'video.refetch_sources',
      targetKind: 'video',
      targetId: id,
      afterJsonb: { triggeredAt: new Date().toISOString(), siteKeys: siteKeys ?? null },
      requestId: request.id,
    })
    return reply.code(202).send({ data: result })
  })

  // ── CHG-357 / ADR-158 AMENDMENT 2：视频级 batch 探测/试播 ───────
  // 与 disable-dead 同 video-level 批量命名空间对称（arch-reviewer R1 方案 A）
  // adminOnly 与 ADR-158 §端点契约 100% 对齐（与 row 5/7-9/AMENDMENT 1 单源端点一致）

  // POST /admin/videos/:videoId/sources/batch-probe
  fastify.post('/admin/videos/:videoId/sources/batch-probe', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = BatchVideoIdSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'videoId 必须为 uuid', status: 422 },
      })
    }
    try {
      const result = await probeSvc.batchProbe(parsed.data.videoId, request.user!.userId, request.id)
      return reply.send({ data: result })
    } catch (err) {
      if (isAppError(err, 'NOT_FOUND')) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
      }
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
      }
      request.log.error({ err }, '[admin/videos/:videoId/sources/batch-probe] error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // POST /admin/videos/:videoId/sources/batch-render-check（不守 freeze / 继承 D-158-5）
  fastify.post('/admin/videos/:videoId/sources/batch-render-check', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = BatchVideoIdSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'videoId 必须为 uuid', status: 422 },
      })
    }
    try {
      const result = await probeSvc.batchRenderCheck(parsed.data.videoId, request.user!.userId, request.id)
      return reply.send({ data: result })
    } catch (err) {
      if (isAppError(err, 'NOT_FOUND')) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
      }
      request.log.error({ err }, '[admin/videos/:videoId/sources/batch-render-check] error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── POST /admin/videos/:videoId/sources/:sourceId/playback-verify（ADR-198）──
  // admin 真实播放反馈直更 source health（成功直更 render ok / 失败入队定向 recheck）。
  // 鉴权 auth=[moderator,admin]（D-198-6，审核动作，非 batch 端点的 adminOnly）。
  fastify.post(
    '/admin/videos/:videoId/sources/:sourceId/playback-verify',
    { preHandler: auth },
    async (request, reply) => {
      const params = request.params as { videoId: string; sourceId: string }
      // 路径 id 非法 uuid → 视为不存在（404，与 refetch-sources 一致；避免 PG uuid 语法错 500）
      if (!UUID_RE.test(params.videoId) || !UUID_RE.test(params.sourceId)) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '线路不存在', status: 404 } })
      }
      const parsed = PlaybackVerifySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
      }
      try {
        const result = await probeSvc.recordPlaybackVerify(
          params.videoId,
          params.sourceId,
          request.user!.userId,
          parsed.data,
          request.id,
        )
        return reply.send({ data: result })
      } catch (err) {
        if (isAppError(err, 'NOT_FOUND')) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
        }
        request.log.error({ err }, '[admin/videos/:videoId/sources/:sourceId/playback-verify] error')
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
      }
    },
  )
}
