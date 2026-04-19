/**
 * admin/design-tokens.ts — Design Token 管理接口（只读 MVP）
 * TOKEN-14: admin only
 *
 * GET /admin/design-tokens — Brand 列表（只读预览）
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import * as brandsQueries from '@/api/db/queries/brands'

export async function adminDesignTokenRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  fastify.get('/admin/design-tokens', { preHandler: auth }, async (_request, reply) => {
    const brands = await brandsQueries.listBrands(db)
    return reply.send({
      data: brands,
      total: brands.length,
    })
  })
}
