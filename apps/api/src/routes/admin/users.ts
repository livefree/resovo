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
import { redis } from '@/api/lib/redis'
import * as usersQueries from '@/api/db/queries/users'
import { AuditLogService } from '@/api/services/AuditLogService'
// ADR-148 R-148-4 / CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-EP-A：user:rca TTL 与 session_timeout_minutes 同步
import { getSetting } from '@/api/db/queries/systemSettings'

// ADR-139 D-139-7：role_changed_at 缓存 key
const ROLE_CHANGED_CACHE_KEY = (userId: string) => `user:rca:${userId}`
// ADR-148 R-148-4：TTL 与 session_timeout_minutes 同步，避免动态 timeout 后权限穿越窗口
// 下限保留 900s（覆盖最小 5min timeout 场景），上限 1440min = 86400s（最大 timeout）
// 防御：getSetting 失败（DB 不可用 / 测试 mock 缺失）→ 降级 900s 下限（不阻塞 role/ban 流程）
const ROLE_CHANGED_CACHE_TTL_FLOOR_SECONDS = 15 * 60  // 900s 下限保护
async function resolveRoleChangedCacheTtl(): Promise<number> {
  let raw: string | null = null
  try {
    raw = await getSetting(db, 'session_timeout_minutes')
  } catch {
    // 降级默认值
  }
  const minutes = raw !== null ? Number(raw) : 60
  const safe = Number.isFinite(minutes) ? minutes : 60
  const clamped = Math.max(5, Math.min(1440, safe))
  return Math.max(ROLE_CHANGED_CACHE_TTL_FLOOR_SECONDS, clamped * 60)
}

export async function adminUserRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const auditSvc = new AuditLogService(db)  // CHG-SN-8-FUP-USERS-ROLE-INV-EP

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
    if (!result) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }

    // ADR-139 N1-139-2 / CHG-SN-8-FUP-USERS-BAN-INV：写 Redis cache 让 middleware 即时校验 token.iat vs role_changed_at
    // 防御性：role_changed_at 字段存在时才写（兼容旧 mock）+ fire-and-forget Redis 不可用降级
    // ADR-148 R-148-4：TTL 与 session_timeout_minutes 同步（避免动态 timeout 后权限穿越窗口）
    if (result.role_changed_at) {
      const ttl = await resolveRoleChangedCacheTtl()
      redis
        .set(ROLE_CHANGED_CACHE_KEY(id), result.role_changed_at, 'EX', ttl)
        .catch((err: unknown) => {
          fastify.log.warn({ err, userId: id }, '[admin/users] ban role_changed_at cache set failed')
        })
    }

    // CHG-SN-8-FUP-USERS-BAN-AUDIT：R-MID-1 第 20 次系统化 user.ban audit
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'user.ban',
      targetKind: 'user',
      targetId: id,
      beforeJsonb: { banned_at: null },
      afterJsonb: { banned_at: result.banned_at },
    })

    return reply.send({ data: { id: result.id, banned_at: result.banned_at } })
  })

  // ── PATCH /admin/users/:id/unban ──────────────────────────────
  fastify.patch('/admin/users/:id/unban', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // CHG-SN-8-FUP-USERS-BAN-AUDIT：先取 before snapshot（banned_at 旧值）
    const before = await usersQueries.findAdminUserById(db, id)
    if (!before) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }

    const result = await usersQueries.unbanUser(db, id)
    if (!result) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }

    // CHG-SN-8-FUP-USERS-BAN-AUDIT：R-MID-1 第 20 次系统化 user.unban audit
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'user.unban',
      targetKind: 'user',
      targetId: id,
      beforeJsonb: { banned_at: before.banned_at },
      afterJsonb: { banned_at: null },
    })

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

    const oldRole = user.role  // CHG-SN-8-FUP-USERS-ROLE-INV-EP：audit before 快照
    const result = await usersQueries.updateUserRole(db, id, parsed.data.role)
    if (!result) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }

    // ADR-139 D-139-7：写 Redis 缓存，middleware/refresh 即时校验 token.iat vs role_changed_at
    // fire-and-forget — Redis 不可用时降级（与现有 blacklist check 一致）
    // ADR-148 R-148-4：TTL 与 session_timeout_minutes 同步
    {
      const ttl = await resolveRoleChangedCacheTtl()
      redis
        .set(ROLE_CHANGED_CACHE_KEY(id), result.role_changed_at, 'EX', ttl)
        .catch((err: unknown) => {
          fastify.log.warn({ err, userId: id }, '[admin/users] role_changed_at cache set failed')
        })
    }

    // R-MID-1：user.role_change actionType + user targetKind audit log
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'user.role_change',
      targetKind: 'user',
      targetId: id,
      beforeJsonb: { role: oldRole },
      afterJsonb: { role: result.role, roleChangedAt: result.role_changed_at },
    })

    return reply.send({ data: { id: result.id, role: result.role } })
  })

  // ── PATCH /admin/users/:id/email （ADR-140 D-140-1）────────────
  const EmailPatchSchema = z.object({
    email: z.string().trim().email('无效邮箱格式').max(255),
  })
  fastify.patch('/admin/users/:id/email', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = EmailPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    const user = await usersQueries.findAdminUserById(db, id)
    if (!user) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    if (user.role === 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '不能修改 admin 账号的邮箱', status: 403 },
      })
    }

    const newEmail = parsed.data.email
    // 同邮箱幂等 — 不写 DB / 不写 audit / 不变更 previousEmail
    if (newEmail === user.email) {
      return reply.send({ data: { id: user.id, email: user.email, previousEmail: user.email } })
    }

    // ADR-140 D-140-2：Service 层先验唯一性（DB UNIQUE 保底；ADR §10 R-140-2）
    const conflict = await usersQueries.findUserByEmailExcludingId(db, newEmail, id)
    if (conflict) {
      return reply.code(409).send({
        error: { code: 'CONFLICT', message: '该邮箱已被其他用户注册', status: 409 },
      })
    }

    try {
      const result = await usersQueries.updateUserEmail(db, id, newEmail)
      if (!result) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
        })
      }

      // R-MID-1：user.email_change actionType + user targetKind audit log
      auditSvc.write({
        actorId: request.user!.userId,
        actionType: 'user.email_change',
        targetKind: 'user',
        targetId: id,
        beforeJsonb: { email: user.email },
        afterJsonb: { email: result.email },
      })

      return reply.send({ data: { id: result.id, email: result.email, previousEmail: user.email } })
    } catch (err: unknown) {
      // PG UNIQUE 违反（race condition）→ 409 CONFLICT；ADR-140 R-140-2 双保险
      const pgErr = err as { code?: string }
      if (pgErr?.code === '23505') {
        return reply.code(409).send({
          error: { code: 'CONFLICT', message: '该邮箱已被其他用户注册', status: 409 },
        })
      }
      throw err
    }
  })

  // ── PATCH /admin/users/:id/profile （ADR-140 D-140-1 + D-140-3）────────────
  // displayName 校验：1-50 + 多语言字母/数字/Emoji/空格/`-_.`
  // null = 清除；undefined / 不传 = 不修改
  const ProfilePatchSchema = z.object({
    displayName: z.string().trim().min(1).max(50)
      .regex(/^[\p{L}\p{N}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\s\-_.]+$/u, 'displayName 含非法字符')
      .nullable()
      .optional(),
    locale: z.string().min(2).max(10)
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/, '无效 locale 格式')
      .optional(),
    avatarUrl: z.string().url().max(500).nullable().optional(),
  }).refine(
    (v) => v.displayName !== undefined || v.locale !== undefined || v.avatarUrl !== undefined,
    { message: '至少需要提供一个字段（displayName / locale / avatarUrl）' },
  )

  fastify.patch('/admin/users/:id/profile', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = ProfilePatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    const user = await usersQueries.findAdminUserById(db, id)
    if (!user) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }
    if (user.role === 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '不能修改 admin 账号的资料', status: 403 },
      })
    }

    // ADR-140 §D-140-5：audit 仅含实际变更的字段（before/after 对齐）
    const beforeJsonb: Record<string, unknown> = {}
    const afterJsonb: Record<string, unknown> = {}
    if (parsed.data.displayName !== undefined) {
      beforeJsonb.displayName = user.display_name
      afterJsonb.displayName = parsed.data.displayName
    }
    if (parsed.data.locale !== undefined) {
      beforeJsonb.locale = user.locale
      afterJsonb.locale = parsed.data.locale
    }
    if (parsed.data.avatarUrl !== undefined) {
      beforeJsonb.avatarUrl = user.avatar_url
      afterJsonb.avatarUrl = parsed.data.avatarUrl
    }

    const result = await usersQueries.updateUserProfile(db, id, {
      displayName: parsed.data.displayName,
      locale: parsed.data.locale,
      avatarUrl: parsed.data.avatarUrl,
    })
    if (!result) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '用户不存在', status: 404 },
      })
    }

    // R-MID-1：user.profile_update audit log
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'user.profile_update',
      targetKind: 'user',
      targetId: id,
      beforeJsonb,
      afterJsonb,
    })

    return reply.send({
      data: {
        id: result.id,
        displayName: result.display_name,
        locale: result.locale,
        avatarUrl: result.avatar_url,
      },
    })
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

  // ── GET /admin/users/stats（ADR-136）─────────────────────────────
  fastify.get('/admin/users/stats', { preHandler: auth }, async (_request, reply) => {
    const row = await usersQueries.statsAdminUsers(db)
    return reply.send({
      data: {
        totalCount: parseInt(row.total_count),
        newTodayCount: parseInt(row.new_today_count),
        bannedCount: parseInt(row.banned_count),
        moderatorCount: parseInt(row.moderator_count),
        generatedAt: new Date().toISOString(),
      },
    })
  })

  // ── POST /admin/users/batch-ban + batch-unban （ADR-143）─────────
  //
  // best-effort per-id（D-143-2）：5 类 skip 守卫（admin/自残/不存在/已 banned/重复）→ skipped；
  // 成功 → banned；非预期错误 → failed。每个成功 ban 写 Redis user:rca + audit user.ban（D-143-4/5）。
  // max 50（D-143-3 与 moderation batch 对齐）；零新 ErrorCode（D-143-6 复用 ADR-110）。

  const BatchBanSchema = z.object({
    ids: z.array(z.string().uuid()).min(1).max(50),
  })

  fastify.post('/admin/users/batch-ban', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchBanSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    const actorId = request.user!.userId
    const uniqueIds = Array.from(new Set(parsed.data.ids))  // D-143-3 去重

    let banned = 0
    let skipped = 0
    let failed = 0

    // ADR-148 R-148-4：batch 内 ttl 复用一次（避免 loop 内重复查 KV）
    const cacheTtl = await resolveRoleChangedCacheTtl()

    for (const id of uniqueIds) {
      try {
        // D-143-3 5 类 skip 守卫
        if (id === actorId) { skipped++; continue }  // 自残保护

        const user = await usersQueries.findAdminUserById(db, id)
        if (!user) { skipped++; continue }  // 不存在 / soft deleted
        if (user.role === 'admin') { skipped++; continue }  // admin 账号
        if (user.banned_at) { skipped++; continue }  // 已 banned（幂等）

        const result = await usersQueries.banUser(db, id)
        if (!result) { skipped++; continue }

        // D-143-4 Redis fire-and-forget（复用单次 ban 范式）
        if (result.role_changed_at) {
          redis
            .set(ROLE_CHANGED_CACHE_KEY(id), result.role_changed_at, 'EX', cacheTtl)
            .catch((err: unknown) => {
              fastify.log.warn({ err, userId: id }, '[admin/users] batch-ban rca cache set failed')
            })
        }

        // D-143-5 per-id audit（与单次 ban 完全一致）
        auditSvc.write({
          actorId,
          actionType: 'user.ban',
          targetKind: 'user',
          targetId: id,
          beforeJsonb: { banned_at: null },
          afterJsonb: { banned_at: result.banned_at },
        })

        banned++
      } catch (err) {
        request.log.error({ err, userId: id }, '[admin/users] batch-ban per-id failed')
        failed++
      }
    }

    return reply.send({ data: { banned, skipped, failed } })
  })

  fastify.post('/admin/users/batch-unban', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchBanSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    const actorId = request.user!.userId
    const uniqueIds = Array.from(new Set(parsed.data.ids))

    let unbanned = 0
    let skipped = 0
    let failed = 0

    for (const id of uniqueIds) {
      try {
        if (id === actorId) { skipped++; continue }  // 自残保护（admin 也不会被 ban，理论无意义但保持对称）

        const user = await usersQueries.findAdminUserById(db, id)
        if (!user) { skipped++; continue }
        if (!user.banned_at) { skipped++; continue }  // 未 banned（幂等）

        const oldBan = user.banned_at
        const result = await usersQueries.unbanUser(db, id)
        if (!result) { skipped++; continue }

        // D-143-5 per-id audit（D-143-4 不写 Redis）
        auditSvc.write({
          actorId,
          actionType: 'user.unban',
          targetKind: 'user',
          targetId: id,
          beforeJsonb: { banned_at: oldBan },
          afterJsonb: { banned_at: null },
        })

        unbanned++
      } catch (err) {
        request.log.error({ err, userId: id }, '[admin/users] batch-unban per-id failed')
        failed++
      }
    }

    return reply.send({ data: { unbanned, skipped, failed } })
  })
}
