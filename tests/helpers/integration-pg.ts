/**
 * integration-pg.ts — 共享 PG client + fixture helper（CHG-SN-6-INTEGRATION-TEST / RETRO 2/7）
 *
 * 目标：跑真实 PG 子集验证 admin route SQL 真实执行不抛 DatabaseError
 *      （unit test mock pg.Pool.query 不验真 SQL，本层互补防 schema 偏离）
 *
 * 用法：
 *   const db = createIntegrationPool()
 *   await db.query('SELECT 1')
 *   await db.end()
 *
 * 注意：
 *   - 跑前需 dev DB up + migrate 最新（参 npm run preflight）
 *   - 测试**只读 query**（不修改 dev DB 数据；避免污染开发环境）
 *   - DATABASE_URL 必须设（.env.local）
 */

import { Pool } from 'pg'

export function createIntegrationPool(): Pool {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL not set; cannot run integration tests')
  }
  return new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 1000 })
}

/**
 * 验证 query 真实执行不抛错；返回 row count（不验证内容）
 * 适用于"SQL 编译通过 + schema 对齐"验证，与 unit test mock 互补。
 */
export async function assertQueryRuns(db: Pool, sql: string, params?: unknown[]): Promise<number> {
  const result = await db.query(sql, params)
  return result.rowCount ?? 0
}
