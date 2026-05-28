/**
 * moderation.douban.ts — 豆瓣元数据操作路由
 * 从 moderation.ts 拆出，覆盖豆瓣搜索/确认/忽略/候选/字段确认系列
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { es } from '@/api/lib/elasticsearch'
import { DoubanService } from '@/api/services/DoubanService'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'
import { buildManualMetaQuality } from '@/api/services/MetadataEnrichService'
import * as videoQueries from '@/api/db/queries/videos'

const DoubanSearchSchema = z.object({
  keyword: z.string().min(1).max(200),
})

const DoubanConfirmSchema = z.object({
  subjectId: z.string().min(1).max(100),
})

const DoubanConfirmFieldsSchema = z.object({
  subjectId: z.string().min(1).max(100),
  fields: z.array(z.string().min(1).max(50)).min(1).max(20),
})

export async function registerModerationDoubanRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const svc = new DoubanService(db)
  const indexSync = new VideoIndexSyncService(db, es)

  // ── POST /admin/moderation/:id/douban-search ─────────────────
  fastify.post('/admin/moderation/:id/douban-search', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = DoubanSearchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }
    try {
      const candidates = await svc.searchByKeyword(parsed.data.keyword)
      return reply.send({ data: { videoId: id, candidates } })
    } catch (err) {
      request.log.error({ err }, 'douban-search unexpected error')
      return reply.code(500).send({
        error: { code: 'SEARCH_FAILED', message: '豆瓣搜索失败', status: 500 },
      })
    }
  })

  // ── POST /admin/moderation/:id/douban-confirm ────────────────
  fastify.post('/admin/moderation/:id/douban-confirm', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = DoubanConfirmSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    if (video.review_status !== 'pending_review') {
      return reply.code(422).send({ error: { code: 'NOT_PENDING', message: '仅待审核视频可操作', status: 422 } })
    }
    try {
      const result = await svc.confirmSubject(id, parsed.data.subjectId)
      if (!result.updated) {
        return reply.code(422).send({
          error: { code: 'CONFIRM_FAILED', message: result.reason ?? '确认失败', status: 422 },
        })
      }
      return reply.send({ data: { id, confirmed: true } })
    } catch (err) {
      request.log.error({ err }, 'douban-confirm unexpected error')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 },
      })
    }
  })

  // ── POST /admin/moderation/:id/douban-ignore ─────────────────
  fastify.post('/admin/moderation/:id/douban-ignore', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    if (video.review_status !== 'pending_review') {
      return reply.code(422).send({ error: { code: 'NOT_PENDING', message: '仅待审核视频可操作', status: 422 } })
    }
    try {
      // Codex stop-time review #8: 同步 meta_quality 防 stale（method/confidence 清零 / status=unmatched）
      const metaQuality = buildManualMetaQuality(video.meta_quality ?? null, {
        status: 'unmatched',
        method: null,
        confidence: null,
      })
      await videoQueries.updateVideoEnrichStatus(db, id, {
        doubanStatus: 'unmatched',
        metaScore: video.meta_score ?? 0,
        metaQuality,
      })
      return reply.send({ data: { id, ignored: true } })
    } catch (err) {
      request.log.error({ err }, 'douban-ignore unexpected error')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 },
      })
    }
  })

  // ── GET /admin/moderation/:id/douban-candidate ──────────────
  // META-07: 获取候选对比数据（当前 catalog 字段 vs 候选条目字段）
  fastify.get('/admin/moderation/:id/douban-candidate', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    try {
      const data = await svc.getCandidateData(id)
      if (!data) {
        return reply.code(404).send({ error: { code: 'NO_CANDIDATE', message: '无候选豆瓣条目', status: 404 } })
      }
      return reply.send({ data })
    } catch (err) {
      request.log.error({ err }, 'douban-candidate unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── POST /admin/moderation/:id/douban-confirm-fields ─────────
  // META-07: 只应用选中字段，并写 manual_confirmed
  fastify.post('/admin/moderation/:id/douban-confirm-fields', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = DoubanConfirmFieldsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    if (video.review_status !== 'pending_review') {
      return reply.code(422).send({ error: { code: 'NOT_PENDING', message: '仅待审核视频可操作', status: 422 } })
    }
    try {
      const result = await svc.confirmFields(id, parsed.data.subjectId, parsed.data.fields)
      if (!result.updated) {
        return reply.code(422).send({ error: { code: 'CONFIRM_FAILED', message: result.reason ?? '确认失败', status: 422 } })
      }
      void indexSync.syncVideo(id)
      return reply.send({ data: { id, confirmed: true } })
    } catch (err) {
      request.log.error({ err }, 'confirm-fields unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })
}
