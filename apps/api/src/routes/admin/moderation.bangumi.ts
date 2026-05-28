/**
 * moderation.bangumi.ts — Bangumi 元数据操作 + 反向建库路由（ADR-159 端点 1–5）
 * 从 moderation.ts 拆出。Route 仅做鉴权 + zod 校验 + Service 委托，不含业务逻辑。
 *
 * 端点（ADR-159 §端点契约）：
 *   1 POST /admin/videos/:id/bangumi-sync        moderator+admin   触发匹配 + rich + 逐集
 *   2 GET  /admin/videos/:id/bangumi-candidates  moderator+admin   候选搜索（本地召回 + REST 兜底）
 *   3 POST /admin/videos/:id/bangumi-confirm     moderator+admin   人工确认 subject
 *   4 POST /admin/bangumi/seed                   admin only        反向建库无源占位
 *   5 GET  /admin/bangumi/gaps                   moderator+admin   缺口清单
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { BangumiGapRow } from '@/types'
import { db } from '@/api/lib/postgres'
import { BangumiService } from '@/api/services/BangumiService'
import { BangumiSeedService } from '@/api/services/BangumiSeedService'
import * as videoQueries from '@/api/db/queries/videos'

const VideoIdParamsSchema = z.object({ id: z.string().uuid() }).strict()
const BangumiCandidatesQuerySchema = z.object({ keyword: z.string().min(1).max(200).optional() }).strict()
const BangumiConfirmBodySchema = z.object({ bangumiSubjectId: z.number().int().positive() }).strict()
const BangumiSeedBodySchema = z.object({
  minRank: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
}).strict()
const BangumiGapsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict()

const VALIDATION = { error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } }
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } }
const INTERNAL = { error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } }

export async function registerModerationBangumiRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]
  const svc = new BangumiService(db)
  const seedSvc = new BangumiSeedService(db)

  // ── 1. POST /admin/videos/:id/bangumi-sync ───────────────────
  fastify.post('/admin/videos/:id/bangumi-sync', { preHandler: auth }, async (request, reply) => {
    const parsedParams = VideoIdParamsSchema.safeParse(request.params)
    if (!parsedParams.success) return reply.code(422).send(VALIDATION)
    const { id } = parsedParams.data
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) return reply.code(404).send(NOT_FOUND)
    try {
      const result = await svc.matchAndEnrich({
        videoId: id,
        catalogId: video.catalog_id,
        titleNorm: video.title_normalized,
        year: video.year,
      })
      if (result.matched === 'auto') {
        return reply.send({ data: { updated: true, bangumiSubjectId: result.bangumiSubjectId, episodes: result.episodes } })
      }
      if (result.matched === 'candidate') {
        return reply.send({ data: { updated: false, reason: 'candidate', bangumiSubjectId: result.bangumiSubjectId } })
      }
      return reply.send({ data: { updated: false, reason: result.reason } })
    } catch (err) {
      request.log.error({ err }, 'bangumi-sync unexpected error')
      return reply.code(500).send(INTERNAL)
    }
  })

  // ── 2. GET /admin/videos/:id/bangumi-candidates ──────────────
  fastify.get('/admin/videos/:id/bangumi-candidates', { preHandler: auth }, async (request, reply) => {
    const parsedParams = VideoIdParamsSchema.safeParse(request.params)
    if (!parsedParams.success) return reply.code(422).send(VALIDATION)
    const { id } = parsedParams.data
    const parsed = BangumiCandidatesQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(422).send(VALIDATION)
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) return reply.code(404).send(NOT_FOUND)
    try {
      const candidates = await svc.searchCandidates({
        titleNorm: video.title_normalized,
        year: video.year,
        keyword: parsed.data.keyword,
      })
      return reply.send({ data: { candidates } })
    } catch (err) {
      request.log.error({ err }, 'bangumi-candidates unexpected error')
      return reply.code(500).send(INTERNAL)
    }
  })

  // ── 3. POST /admin/videos/:id/bangumi-confirm ────────────────
  fastify.post('/admin/videos/:id/bangumi-confirm', { preHandler: auth }, async (request, reply) => {
    const parsedParams = VideoIdParamsSchema.safeParse(request.params)
    if (!parsedParams.success) return reply.code(422).send(VALIDATION)
    const { id } = parsedParams.data
    const parsed = BangumiConfirmBodySchema.safeParse(request.body)
    if (!parsed.success) return reply.code(422).send(VALIDATION)
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) return reply.code(404).send(NOT_FOUND)
    try {
      const result = await svc.confirmMatch(id, video.catalog_id, parsed.data.bangumiSubjectId)
      return reply.send({ data: { updated: result.updated, bangumiSubjectId: parsed.data.bangumiSubjectId } })
    } catch (err) {
      request.log.error({ err }, 'bangumi-confirm unexpected error')
      return reply.code(500).send(INTERNAL)
    }
  })

  // ── 4. POST /admin/bangumi/seed（admin only）─────────────────
  fastify.post('/admin/bangumi/seed', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = BangumiSeedBodySchema.safeParse(request.body)
    if (!parsed.success) return reply.code(422).send(VALIDATION)
    try {
      const result = await seedSvc.seedPlaceholders({
        minRank: parsed.data.minRank,
        year: parsed.data.year,
        limit: parsed.data.limit,
      })
      return reply.send({ data: result })
    } catch (err) {
      request.log.error({ err }, 'bangumi-seed unexpected error')
      return reply.code(500).send(INTERNAL)
    }
  })

  // ── 5. GET /admin/bangumi/gaps ───────────────────────────────
  fastify.get('/admin/bangumi/gaps', { preHandler: auth }, async (request, reply) => {
    const parsed = BangumiGapsQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(422).send(VALIDATION)
    try {
      const { rows, total } = await seedSvc.listGaps({ page: parsed.data.page, limit: parsed.data.limit })
      const data: BangumiGapRow[] = rows
      return reply.send({ data, total, page: parsed.data.page, limit: parsed.data.limit })
    } catch (err) {
      request.log.error({ err }, 'bangumi-gaps unexpected error')
      return reply.code(500).send(INTERNAL)
    }
  })
}
