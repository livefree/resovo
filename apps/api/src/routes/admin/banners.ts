// admin/banners.ts — Banner 后台管理接口
// M5-API-BANNER-01
//
// GET    /v1/admin/banners           列表（需 admin）
// GET    /v1/admin/banners/:id       单条详情（需 admin）
// POST   /v1/admin/banners           新建（需 admin）
// PUT    /v1/admin/banners/:id       全量更新（需 admin）
// DELETE /v1/admin/banners/:id       删除（需 admin）
// PATCH  /v1/admin/banners/reorder   批量排序（需 admin）

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { BannerService } from '@/api/services/BannerService'

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const BannerTitleSchema = z.record(z.string(), z.string())

const BannerLinkTypeSchema = z.enum(['video', 'external'])
const BannerBrandScopeSchema = z.enum(['brand-specific', 'all-brands'])

const CreateBannerSchema = z.object({
  title: BannerTitleSchema,
  imageUrl: z.string().url(),
  linkType: BannerLinkTypeSchema,
  linkTarget: z.string().max(500),
  sortOrder: z.number().int().min(0).optional(),
  activeFrom: z.string().datetime().nullable().optional(),
  activeTo: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  brandScope: BannerBrandScopeSchema.optional(),
  brandSlug: z.string().max(64).nullable().optional(),
})

const UpdateBannerSchema = CreateBannerSchema.partial()

const ReorderSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    })
  ).min(1).max(200),
})

// ── Routes ───────────────────────────────────────────────────────────────────

export async function adminBannerRoutes(fastify: FastifyInstance) {
  const bannerService = new BannerService(db)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  fastify.get('/admin/banners', { preHandler: adminOnly }, async (request, reply) => {
    const QuerySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const result = await bannerService.listAll(parsed.data)
    return reply.send({
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasNext: result.page * result.limit < result.total,
      },
    })
  })

  fastify.get('/admin/banners/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const banner = await bannerService.getById(id)
    if (!banner) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Banner 不存在', status: 404 },
      })
    }
    return reply.send({ data: banner })
  })

  fastify.post('/admin/banners', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = CreateBannerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', details: parsed.error.flatten(), status: 422 },
      })
    }
    const banner = await bannerService.create(parsed.data)
    return reply.code(201).send({ data: banner })
  })

  fastify.put('/admin/banners/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = UpdateBannerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', details: parsed.error.flatten(), status: 422 },
      })
    }
    const banner = await bannerService.update(id, parsed.data)
    if (!banner) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Banner 不存在', status: 404 },
      })
    }
    return reply.send({ data: banner })
  })

  fastify.delete('/admin/banners/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const deleted = await bannerService.delete(id)
    if (!deleted) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Banner 不存在', status: 404 },
      })
    }
    return reply.code(204).send()
  })

  fastify.patch('/admin/banners/reorder', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = ReorderSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', details: parsed.error.flatten(), status: 422 },
      })
    }
    await bannerService.reorder(parsed.data.orders)
    return reply.send({ ok: true })
  })
}
