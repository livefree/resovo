/**
 * admin/home-modules.ts — 首页运营位编辑 API 第 1 批（CHG-SN-5-05）
 * ADR-104：/admin/home-modules（hyphen 形式；admin only）
 *
 * GET   /admin/home-modules       — 列表（含禁用 + 过期）
 * POST  /admin/home-modules       — 创建
 * PATCH /admin/home-modules/:id   — 部分更新（禁止修改 enabled，走 publish-toggle）
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { HomeModulesService, ListSchema, CreateSchema, UpdateSchema } from '@/api/services/HomeModulesService'
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
      if (isAppError(err, 'STATE_CONFLICT') || isDatabaseCheckViolation(err)) {
        const msg = extractDbConstraintName(err) ?? 'DB CHECK 约束违反'
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: `DB CHECK ${msg} 触发`, status: 409 } })
      }
      request.log.error({ err }, '[admin/home-modules] update unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
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
