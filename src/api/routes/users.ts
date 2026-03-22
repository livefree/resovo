/**
 * users.ts — 用户个人接口
 * ADR-012
 *
 * GET  /users/me           — 获取当前用户信息（需登录）
 * POST /users/me/history   — 上报/更新播放进度（需登录）
 * GET  /users/me/history   — 获取观看历史（需登录，分页）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { findUserById } from '@/api/db/queries/users'
import { upsertWatchHistory, getUserHistory } from '@/api/db/queries/watchHistory'

export async function userRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate]

  // ── GET /users/me ──────────────────────────────────────────────
  fastify.get('/users/me', { preHandler: auth }, async (request, reply) => {
    const userId = request.user!.userId
    const user = await findUserById(db, userId)
    if (!user) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    // 不返回 passwordHash
    const { passwordHash: _pwd, ...safeUser } = user
    return reply.send({ data: safeUser })
  })

  // ── POST /users/me/history ─────────────────────────────────────
  fastify.post('/users/me/history', { preHandler: auth }, async (request, reply) => {
    const BodySchema = z.object({
      videoId: z.string().uuid(),
      episode: z.number().int().positive().nullable().optional(),
      progressSeconds: z.number().int().min(0),
    })

    const parsed = BodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { videoId, episode, progressSeconds } = parsed.data
    await upsertWatchHistory(db, {
      userId: request.user!.userId,
      videoId,
      episodeNumber: episode ?? null,
      progressSeconds,
    })

    return reply.code(204).send()
  })

  // ── GET /users/me/history ──────────────────────────────────────
  fastify.get('/users/me/history', { preHandler: auth }, async (request, reply) => {
    const QuerySchema = z.object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { page, limit } = parsed.data
    const userId = request.user!.userId
    const { rows, total } = await getUserHistory(db, userId, page, limit)

    return reply.send({
      data: rows.map((r) => ({
        videoId: r.video_id,
        episodeNumber: r.episode_number,
        progressSeconds: r.progress_seconds,
        watchedAt: r.watched_at,
        video: {
          id: r.video_id,
          shortId: r.video_short_id,
          title: r.video_title,
          coverUrl: r.video_cover_url,
          type: r.video_type,
        },
      })),
      total,
      page,
      limit,
    })
  })
}
