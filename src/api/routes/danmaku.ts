/**
 * danmaku.ts — 弹幕路由
 * CHG-21: 弹幕后端 API
 * GET  /videos/:id/danmaku?ep=1   公开，返回弹幕列表（按时间排序，最多 5000 条）
 * POST /videos/:id/danmaku        需登录，发送一条弹幕
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import striptags from 'striptags'

import { db } from '@/api/lib/postgres'
import * as videoQueries from '@/api/db/queries/videos'
import * as danmakuQueries from '@/api/db/queries/danmaku'

// 颜色正则：#rrggbb
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

const PostDanmakuSchema = z.object({
  ep: z.number().int().min(1).default(1),
  time: z.number().int().min(0),
  type: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  color: z.string().regex(COLOR_RE, '颜色格式错误，需为 #rrggbb'),
  text: z.string().min(1).max(100),
})

export async function danmakuRoutes(fastify: FastifyInstance) {
  // ── GET /videos/:id/danmaku ──────────────────────────────────────
  fastify.get('/videos/:id/danmaku', async (request, reply) => {
    const { id } = request.params as { id: string }

    const QuerySchema = z.object({
      ep: z.coerce.number().int().min(1).default(1),
    })
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    // short_id 格式校验
    if (!/^[A-Za-z0-9_-]{8}$/.test(id)) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    const video = await videoQueries.findVideoByShortId(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    const items = await danmakuQueries.getDanmaku(db, video.id, parsed.data.ep)
    return reply.send({ data: items })
  })

  // ── POST /videos/:id/danmaku ─────────────────────────────────────
  fastify.post(
    '/videos/:id/danmaku',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      if (!/^[A-Za-z0-9_-]{8}$/.test(id)) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
        })
      }

      const parsed = PostDanmakuSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数错误',
            details: parsed.error.flatten(),
            status: 422,
          },
        })
      }

      const video = await videoQueries.findVideoByShortId(db, id)
      if (!video) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
        })
      }

      const { userId } = request.user as { userId: string }

      const item = await danmakuQueries.insertDanmaku(db, {
        videoId: video.id,
        userId,
        episodeNumber: parsed.data.ep,
        time: parsed.data.time,
        type: parsed.data.type,
        color: parsed.data.color,
        text: striptags(parsed.data.text),
      })

      return reply.code(201).send({ data: item })
    }
  )
}
