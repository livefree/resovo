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
    try {
      const brands = await brandsQueries.listBrands(db)
      return reply.send({ data: brands, total: brands.length })
    } catch (err: unknown) {
      // brands 表未迁移时（42P01）返回空列表，避免 500
      const pg = err as { code?: string }
      if (pg.code === '42P01') {
        return reply.send({ data: [], total: 0, _note: 'brands table not yet migrated' })
      }
      throw err
    }
  })
}
