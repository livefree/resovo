/**
 * moderation.tmdb.ts — TMDB 候选确认与应用路由（ADR-202 §端点契约 / META-39-A）
 * 从 moderation.ts 聚合注册。Route 仅做鉴权 + zod 校验 + Service 委托，不含业务逻辑。
 *
 * 端点（ADR-202 §端点契约，挂 /admin/videos/:id/）：
 *   1 POST /admin/videos/:id/tmdb-search    moderator+admin  手动搜 TMDB 候选（只读）
 *   2 POST /admin/videos/:id/tmdb-confirm   moderator+admin  确认候选→绑定 + 应用字段（单事务）
 *   3 POST /admin/videos/:id/tmdb-reject    moderator+admin  拒绝候选
 *
 * 无 review_status pending 守卫（D-202-6：落点是编辑抽屉，适用任意状态视频，避免死按钮）。
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { TmdbConfirmService, TMDB_APPLIABLE_FIELDS } from '@/api/services/TmdbConfirmService'
import * as videoQueries from '@/api/db/queries/videos'

const VideoIdParamsSchema = z.object({ id: z.string().uuid() }).strict()
const TmdbSearchBodySchema = z.object({
  query: z.string().min(1).max(200).optional(),
  mediaType: z.enum(['movie', 'tv']),
  year: z.coerce.number().int().min(1800).max(2200).optional(),
}).strict()
const TmdbConfirmBodySchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'tv']),
  seasonNumber: z.number().int().positive().optional(),
  fields: z.array(z.enum(TMDB_APPLIABLE_FIELDS)).optional(),
}).strict()
const TmdbRejectBodySchema = z.object({ tmdbId: z.number().int().positive() }).strict()

const VALIDATION = { error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } }
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } }
const INTERNAL = { error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } }

export async function registerModerationTmdbRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const svc = new TmdbConfirmService(db)

  // ── 1. POST /admin/videos/:id/tmdb-search ────────────────────
  fastify.post('/admin/videos/:id/tmdb-search', { preHandler: auth }, async (request, reply) => {
    const params = VideoIdParamsSchema.safeParse(request.params)
    if (!params.success) return reply.code(422).send(VALIDATION)
    const body = TmdbSearchBodySchema.safeParse(request.body)
    if (!body.success) return reply.code(422).send(VALIDATION)
    const video = await videoQueries.findAdminVideoById(db, params.data.id)
    if (!video) return reply.code(404).send(NOT_FOUND)
    try {
      const result = await svc.search(video.title ?? null, body.data)
      return reply.send({ data: result })
    } catch (err) {
      request.log.error({ err }, 'tmdb-search unexpected error')
      return reply.code(500).send(INTERNAL)
    }
  })

  // ── 2. POST /admin/videos/:id/tmdb-confirm ───────────────────
  fastify.post('/admin/videos/:id/tmdb-confirm', { preHandler: auth }, async (request, reply) => {
    const params = VideoIdParamsSchema.safeParse(request.params)
    if (!params.success) return reply.code(422).send(VALIDATION)
    const body = TmdbConfirmBodySchema.safeParse(request.body)
    if (!body.success) return reply.code(422).send(VALIDATION)
    const video = await videoQueries.findAdminVideoById(db, params.data.id)
    if (!video) return reply.code(404).send(NOT_FOUND)
    try {
      const result = await svc.confirm(params.data.id, video.catalog_id, body.data)
      if (!result.updated) {
        // D-202-4：exact/kind 冲突软降级 → 422 CONFIRM_FAILED（不 409）
        return reply.code(422).send({ error: { code: 'CONFIRM_FAILED', message: result.reason, status: 422 } })
      }
      return reply.send({ data: { id: params.data.id, confirmed: true, applied: result.applied } })
    } catch (err) {
      request.log.error({ err }, 'tmdb-confirm unexpected error')
      return reply.code(500).send(INTERNAL)
    }
  })

  // ── 3. POST /admin/videos/:id/tmdb-reject ────────────────────
  fastify.post('/admin/videos/:id/tmdb-reject', { preHandler: auth }, async (request, reply) => {
    const params = VideoIdParamsSchema.safeParse(request.params)
    if (!params.success) return reply.code(422).send(VALIDATION)
    const body = TmdbRejectBodySchema.safeParse(request.body)
    if (!body.success) return reply.code(422).send(VALIDATION)
    const video = await videoQueries.findAdminVideoById(db, params.data.id)
    if (!video) return reply.code(404).send(NOT_FOUND)
    try {
      const result = await svc.reject(params.data.id, body.data.tmdbId)
      return reply.send({ data: { id: params.data.id, rejected: result.rejected } })
    } catch (err) {
      request.log.error({ err }, 'tmdb-reject unexpected error')
      return reply.code(500).send(INTERNAL)
    }
  })
}
