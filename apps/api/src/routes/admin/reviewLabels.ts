/**
 * reviewLabels.ts — GET /admin/review-labels
 * CHG-SN-4-05: 审核标签字典端点
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { listActiveReviewLabels } from '@/api/db/queries/reviewLabels'

const QuerySchema = z.object({
  appliesTo: z.enum(['reject', 'approve', 'any']).optional(),
})

export async function adminReviewLabelsRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]

  fastify.get('/admin/review-labels', { preHandler: auth }, async (request, reply) => {
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    try {
      const rows = await listActiveReviewLabels(db, parsed.data.appliesTo)
      const data = rows.map((r) => ({
        id: r.id,
        labelKey: r.label_key,
        label: r.label,
        appliesTo: r.applies_to,
        displayOrder: r.display_order,
        isActive: r.is_active,
        createdAt: r.created_at,
      }))
      return reply.send({ data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `查询失败: ${msg}`, status: 500 },
      })
    }
  })
}
