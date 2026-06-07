/**
 * home.ts — 首页运营位路由
 * GET /home/top10    — top10 排行（人工置顶 + rating fallback）
 * GET /home/modules  — 指定 slot 的当前激活模块列表
 * GET /home/shelf    — hot shelf 聚合消费（pinned 头部 + 快照 auto 合成，ADR-184）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { HOME_SHELF_SECTIONS } from '@resovo/types'

import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'
import { HomeService } from '@/api/services/HomeService'

// ADR-181 D-181-4（migration 094）：+3 hot slot——公开端点纯增量（新增合法入参值，既有消费方零破坏）
const HomeModuleSlotEnum = z.enum(['banner', 'featured', 'top10', 'type_shortcuts', 'hot_movies', 'hot_series', 'hot_anime'])

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

  // ── GET /home/shelf ──────────────────────────────────────────
  // ADR-184 D-184-2：公开 hot shelf 聚合消费（窄集 section；扩值走 ADR amendment）
  fastify.get('/home/shelf', async (request, reply) => {
    const QuerySchema = z.object({
      section: z.enum(HOME_SHELF_SECTIONS),
      brand_slug: z.string().max(64).optional(),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const brandSlug = parsed.data.brand_slug ?? null
    const data = await homeService.shelf(parsed.data.section, brandSlug)
    return reply.send({ data })
  })
}
