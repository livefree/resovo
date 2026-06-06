/**
 * admin/home-modules.ts — 首页运营位编辑 API（CHG-SN-5-05/-06）
 * ADR-104：/admin/home-modules（hyphen 形式；admin only）
 *
 * GET    /admin/home-modules              — 列表（含禁用 + 过期）
 * POST   /admin/home-modules              — 创建
 * PATCH  /admin/home-modules/:id          — 部分更新（禁止修改 enabled，走 publish-toggle）
 * DELETE /admin/home-modules/:id          — 硬删除
 * POST   /admin/home-modules/reorder      — 批量更新 ordering（事务）
 * POST   /admin/home-modules/:id/publish-toggle — 切换 enabled（显式传值）
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import {
  HomeModulesService,
  ListSchema,
  CreateSchema,
  UpdateSchema,
  ReorderSchema,
  PublishToggleSchema,
} from '@/api/services/HomeModulesService'
import { isAppError } from '@/api/lib/errors'

export async function adminHomeModulesRoutes(fastify: FastifyInstance) {
  const svc = new HomeModulesService(db)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/home-modules ───────────────────────────────────────────────

  fastify.get('/admin/home-modules', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = ListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const result = await svc.list(parsed.data)
    return reply.send({ data: result.rows, total: result.total, page: result.page, limit: result.limit })
  })

  // ── POST /admin/home-modules ──────────────────────────────────────────────

  fastify.post('/admin/home-modules', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = CreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const module = await svc.create(parsed.data, request.user!.userId, request.id)
      return reply.code(201).send({ data: module })
    } catch (err) {
      if (isAppError(err, 'STATE_CONFLICT') || isDatabaseCheckViolation(err)) {
        const msg = extractDbConstraintName(err) ?? 'DB CHECK 约束违反'
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: `DB CHECK ${msg} 触发`, status: 409 } })
      }
      request.log.error({ err }, '[admin/home-modules] create unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── PATCH /admin/home-modules/:id ────────────────────────────────────────

  fastify.patch('/admin/home-modules/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = UpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      const isEnabledKey = firstIssue?.code === 'unrecognized_keys' &&
        (firstIssue as { keys?: string[] }).keys?.includes('enabled')
      const message = isEnabledKey
        ? "Unrecognized key 'enabled'（请使用 POST /:id/publish-toggle）"
        : (firstIssue?.message ?? '参数错误')
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message, status: 422 },
      })
    }
    try {
      const module = await svc.update(id, parsed.data, request.user!.userId, request.id)
      if (!module) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: `home_module ${id} 不存在`, status: 404 } })
      }
      return reply.send({ data: module })
    } catch (err) {
      // CHG-HOME-BANNER-UNIFY-A / ADR-181 D-181-1.2(a)：slot 改为 banner 的变相新建防护（service 层抛出）
      if (isAppError(err, 'VALIDATION_ERROR')) {
        return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: err.message, status: 422 } })
      }
      if (isAppError(err, 'STATE_CONFLICT') || isDatabaseCheckViolation(err)) {
        const msg = extractDbConstraintName(err) ?? 'DB CHECK 约束违反'
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: `DB CHECK ${msg} 触发`, status: 409 } })
      }
      request.log.error({ err }, '[admin/home-modules] update unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── DELETE /admin/home-modules/:id ───────────────────────────────────────

  fastify.delete('/admin/home-modules/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const deleted = await svc.delete(id, request.user!.userId, request.id)
    if (!deleted) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: `home_module ${id} 不存在`, status: 404 } })
    }
    return reply.code(204).send()
  })

  // ── POST /admin/home-modules/reorder ─────────────────────────────────────
  // reorder 静态路由须先于 /:id 动态路由注册（Fastify 路由优先级保证）

  fastify.post('/admin/home-modules/reorder', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = ReorderSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.reorder(parsed.data, request.user!.userId, request.id)
      return reply.send({ data: result })
    } catch (err) {
      request.log.error({ err }, '[admin/home-modules] reorder unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── POST /admin/home-modules/:id/publish-toggle ───────────────────────────

  fastify.post('/admin/home-modules/:id/publish-toggle', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = PublishToggleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const module = await svc.publishToggle(id, parsed.data, request.user!.userId, request.id)
    if (!module) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: `home_module ${id} 不存在`, status: 404 } })
    }
    return reply.send({ data: module })
  })
}

// ── DB CHECK 违反检测（并发场景兜底，ADR-104 决策要点 7）────────────────────────

function isDatabaseCheckViolation(err: unknown): boolean {
  if (err instanceof Error) {
    const pg = err as { code?: string }
    return pg.code === '23514'  // PostgreSQL check_violation error code
  }
  return false
}

function extractDbConstraintName(err: unknown): string | null {
  if (err instanceof Error) {
    const pg = err as { constraint?: string }
    return pg.constraint ?? null
  }
  return null
}
