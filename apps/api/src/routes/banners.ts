// banners.ts — 公开 Banner 路由
// GET /v1/banners   返回当前时间窗内 is_active=true 的 banner 列表

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { BannerService } from '@/api/services/BannerService'

export async function bannerRoutes(fastify: FastifyInstance) {
  const bannerService = new BannerService(db)

  fastify.get('/banners', async (request, reply) => {
    const QuerySchema = z.object({
      locale: z.string().max(10).optional(),
      brand_slug: z.string().max(64).optional(),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const data = await bannerService.listActive({
      locale: parsed.data.locale,
      brandSlug: parsed.data.brand_slug ?? null,
    })
    return reply.send({ data })
  })
}
