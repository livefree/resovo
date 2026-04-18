/**
 * admin/cache.ts — 缓存管理 API
 * CHG-30: admin only
 *
 * GET    /admin/cache/stats    — 各类型缓存统计
 * DELETE /admin/cache/:type   — 清除指定类型缓存（type: search|video|danmaku|analytics|all）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { redis } from '@/api/lib/redis'
import { CacheService } from '@/api/services/CacheService'

const CacheTypeSchema = z.enum(['search', 'video', 'danmaku', 'analytics', 'all'])

export async function adminCacheRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const cacheService = new CacheService(redis)

  // GET /admin/cache/stats
  fastify.get('/admin/cache/stats', { preHandler: auth }, async (_request, reply) => {
    const stats = await cacheService.getStats()
    return reply.send({ data: stats })
  })

  // DELETE /admin/cache/:type
  fastify.delete('/admin/cache/:type', { preHandler: auth }, async (request, reply) => {
    const { type } = request.params as { type: string }
    const parsed = CacheTypeSchema.safeParse(type)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_CACHE_TYPE', message: '无效缓存类型，可用值：search|video|danmaku|analytics|all', status: 400 },
      })
    }

    const deleted = await cacheService.clearCache(parsed.data)
    return reply.send({ data: { deleted } })
  })
}
