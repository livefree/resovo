/**
 * admin/search.ts — 后台全局搜索 fan-out 端点（ADR-200 §端点契约）
 *
 * GET /admin/search — videos/sources/users/tasks（P1）fan-out，按 kind 分组 + 组内 top-N +
 *                     精确命中置顶 + 权限分级（moderator 不返 user，D-200-5）。
 *
 * admin + moderator 可访问；videos 走后台可见性 ES（不调公开 SearchService）。
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { es } from '@/api/lib/elasticsearch'
import { db } from '@/api/lib/postgres'
import { AdminSearchService } from '@/api/services/AdminSearchService'

const QuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(8),
})

export async function adminSearchRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin', 'moderator'])]
  const svc = new AdminSearchService(es, db)

  fastify.get('/admin/search', { preHandler: auth }, async (request, reply) => {
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'q 参数必填',
          status: 422,
        },
      })
    }
    // requireRole 已确保 admin|moderator；映射 'user' 不可能到达此处
    const role = request.user!.role === 'admin' ? 'admin' : 'moderator'
    const data = await svc.search(parsed.data.q, { limit: parsed.data.limit, role })
    return reply.send({ data })
  })
}
