/**
 * admin/search.ts — 后台全局搜索 fan-out 端点（ADR-200 §端点契约）
 *
 * GET  /admin/search           — videos/sources/users/tasks（P1）fan-out，按 kind 分组 + 组内 top-N +
 *                                精确命中置顶 + 权限分级（moderator 不返 user，D-200-5）。
 * POST /admin/search/telemetry — 点击埋点（D-200-10.4）：服务端 emit admin_search_click metric。
 *
 * 可观测埋点（D-200-10）：GET 后 emit admin_search_query metric（route 层 request.log + latency）。
 * admin + moderator 可访问；videos 走后台可见性 ES（不调公开 SearchService）。
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ADMIN_SEARCH_KINDS, type AdminSearchKind, type AdminSearchResponseData } from '@resovo/types'
import { es } from '@/api/lib/elasticsearch'
import { db } from '@/api/lib/postgres'
import { AdminSearchService } from '@/api/services/AdminSearchService'
import { hashQuery, checkTelemetryLimit } from '@/api/lib/searchTelemetry'

const QuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(8),
})

/** 点击埋点 body（D-200-10.4）：client 传明文 query，服务端 hashQuery 后 emit、原始 query 不进 emit。 */
const TelemetryBodySchema = z.object({
  query: z.string().trim().min(1).max(200),
  clickedKind: z.enum(ADMIN_SEARCH_KINDS),
  clickedRank: z.number().int().min(1),
  clickedGlobalRank: z.number().int().min(1),
})

/** 从结果组派生 per-kind 计数（D-200-10.1 group_counts） */
function buildGroupCounts(data: AdminSearchResponseData): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const group of data.groups) counts[group.kind] = group.items.length
  return counts
}

// 盐缺失 warn 仅发一次（避免每次 query 刷屏；D-200-10-A fail-closed 可观测）
let saltMissingWarned = false

export async function adminSearchRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin', 'moderator'])]
  const svc = new AdminSearchService(es, db)

  fastify.get('/admin/search', { preHandler: auth }, async (request, reply) => {
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      // 422 校验失败不 emit metric（无有效 query 无统计意义，D-200-10.3）
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'q 参数必填',
          status: 422,
        },
      })
    }
    // requireRole 已确保 admin|moderator；映射 'user' 不可能到达此处
    const role = request.user!.role === 'admin' ? 'admin' : 'moderator'

    // D-200-10.3：route 层 emit admin_search_query（latency 端到端测量）
    const t0 = performance.now()
    const data = await svc.search(parsed.data.q, { limit: parsed.data.limit, role })
    const latencyMs = Math.round(performance.now() - t0)

    const resultTotal = data.groups.reduce((sum, g) => sum + g.items.length, 0)
    const degradedKinds: AdminSearchKind[] = data.groups.filter((g) => g.degraded).map((g) => g.kind)
    const queryHash = hashQuery(parsed.data.q)
    if (queryHash === null && !saltMissingWarned) {
      saltMissingWarned = true
      request.log.warn(
        { metric: 'admin_search_query', salt_missing: true },
        'SEARCH_TELEMETRY_SALT 未配置，query_hash 降级为仅 query_len（D-200-10-A fail-closed）',
      )
    }
    request.log.info(
      {
        metric: 'admin_search_query',
        value: resultTotal,
        query_hash: queryHash ?? undefined,
        query_len: parsed.data.q.trim().length,
        role,
        result_total: resultTotal,
        group_counts: buildGroupCounts(data),
        degraded_kinds: degradedKinds,
        latency_ms: latencyMs,
      },
      'admin search query',
    )

    return reply.send({ data })
  })

  // D-200-10.4：点击埋点 → emit admin_search_click（按 query_hash 关联 query 事件、算 per-kind CTR）
  fastify.post('/admin/search/telemetry', { preHandler: auth }, async (request, reply) => {
    const userId = request.user!.userId
    // 限流（进程内桶 key=userId；超限不 emit，D-200-10-D）
    if (!checkTelemetryLimit(userId)) {
      return reply.code(429).send({
        error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍候', status: 429 },
      })
    }
    const parsed = TelemetryBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'telemetry body 非法',
          status: 422,
        },
      })
    }
    const role = request.user!.role === 'admin' ? 'admin' : 'moderator'
    // 服务端 hashQuery（与 query 事件同盐同算法 → query_hash 必一致）；原始 query 绝不进 emit
    const queryHash = hashQuery(parsed.data.query)
    request.log.info(
      {
        metric: 'admin_search_click',
        query_hash: queryHash ?? undefined,
        clicked_kind: parsed.data.clickedKind,
        clicked_rank: parsed.data.clickedRank,
        clicked_global_rank: parsed.data.clickedGlobalRank,
        role,
      },
      'admin search click',
    )
    return reply.code(204).send()
  })
}
