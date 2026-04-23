/**
 * home.ts — 首页运营位路由
 * GET /home/top10    — top10 排行（人工置顶 + rating fallback）
 * GET /home/modules  — 指定 slot 的当前激活模块列表
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'
import { HomeService } from '@/api/services/HomeService'

const HomeModuleSlotEnum = z.enum(['banner', 'featured', 'top10', 'type_shortcuts'])

export async function homeRoutes(fastify: FastifyInstance) {
  const homeService = new HomeService(db, redis)

  // ── GET /home/top10 ──────────────────────────────────────────
  fastify.get('/home/top10', async (request, reply) => {
    const QuerySchema = z.object({
      brand_slug: z.string().max(64).optional(),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const brandSlug = parsed.data.brand_slug ?? null
    const data = await homeService.topTen(brandSlug)
    return reply.send({ data })
  })

  // ── GET /home/modules ────────────────────────────────────────
  fastify.get('/home/modules', async (request, reply) => {
    const QuerySchema = z.object({
      slot: HomeModuleSlotEnum,
      brand_slug: z.string().max(64).optional(),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const brandSlug = parsed.data.brand_slug ?? null
    const data = await homeService.listActiveBySlot(parsed.data.slot, brandSlug)
    return reply.send({ data })
  })
}
