/**
 * admin/filter-presets.ts — FilterPreset 团队共享 4 端点
 * ADR-144 / CHG-SN-8-FUP-PRESET-TEAM-EP-A
 *
 * 权限：moderator + admin（不开放 user）
 * 端点：
 *   GET    /admin/filter-presets       — list（own private + own shared + 他人 shared）
 *   POST   /admin/filter-presets       — create
 *   PATCH  /admin/filter-presets/:id   — update（仅 owner）
 *   DELETE /admin/filter-presets/:id   — delete（owner 全权 / admin 强制删 shared）
 */
import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { AuditLogService } from '@/api/services/AuditLogService'
import {
  FilterPresetService,
  ListFilterPresetsQuerySchema,
  CreateFilterPresetSchema,
  UpdateFilterPresetSchema,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@/api/services/FilterPresetService'

export async function adminFilterPresetRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const auditSvc = new AuditLogService(db)
  const service = new FilterPresetService(db, auditSvc)

  fastify.get('/admin/filter-presets', { preHandler: auth }, async (request, reply) => {
    const parsed = ListFilterPresetsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const actor = { userId: request.user!.userId, role: request.user!.role }
    const data = await service.list(actor, parsed.data)
    return reply.send({ data })
  })

  fastify.post('/admin/filter-presets', { preHandler: auth }, async (request, reply) => {
    const parsed = CreateFilterPresetSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422, details: parsed.error.issues } })
    }
    const actor = { userId: request.user!.userId, role: request.user!.role }
    try {
      const data = await service.create(actor, parsed.data)
      return reply.code(201).send({ data })
    } catch (err: unknown) {
      if (err instanceof ConflictError) {
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
      }
      throw err
    }
  })

  fastify.patch('/admin/filter-presets/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'id 必须为 UUID', status: 422 } })
    }
    const parsed = UpdateFilterPresetSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422, details: parsed.error.issues } })
    }
    const actor = { userId: request.user!.userId, role: request.user!.role }
    try {
      const data = await service.update(actor, id, parsed.data)
      return reply.send({ data })
    } catch (err: unknown) {
      if (err instanceof NotFoundError)  return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '预设不存在', status: 404 } })
      if (err instanceof ForbiddenError) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: err.message, status: 403 } })
      if (err instanceof ConflictError)  return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
      throw err
    }
  })

  fastify.delete('/admin/filter-presets/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'id 必须为 UUID', status: 422 } })
    }
    const actor = { userId: request.user!.userId, role: request.user!.role }
    try {
      await service.remove(actor, id)
      return reply.code(204).send()
    } catch (err: unknown) {
      if (err instanceof NotFoundError)  return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '预设不存在', status: 404 } })
      if (err instanceof ForbiddenError) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: err.message, status: 403 } })
      throw err
    }
  })
}
