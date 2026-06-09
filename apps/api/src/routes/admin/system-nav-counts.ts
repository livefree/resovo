/**
 * admin/system-nav-counts.ts — GET /admin/system/nav-counts（ADR-190 / NTLG-P0-1）
 *
 * ADR-190 §端点契约：
 *   GET /admin/system/nav-counts
 *   preHandler: [authenticate, requireRole(['admin', 'moderator'])]
 *   response: { data: AdminNavCounts, meta: { partial, omitted } }
 *   错误码：401 / 403（子模块失败/无权走 meta.omitted 软降级，不映射错误码）
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { NavCountsService, type NavCountRole } from '@/api/services/NavCountsService'

export async function adminSystemNavCountsRoutes(fastify: FastifyInstance) {
  const svc = new NavCountsService(db)
  const auth = [fastify.authenticate, fastify.requireRole(['admin', 'moderator'])]

  fastify.get('/admin/system/nav-counts', { preHandler: auth }, async (request, reply) => {
    // requireRole 已保证 role ∈ {admin, moderator}；非 admin 即 moderator。
    const role: NavCountRole = request.user!.role === 'admin' ? 'admin' : 'moderator'
    const result = await svc.getCounts(role)
    return reply.send({
      data: result.counts,
      meta: { partial: result.partial, omitted: result.omitted },
    })
  })
}
