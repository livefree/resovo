/**
 * DataTableService.ts — ADR-150 阶段 3 / EP-2 Step 3 / D-150-3 v1 通用 distinct 服务
 *
 * 业务逻辑归属：Route 层仅 zod 验证 + 白名单 lookup（403 早返回）；
 * 本 Service 持有 SQL 模板 + LIMIT 强制 + 参数化查询（CLAUDE.md "Route → Service → DB queries" 严格遵循）。
 *
 * SQL 注入三重防御：
 *   1. zod table enum 白名单（route 层）
 *   2. col 后置 lookup（route 层 / 白名单 miss → 403）
 *   3. SQL 列名通过白名单 const 字符串插值（不接外部输入）+ identifier 正则启动期校验
 */

import type { Pool } from 'pg'
import {
  DT_DISTINCT_COLUMN_SQL,
  DT_DISTINCT_FROM,
  DT_DISTINCT_IDENT_REGEX,
  type DtDistinctTable,
} from './distinct-whitelist'

export interface DistinctResult {
  readonly value: string
  readonly count: number
}

export class DataTableService {
  constructor(private readonly db: Pool) {}

  /**
   * 通用 distinct 查询（D-150-3 v1）。
   * @throws Error 当 tableName / columnName 不在白名单内（route 层应已拦截 / 本错误是兜底）
   */
  async distinct(
    tableName: DtDistinctTable,
    columnName: string,
    q: string | undefined,
    limit: number,
  ): Promise<readonly DistinctResult[]> {
    const colsMap = DT_DISTINCT_COLUMN_SQL[tableName]
    if (!colsMap) throw new Error(`table "${tableName}" not whitelisted`)
    const sqlCol = colsMap[columnName]
    if (!sqlCol) throw new Error(`column "${columnName}" not whitelisted for table "${tableName}"`)
    if (!DT_DISTINCT_IDENT_REGEX.test(sqlCol)) throw new Error(`invalid SQL ident "${sqlCol}"`)
    const fromTable = DT_DISTINCT_FROM[tableName] ?? tableName
    if (!DT_DISTINCT_IDENT_REGEX.test(`${fromTable}.x`)) throw new Error(`invalid FROM table "${fromTable}"`)

    const clampedLimit = Math.min(200, Math.max(1, limit))
    const params: (string | number)[] = []
    let sql: string
    if (q) {
      params.push(`%${q}%`, clampedLimit)
      sql = `SELECT ${sqlCol} AS value, COUNT(*)::int AS count
             FROM ${fromTable}
             WHERE ${sqlCol} IS NOT NULL
               AND ${sqlCol}::text ILIKE $1
             GROUP BY ${sqlCol}
             ORDER BY count DESC, value ASC
             LIMIT $2`
    } else {
      params.push(clampedLimit)
      sql = `SELECT ${sqlCol} AS value, COUNT(*)::int AS count
             FROM ${fromTable}
             WHERE ${sqlCol} IS NOT NULL
             GROUP BY ${sqlCol}
             ORDER BY count DESC, value ASC
             LIMIT $1`
    }
    const result = await this.db.query<{ value: unknown; count: number }>(sql, params)
    return result.rows.map((r) => ({
      value: r.value === null || r.value === undefined ? '' : String(r.value),
      count: r.count,
    }))
  }
}
