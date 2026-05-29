/**
 * tests/unit/api/metadataProvenanceQueries.test.ts — CHORE-10
 *
 * 验证 batchUpsertFieldProvenance 修正后 SQL 列数与占位符匹配（5/5）。
 * 修前：INSERT 6 列（含 updated_at）但 values 5 占位符 → Postgres
 *   `INSERT has more target columns than expressions` 抛错，
 *   caller `void ... .catch(stderr)` 静默，所有 provenance 写入实际未落地。
 * 修后：INSERT 5 列（去 updated_at 走 DB DEFAULT NOW()），ON CONFLICT UPDATE 仍显式
 *   `updated_at = NOW()`（UPDATE 不触 column DEFAULT）。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { batchUpsertFieldProvenance } from '@/api/db/queries/metadataProvenance'

const CID = 'cat-1'

describe('batchUpsertFieldProvenance — CHORE-10 SQL 列数/占位符匹配', () => {
  it('单字段：INSERT 5 列 + 5 个 $N 占位符（不含 updated_at）', async () => {
    let capturedSql = ''
    let capturedParams: unknown[] = []
    const mockDb = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        capturedSql = sql
        capturedParams = params
        return { rows: [], rowCount: 1 }
      }),
    } as unknown as Pool

    await batchUpsertFieldProvenance(mockDb, CID, ['description'], 'douban', 'subject-123', 3)

    // 列数：5（catalog_id, field_name, source_kind, source_ref, source_priority）
    expect(capturedSql).toContain('(catalog_id, field_name, source_kind, source_ref, source_priority)')
    expect(capturedSql).not.toMatch(/INSERT INTO[^V]*updated_at/) // updated_at 不在 INSERT 列
    // 占位符：($1, $2, $3, $4, $5)
    expect(capturedSql).toContain('($1, $2, $3, $4, $5)')
    // params 长度 5
    expect(capturedParams).toHaveLength(5)
    expect(capturedParams).toEqual([CID, 'description', 'douban', 'subject-123', 3])
    // ON CONFLICT 仍显式更新 updated_at
    expect(capturedSql).toContain('updated_at = NOW()')
  })

  it('多字段 N=3：列数 5 不变 + 占位符 (3×5=15)', async () => {
    let capturedSql = ''
    let capturedParams: unknown[] = []
    const mockDb = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        capturedSql = sql
        capturedParams = params
        return { rows: [], rowCount: 3 }
      }),
    } as unknown as Pool

    await batchUpsertFieldProvenance(
      mockDb, CID,
      ['description', 'coverUrl', 'rating'],
      'tmdb', 'tt0123456', 4,
    )

    // 3 个 5-tuple
    expect(capturedSql).toContain('($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15)')
    expect(capturedParams).toHaveLength(15)
    // 第一组：catalogId / 'description' / 'tmdb' / 'tt0123456' / 4
    expect(capturedParams.slice(0, 5)).toEqual([CID, 'description', 'tmdb', 'tt0123456', 4])
    // 第二组：catalogId / 'coverUrl' / 'tmdb' / 'tt0123456' / 4
    expect(capturedParams.slice(5, 10)).toEqual([CID, 'coverUrl', 'tmdb', 'tt0123456', 4])
    expect(capturedParams.slice(10, 15)).toEqual([CID, 'rating', 'tmdb', 'tt0123456', 4])
  })

  it('sourceRef 为 null 时正常 push（数据库列 nullable）', async () => {
    let capturedParams: unknown[] = []
    const mockDb = {
      query: vi.fn(async (_sql: string, params: unknown[]) => {
        capturedParams = params
        return { rows: [], rowCount: 1 }
      }),
    } as unknown as Pool

    await batchUpsertFieldProvenance(mockDb, CID, ['rating'], 'crawler', null, 1)
    expect(capturedParams[3]).toBeNull()
  })

  it('fieldNames 空数组 → 不调 db.query（早返回）', async () => {
    const mockDb = { query: vi.fn() } as unknown as Pool
    await batchUpsertFieldProvenance(mockDb, CID, [], 'douban', 'x', 3)
    expect(mockDb.query).not.toHaveBeenCalled()
  })
})
