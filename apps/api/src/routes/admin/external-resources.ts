/**
 * admin/external-resources.ts — 外部资源治理 admin 端点（ADR-188 §端点契约）
 *
 * 本卡（API-A）3 端点（providers / :provider/overview / :provider/activity）；
 * collections / search 见 API-B。路径逐字对齐 ADR-188 §端点契约（verify:endpoint-adr 纯字符串匹配）。
 * 鉴权与 dashboard 同范式（authenticate + requireRole admin）。planned provider → 200 + status:'planned'。
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PROVIDER_KEYS } from '@resovo/types'
import { db } from '@/api/lib/postgres'
import { ExternalResourcesService, type PlannedMarker } from '@/api/services/ExternalResourcesService'

// ── Zod Schemas ───────────────────────────────────────────────────

const ProviderParamSchema = z.object({ provider: z.enum(PROVIDER_KEYS) })

const OverviewQuerySchema = z.object({
  since: z.string().datetime().optional(),
})

const ActivityQuerySchema = z.object({
  operation: z.string().min(1).max(40).optional(),
  method: z.string().min(1).max(20).optional(),
  status: z.string().min(1).max(20).optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1),
})

const CollectionsQuerySchema = z.object({
  collection: z.string().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1),
})

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  /** 在线实时开关：'1'/'true' 开（默认关，仅查 dump）。zod coerce.boolean 对 'false' 误判，故用字符串显式判定。 */
  live: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
})

/** 默认 since = 24h 前（D-188-5） */
function defaultSince(): string {
  return new Date(Date.now() - 24 * 3600_000).toISOString()
}

function isPlanned(result: unknown): result is PlannedMarker {
  return typeof result === 'object' && result !== null && 'status' in result
    && (result as { status?: unknown }).status === 'planned'
}

// ── 路由 ──────────────────────────────────────────────────────────

export async function adminExternalResourcesRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const service = new ExternalResourcesService(db)

  // ── GET /admin/external-resources/providers ─────────────────────
  fastify.get('/admin/external-resources/providers', { preHandler: auth }, async (_request, reply) => {
    const data = await service.getProviders()
    return reply.send({ data })
  })

  // ── GET /admin/external-resources/:provider/overview ────────────
  fastify.get('/admin/external-resources/:provider/overview', { preHandler: auth }, async (request, reply) => {
    const params = ProviderParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '未知外部资源 provider', status: 404 } })
    }
    const query = OverviewQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const result = await service.getOverview(params.data.provider, query.data.since ?? defaultSince())
    if (isPlanned(result)) return reply.send({ data: null, status: 'planned' })
    return reply.send({ data: result })
  })

  // ── GET /admin/external-resources/:provider/activity ────────────
  fastify.get('/admin/external-resources/:provider/activity', { preHandler: auth }, async (request, reply) => {
    const params = ProviderParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '未知外部资源 provider', status: 404 } })
    }
    const query = ActivityQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const { operation, method, status, since, limit, page } = query.data
    const result = await service.getActivity(params.data.provider, {
      ...(operation ? { operation } : {}),
      ...(method ? { method } : {}),
      ...(status ? { status } : {}),
      ...(since ? { since } : {}),
      limit,
      offset: (page - 1) * limit,
    })
    if (isPlanned(result)) return reply.send({ data: null, status: 'planned' })
    return reply.send({ data: result.rows, total: result.total })
  })

  // ── GET /admin/external-resources/:provider/collections ─────────
  fastify.get('/admin/external-resources/:provider/collections', { preHandler: auth }, async (request, reply) => {
    const params = ProviderParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '未知外部资源 provider', status: 404 } })
    }
    const query = CollectionsQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const { collection, limit, page } = query.data
    const result = await service.getCollections(params.data.provider, {
      ...(collection ? { collection } : {}),
      limit,
      offset: (page - 1) * limit,
    })
    if (isPlanned(result)) return reply.send({ data: null, status: 'planned' })
    return reply.send({ data: result.items, total: result.total, summary: result.summary })
  })

  // ── GET /admin/external-resources/:provider/search ──────────────
  fastify.get('/admin/external-resources/:provider/search', { preHandler: auth }, async (request, reply) => {
    const params = ProviderParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '未知外部资源 provider', status: 404 } })
    }
    const query = SearchQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const { q, live, limit, page } = query.data
    const result = await service.unifiedSearch(params.data.provider, {
      q,
      live: live === '1' || live === 'true',
      limit,
      offset: (page - 1) * limit,
    })
    if (isPlanned(result)) return reply.send({ data: null, status: 'planned' })
    // live 限流（busy）降级返回 dump + liveError 标记（非 429 整体失败，ADR-188 D-188-5 ⑤）
    return reply.send({ data: result.rows, total: result.total, ...(result.liveError ? { liveError: result.liveError } : {}) })
  })
}
