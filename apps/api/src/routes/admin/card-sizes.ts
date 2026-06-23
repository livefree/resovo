/**
 * card-sizes.ts — 前台卡片尺寸体系 admin route（ADR-215 D-215-1/2）
 *
 * GET /admin/card-sizes           — 3 档全量 CardSizeSettings[]（adminOnly）
 * PUT /admin/card-sizes/:sizeClass — 全替换该档可编辑投影 + audit card_size.update（adminOnly）
 *
 * 校验：sizeClass 枚举外 → 422（先于 404 判定）；body 经 bodySchemaFor 派发的 zod
 *   .strict() 校验，倒置 body（grid+width / scroll+columns）/ 范围越界 → 422（Codex-R1 + D-214-10）。
 * 公开 GET /card-sizes（无鉴权 + Redis 缓存）归 CARD-SIZE-PUBLIC-CACHE。
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'
import {
  CardSizeService,
  CardSizeClassParamSchema,
  bodySchemaFor,
} from '@/api/services/CardSizeService'

export async function adminCardSizeRoutes(fastify: FastifyInstance) {
  const svc = new CardSizeService(db, redis)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/card-sizes ───────────────────────────────────────────────────
  fastify.get('/admin/card-sizes', { preHandler: adminOnly }, async (_request, reply) => {
    const data = await svc.listCardSizes()
    return reply.send({ data })
  })

  // ── PUT /admin/card-sizes/:sizeClass ────────────────────────────────────────
  fastify.put('/admin/card-sizes/:sizeClass', { preHandler: adminOnly }, async (request, reply) => {
    // 非法 sizeClass 枚举外值 → 422（先于 404 判定）
    const classParsed = CardSizeClassParamSchema.safeParse((request.params as { sizeClass: string }).sizeClass)
    if (!classParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: `sizeClass 必须为 ${CardSizeClassParamSchema.options.join(' / ')}`, status: 422 },
      })
    }

    // 据 sizeClass 派发 body schema：.strict() 令倒置 body unknown key + 范围越界 → 422
    const bodyParsed = bodySchemaFor(classParsed.data).safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: bodyParsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    const updated = await svc.updateCardSize(
      classParsed.data,
      bodyParsed.data,
      request.user!.userId,
      request.id,
    )
    if (!updated) {
      // seed 3 行恒存在；缺行 = 迁移漂移兜底
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: `card_size ${classParsed.data} settings 不存在`, status: 404 },
      })
    }
    return reply.send({ data: updated })
  })
}
