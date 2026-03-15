/**
 * admin/users.ts — 用户管理接口
 * ADMIN-04: admin only
 *
 * GET   /admin/users              — 用户列表（搜索、分页，需 admin）
 * GET   /admin/users/:id          — 用户详情（需 admin）
 * PATCH /admin/users/:id/ban      — 封号（banned_at = NOW()，需 admin）
 * PATCH /admin/users/:id/unban    — 解封（banned_at = NULL，需 admin）
 * PATCH /admin/users/:id/role     — 修改角色（user↔moderator，admin 不可修改，需 admin）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'

export async function adminUserRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  const ListSchema = z.object({
    q: z.string().max(100).optional(),
    role: z.enum(['user', 'moderator', 'admin']).optional(),
    banned: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })

  // ── GET /admin/users ─────────────────────────────────────────
  fastify.get('/admin/users', { preHandler: auth }, async (request, reply) => {
    const parsed = ListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { q, role, banned, page, limit } = parsed.data
    const conditions = ['deleted_at IS NULL']
    const params: unknown[] = []
    let idx = 1

    if (q) {
      conditions.push(`(username ILIKE $${idx} OR email ILIKE $${idx})`)
      params.push(`%${q}%`)
      idx++
    }
    if (role) {
      conditions.push(`role = $${idx++}`)
      params.push(role)
    }
    if (banned === 'true') {
      conditions.push('banned_at IS NOT NULL')
    } else if (banned === 'false') {
      conditions.push('banned_at IS NULL')
    }

    const where = conditions.join(' AND ')
    const offset = (page - 1) * limit

    const [rows, countResult] = await Promise.all([
      db.query(
        `SELECT id, username, email, role, avatar_url, banned_at, created_at
         FROM users
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM users WHERE ${where}`,
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

  // ── GET /admin/users/:id ─────────────────────────────────────
  fastify.get('/admin/users/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await db.query(
      `SELECT id, username, email, role, avatar_url, locale, banned_at, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    if (!result.rows[0]) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    return reply.send({ data: result.rows[0] })
  })

  // ── PATCH /admin/users/:id/ban ────────────────────────────────
  fastify.patch('/admin/users/:id/ban', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // 不能封禁 admin 账号
    const userResult = await db.query(
      `SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    if (!userResult.rows[0]) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    if (userResult.rows[0].role === 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '不能封禁 admin 账号', status: 403 },
      })
    }

    const result = await db.query(
      `UPDATE users SET banned_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id, banned_at`,
      [id]
    )
    return reply.send({ data: result.rows[0] })
  })

  // ── PATCH /admin/users/:id/unban ──────────────────────────────
  fastify.patch('/admin/users/:id/unban', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await db.query(
      `UPDATE users SET banned_at = NULL WHERE id = $1 AND deleted_at IS NULL RETURNING id, banned_at`,
      [id]
    )
    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    return reply.send({ data: result.rows[0] })
  })

  // ── PATCH /admin/users/:id/role ───────────────────────────────
  fastify.patch('/admin/users/:id/role', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const RoleSchema = z.object({
      role: z.enum(['user', 'moderator']), // 只能在 user↔moderator 间切换
    })
    const parsed = RoleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '角色只能设为 user 或 moderator', status: 422 },
      })
    }

    // 防止修改 admin 账号
    const userResult = await db.query(
      `SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    if (!userResult.rows[0]) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    if (userResult.rows[0].role === 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '不能修改 admin 账号的角色', status: 403 },
      })
    }

    const result = await db.query(
      `UPDATE users SET role = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, role`,
      [parsed.data.role, id]
    )
    return reply.send({ data: result.rows[0] })
  })
}
