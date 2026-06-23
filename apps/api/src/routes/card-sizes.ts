/**
 * card-sizes.ts — 前台卡片尺寸体系公开只读 route（ADR-215 D-215-6）
 *
 * GET /card-sizes — 无鉴权只读，供前台 SSR 取数；3 档 CardSizeSettings[]（Redis 读穿缓存）。
 *
 * 失效协议：admin PUT /admin/card-sizes/:sizeClass 写提交后 best-effort del 该缓存
 *   （CardSizeService.invalidatePublicCache，D-215-6），陈旧由 TTL 自愈。
 * 非 admin route，不触 verify:endpoint-adr 红线（仍登记于 ADR-215 端点契约表第 3 行）。
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'
import { CardSizeService } from '@/api/services/CardSizeService'

export async function cardSizeRoutes(fastify: FastifyInstance) {
  const svc = new CardSizeService(db, redis)

  // ── GET /card-sizes（无鉴权只读，SSR 取数）──────────────────────────────────
  fastify.get('/card-sizes', async (_request, reply) => {
    const data = await svc.getPublicCardSizes()
    return reply.send({ data })
  })
}
