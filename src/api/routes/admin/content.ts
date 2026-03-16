/**
 * admin/content.ts — 播放源、投稿、字幕审核接口
 * ADMIN-03
 *
 * GET    /admin/sources                   — 播放源列表（按 is_active 筛选，需 moderator+）
 * DELETE /admin/sources/:id               — 软删除（需 moderator+）
 * POST   /admin/sources/batch-delete      — 批量软删除（需 moderator+）
 * POST   /admin/sources/:id/verify        — 手动触发验证（复用 VerifyService，需 moderator+）
 *
 * GET    /admin/submissions               — 投稿队列（is_active=false && submitted_by IS NOT NULL，需 moderator+）
 * POST   /admin/submissions/:id/approve   — 审核通过 → is_active=true（需 moderator+）
 * POST   /admin/submissions/:id/reject    — 拒绝 → 软删除（需 moderator+）
 *
 * GET    /admin/subtitles                 — 字幕审核队列（is_verified=false，需 moderator+）
 * POST   /admin/subtitles/:id/approve     — 审核通过 → is_verified=true（需 moderator+）
 * POST   /admin/subtitles/:id/reject      — 拒绝 → 软删除（需 moderator+）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
// ── 路由注册 ──────────────────────────────────────────────────────

export async function adminContentRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]

  // ════════════════════════════════════════════════════════════════
  // 播放源管理
  // ════════════════════════════════════════════════════════════════

  const SourceListSchema = z.object({
    active: z.enum(['true', 'false', 'all']).optional().default('all'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    videoId: z.string().uuid().optional(),
  })

  fastify.get('/admin/sources', { preHandler: auth }, async (request, reply) => {
    const parsed = SourceListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { active, page, limit, videoId } = parsed.data
    const conditions = ['s.deleted_at IS NULL', 's.submitted_by IS NULL']
    const params: unknown[] = []
    let idx = 1

    if (active === 'true') {
      conditions.push('is_active = true')
    } else if (active === 'false') {
      conditions.push('is_active = false')
    }
    if (videoId) {
      conditions.push(`video_id = $${idx++}`)
      params.push(videoId)
    }

    const where = conditions.join(' AND ')
    const offset = (page - 1) * limit

    const [rows, countResult] = await Promise.all([
      db.query(
        `SELECT s.*, v.title AS video_title
         FROM video_sources s
         LEFT JOIN videos v ON s.video_id = v.id
         WHERE ${where}
         ORDER BY s.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM video_sources s WHERE ${where}`,
        params
      ),
    ])

    return reply.send({
      data: rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0'),
      page,
      limit,
    })
  })

  fastify.delete('/admin/sources/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await db.query(
      `UPDATE video_sources SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    )
    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '播放源不存在', status: 404 },
      })
    }
    return reply.code(204).send()
  })

  fastify.post('/admin/sources/batch-delete', { preHandler: auth }, async (request, reply) => {
    const BatchSchema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
    })
    const parsed = BatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { ids } = parsed.data
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const result = await db.query(
      `UPDATE video_sources SET deleted_at = NOW() WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      ids
    )
    return reply.send({ data: { deleted: result.rowCount ?? 0 } })
  })

  // ════════════════════════════════════════════════════════════════
  // 投稿队列（is_active=false && submitted_by IS NOT NULL）
  // ════════════════════════════════════════════════════════════════

  const SubListSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })

  fastify.get('/admin/submissions', { preHandler: auth }, async (request, reply) => {
    const parsed = SubListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { page, limit } = parsed.data
    const offset = (page - 1) * limit

    const [rows, countResult] = await Promise.all([
      db.query(
        `SELECT s.*, v.title AS video_title, u.username AS submitted_by_username
         FROM video_sources s
         LEFT JOIN videos v ON s.video_id = v.id
         LEFT JOIN users u ON s.submitted_by = u.id::text
         WHERE s.is_active = false AND s.submitted_by IS NOT NULL AND s.deleted_at IS NULL
         ORDER BY s.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM video_sources WHERE is_active = false AND submitted_by IS NOT NULL AND deleted_at IS NULL`
      ),
    ])

    return reply.send({
      data: rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0'),
      page,
      limit,
    })
  })

  fastify.post('/admin/submissions/:id/approve', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await db.query(
      `UPDATE video_sources SET is_active = true, last_checked = NOW()
       WHERE id = $1 AND is_active = false AND deleted_at IS NULL
       RETURNING id`,
      [id]
    )
    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '投稿记录不存在或已处理', status: 404 },
      })
    }
    return reply.send({ data: { approved: true } })
  })

  fastify.post('/admin/submissions/:id/reject', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await db.query(
      `UPDATE video_sources SET deleted_at = NOW()
       WHERE id = $1 AND is_active = false AND deleted_at IS NULL
       RETURNING id`,
      [id]
    )
    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '投稿记录不存在或已处理', status: 404 },
      })
    }
    return reply.code(204).send()
  })

  // ════════════════════════════════════════════════════════════════
  // 字幕审核队列（is_verified=false）
  // ════════════════════════════════════════════════════════════════

  fastify.get('/admin/subtitles', { preHandler: auth }, async (request, reply) => {
    const parsed = SubListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { page, limit } = parsed.data
    const offset = (page - 1) * limit

    const [rows, countResult] = await Promise.all([
      db.query(
        `SELECT s.*, v.title AS video_title
         FROM subtitles s
         LEFT JOIN videos v ON s.video_id = v.id
         WHERE s.is_verified = false AND s.deleted_at IS NULL
         ORDER BY s.created_at ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM subtitles WHERE is_verified = false AND deleted_at IS NULL`
      ),
    ])

    return reply.send({
      data: rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0'),
      page,
      limit,
    })
  })

  fastify.post('/admin/subtitles/:id/approve', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await db.query(
      `UPDATE subtitles SET is_verified = true WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    )
    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '字幕记录不存在', status: 404 },
      })
    }
    return reply.send({ data: { approved: true } })
  })

  fastify.post('/admin/subtitles/:id/reject', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await db.query(
      `UPDATE subtitles SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    )
    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '字幕记录不存在', status: 404 },
      })
    }
    return reply.code(204).send()
  })
}
