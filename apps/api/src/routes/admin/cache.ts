/**
 * admin/cache.ts — 缓存管理 API
 * CHG-30: admin only
 *
 * GET    /admin/cache/stats    — 各类型缓存统计
 * DELETE /admin/cache/:type   — 清除指定类型缓存（type: search|video|danmaku|analytics|all）
 *
 * CHG-SN-6-RETRO-3-A：DELETE 写 admin_audit_log（system.cache_clear / ultrareview P0-3）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'
import { CacheService } from '@/api/services/CacheService'
import { AuditLogService } from '@/api/services/AuditLogService'

const CacheTypeSchema = z.enum(['search', 'video', 'danmaku', 'analytics', 'home', 'all'])

export async function adminCacheRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const cacheService = new CacheService(redis)
  const auditSvc = new AuditLogService(db)  // CHG-SN-6-RETRO-3-A

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

    // CHG-SN-6-RETRO-3-A：写 audit（target_id NULL = 系统级；before/after_jsonb 含 type + deleted 计数）
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'system.cache_clear',
      targetKind: 'system',
      targetId: null,
      beforeJsonb: { cacheType: parsed.data },
      afterJsonb: { cacheType: parsed.data, deletedKeys: deleted },
      requestId: request.id,
    })

    return reply.send({ data: { deleted } })
  })
}
