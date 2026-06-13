/**
 * admin/integrationCredentials.ts — API 凭证统一管理端点（ADR-173 §端点契约）
 *
 * GET  /admin/integrations/credentials             — 列出所有 provider 凭证视图（遮罩 + 测试状态）
 * PUT  /admin/integrations/credentials/:provider   — 保存/更新某源凭证（占位跳过 + JSONB 合并 + 审计）
 * POST /admin/integrations/credentials/:provider/test — 连接测试（draft 候选 / 已存值，三态取值）
 *
 * 全部 admin only。provider 经 z.enum(可配源) 守门（D-173-9）；未知 → 404。
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PROVIDER_CREDENTIAL_SPECS } from '@resovo/types'
import type { ProviderKey } from '@resovo/types'
import { db } from '@/api/lib/postgres'
import { IntegrationCredentialsService } from '@/api/services/IntegrationCredentialsService'

// 可配凭证的 provider 子集（注册表声明）；douban/imdb 无凭证规格 → 不在此集
const CREDENTIAL_PROVIDERS = PROVIDER_CREDENTIAL_SPECS.map((s) => s.provider)
const ProviderParamSchema = z.object({
  provider: z.enum(CREDENTIAL_PROVIDERS as [ProviderKey, ...ProviderKey[]]),
})
// 字段值动态（按 spec），服务层逐字段按 spec 取用；此处仅校验为对象
const BodySchema = z.record(z.string(), z.unknown())

export async function adminIntegrationCredentialsRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const svc = new IntegrationCredentialsService(db)

  // ── GET /admin/integrations/credentials ─────────────────────
  fastify.get('/admin/integrations/credentials', { preHandler: auth }, async (_request, reply) => {
    const providers = await svc.listForAdmin()
    return reply.send({ data: { providers } })
  })

  // ── PUT /admin/integrations/credentials/:provider ───────────
  fastify.put('/admin/integrations/credentials/:provider', { preHandler: auth }, async (request, reply) => {
    const parsedParam = ProviderParamSchema.safeParse(request.params)
    if (!parsedParam.success) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '未知数据源', status: 404 } })
    }
    const parsedBody = BodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsedBody.error.issues[0]?.message ?? '参数错误', status: 400 },
      })
    }
    await svc.save(parsedParam.data.provider, parsedBody.data, request.user!.userId, request.id)
    return reply.send({ data: { ok: true } })
  })

  // ── POST /admin/integrations/credentials/:provider/test ─────
  fastify.post('/admin/integrations/credentials/:provider/test', { preHandler: auth }, async (request, reply) => {
    const parsedParam = ProviderParamSchema.safeParse(request.params)
    if (!parsedParam.success) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '未知数据源', status: 404 } })
    }
    const parsedBody = BodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsedBody.error.issues[0]?.message ?? '参数错误', status: 400 },
      })
    }
    const result = await svc.test(parsedParam.data.provider, parsedBody.data, request.user!.userId, request.id)
    return reply.send({ data: result })
  })
}
