/**
 * search.ts — 搜索路由
 * GET /search         全文搜索
 * GET /search/suggest 联想词
 *
 * ADR-004: SearchService 只调用 Elasticsearch
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { es } from '@/api/lib/elasticsearch'
import { SearchService } from '@/api/services/SearchService'

const VideoTypeEnum = z.enum(['movie', 'series', 'anime', 'variety'])
const SortEnum = z.enum(['relevance', 'rating', 'latest'])

export async function searchRoutes(fastify: FastifyInstance) {
  const searchService = new SearchService(es)

  // ── GET /search/suggest ──────────────────────────────────────
  // 注意：suggest 必须在 search 之前注册（避免路径冲突）
  fastify.get('/search/suggest', async (request, reply) => {
    const QuerySchema = z.object({
      q: z.string().min(1).max(50),
      limit: z.coerce.number().int().min(1).max(20).default(6),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'q 参数必填',
          status: 422,
        },
      })
    }

    const suggestions = await searchService.suggest(parsed.data.q, parsed.data.limit)
    return reply.send({ data: suggestions })
  })

  // ── GET /search ──────────────────────────────────────────────
  fastify.get('/search', async (request, reply) => {
    const StatusEnum = z.enum(['ongoing', 'completed'])

    const QuerySchema = z.object({
      q: z.string().max(200).optional(),
      type: VideoTypeEnum.optional(),
      category: z.string().optional(),
      year: z.coerce.number().int().min(1900).max(2100).optional(),
      rating_min: z.coerce.number().min(0).max(10).optional(),
      lang: z.string().optional(),
      country: z.string().optional(),
      status: StatusEnum.optional(),
      director: z.string().optional(),
      actor: z.string().optional(),
      writer: z.string().optional(),
      sort: SortEnum.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { rating_min: ratingMin, ...rest } = parsed.data
    const result = await searchService.search({ ...rest, ratingMin })
    return reply.send(result)
  })
}
