/**
 * _datatable.ts — ADR-150 阶段 3 / EP-2 Step 4 / D-150-3 v1 通用 distinct 端点
 *
 * GET /admin/_dt/distinct?table=X&col=Y&q=Z&limit=N
 *   - 鉴权：admin / moderator（与 audit 同级）
 *   - 三重 SQL 注入防御：zod table enum + col lookup + drizzle-style ident 正则二次校验
 *
 * 本路由的 ADR 证据：ADR-150 §4.2（已 Accepted）+ 本卡 CHG-SN-9-DT-AUTOFILTER-EP-2 起 ADR-150 阶段 3。
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { DataTableService } from '@/api/services/datatable/DataTableService'
import {
  DT_DISTINCT_TABLES,
  DT_DISTINCT_WHITELIST,
  type DtDistinctTable,
} from '@/api/services/datatable/distinct-whitelist'

export async function registerDataTableRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin', 'moderator'])]
  const service = new DataTableService(db)

  fastify.get('/admin/_dt/distinct', { preHandler: auth }, async (request, reply) => {
    const QuerySchema = z.object({
      table: z.enum(DT_DISTINCT_TABLES),
      col: z.string().min(1).max(64),
      q: z.string().max(64).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    })
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const { table, col, q, limit } = parsed.data
    const allowedCols = DT_DISTINCT_WHITELIST[table as DtDistinctTable]
    if (!allowedCols?.includes(col)) {
      return reply.code(403).send({
        error: {
          code: 'COLUMN_NOT_WHITELISTED',
          message: '表或列名不在自动过滤白名单内',
          status: 403,
        },
      })
    }
    try {
      const data = await service.distinct(table as DtDistinctTable, col, q, limit)
      return reply.send({ data })
    } catch (err) {
      request.log.error({ err, table, col }, 'distinct query failed')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 },
      })
    }
  })
}
