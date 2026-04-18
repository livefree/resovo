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
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/api/lib/postgres'
import * as usersQueries from '@/api/db/queries/users'

export async function adminUserRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  const USER_SORT_FIELDS = ['username', 'email', 'role', 'created_at', 'status'] as const

  const ListSchema = z.object({
    q: z.string().max(100).optional(),
    role: z.enum(['user', 'moderator', 'admin']).optional(),
    banned: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })

  // ── GET /admin/users ─────────────────────────────────────────
  fastify.get('/admin/users', { preHandler: auth }, async (request, reply) => {
    const parsed = ListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { q, role, banned, page, limit, sortDir } = parsed.data
    const rawSortField = parsed.data.sortField
    const sortField = rawSortField && (USER_SORT_FIELDS as readonly string[]).includes(rawSortField)
      ? rawSortField
      : undefined
    const { rows, total } = await usersQueries.listAdminUsers(db, { q, role, banned, page, limit, sortField, sortDir })
    return reply.send({ data: rows, total, page, limit })
  })

  // ── GET /admin/users/:id ─────────────────────────────────────
  fastify.get('/admin/users/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = await usersQueries.findAdminUserById(db, id)
    if (!user) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    return reply.send({ data: user })
  })

  // ── PATCH /admin/users/:id/ban ────────────────────────────────
  fastify.patch('/admin/users/:id/ban', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // 不能封禁 admin 账号
    const user = await usersQueries.findAdminUserById(db, id)
    if (!user) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    if (user.role === 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '不能封禁 admin 账号', status: 403 },
      })
    }

    const result = await usersQueries.banUser(db, id)
    return reply.send({ data: result })
  })

  // ── PATCH /admin/users/:id/unban ──────────────────────────────
  fastify.patch('/admin/users/:id/unban', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await usersQueries.unbanUser(db, id)
    if (!result) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    return reply.send({ data: result })
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
    const user = await usersQueries.findAdminUserById(db, id)
    if (!user) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    if (user.role === 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '不能修改 admin 账号的角色', status: 403 },
      })
    }

    const result = await usersQueries.updateUserRole(db, id, parsed.data.role)
    return reply.send({ data: result })
  })

  // ── DELETE /admin/users/:id ──────────────────────────────────
  // UX-07: 软删除（deleted_at = NOW()，数据保留；admin 账号不可删除）
  fastify.delete('/admin/users/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const user = await usersQueries.findAdminUserById(db, id)
    if (!user) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    if (user.role === 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '不能删除 admin 账号', status: 403 },
      })
    }

    const deleted = await usersQueries.softDeleteUser(db, id)
    if (!deleted) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在或已被删除', status: 404 },
      })
    }
    return reply.code(204).send()
  })

  // ── POST /admin/users/:id/reset-password ──────────────────────
  fastify.post('/admin/users/:id/reset-password', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const user = await usersQueries.findAdminUserById(db, id)
    if (!user) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    if (user.role === 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '不能重置 admin 账号密码', status: 403 },
      })
    }

    // 生成随机 12 位密码（大小写字母 + 数字）
    const newPassword = crypto.randomBytes(9).toString('base64url').slice(0, 12)
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    const result = await usersQueries.resetUserPassword(db, id, newPasswordHash)
    if (!result) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }

    // 明文密码一次性返回，不记录日志
    return reply.send({ data: { newPassword } })
  })
}
