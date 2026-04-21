/**
 * admin/image-health.ts — 图片健康监控 API
 * IMG-05: admin only
 *
 * GET /admin/image-health/stats          — 总览统计
 * GET /admin/image-health/broken-domains — TOP 破损域名
 * GET /admin/image-health/missing-videos — 缺图视频列表（分页）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import {
  getImageHealthStats,
  getTopBrokenDomains,
  listMissingPosterVideos,
} from '@/api/db/queries/imageHealth'
import type { MissingVideoSortField, SortDir } from '@/api/db/queries/imageHealth'

const BrokenDomainsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const MissingVideosQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  sortField: z.enum(['created_at', 'title', 'poster_status']).default('created_at'),
  sortDir:   z.enum(['asc', 'desc']).default('desc'),
})

export async function adminImageHealthRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/image-health/stats ─────────────────────────────
  fastify.get('/admin/image-health/stats', { preHandler: auth }, async (_req, reply) => {
    const stats = await getImageHealthStats(db)
    return reply.send({ data: stats })
  })

  // ── GET /admin/image-health/broken-domains ─────────────────────
  fastify.get('/admin/image-health/broken-domains', { preHandler: auth }, async (request, reply) => {
    const parsed = BrokenDomainsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid query', status: 400 },
      })
    }
    const rows = await getTopBrokenDomains(db, parsed.data.limit)
    return reply.send({ data: rows })
  })

  // ── GET /admin/image-health/missing-videos ─────────────────────
  fastify.get('/admin/image-health/missing-videos', { preHandler: auth }, async (request, reply) => {
    const parsed = MissingVideosQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid query', status: 400 },
      })
    }
    const { page, limit, sortField, sortDir } = parsed.data
    const offset = (page - 1) * limit

    const [rows, countResult] = await Promise.all([
      listMissingPosterVideos(db, limit, offset, sortField as MissingVideoSortField, sortDir as SortDir),
      db.query<{ total: string }>(
        `SELECT COUNT(v.id)::int AS total
         FROM videos v
         JOIN media_catalog mc ON mc.id = v.catalog_id
         WHERE v.deleted_at IS NULL
           AND mc.poster_status IN ('missing', 'broken', 'pending_review')`
      ),
    ])

    return reply.send({
      data: rows,
      total: parseInt(countResult.rows[0]?.total ?? '0'),
    })
  })
}
