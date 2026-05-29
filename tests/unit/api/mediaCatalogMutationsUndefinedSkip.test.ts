/**
 * tests/unit/api/mediaCatalogMutationsUndefinedSkip.test.ts — CHORE-11 防御兜底
 *
 * 验证 updateCatalogFields 跳过 undefined value 不写 SET 子句：
 * - 旧：`if (key in data) ... params.push(data[key] ?? null)` → `{writers: undefined}`
 *   写成 `writers = null` 触发 5 个 NOT NULL TEXT[] 列违规
 * - 新：`if (key in data && data[key] !== undefined)` → undefined skip；显式 null 仍写入
 *   （支持 nullable 列清空语义）
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { updateCatalogFields } from '@/api/db/queries/mediaCatalog.mutations'
import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog.internal'

const CID = 'cat-1'

function mockDbCapturingSql(): { db: Pool; getSql: () => string; getParams: () => unknown[] } {
  let capturedSql = ''
  let capturedParams: unknown[] = []
  const db = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      capturedSql = sql
      capturedParams = params
      return { rows: [{ id: CID }], rowCount: 1 }
    }),
  } as unknown as Pool
  return { db, getSql: () => capturedSql, getParams: () => capturedParams }
}

describe('updateCatalogFields — CHORE-11 undefined skip 防御兜底', () => {
  it('writers: undefined → SET 子句不含 writers，不写 null（防 NOT NULL 违规）', async () => {
    const { db, getSql, getParams } = mockDbCapturingSql()
    await updateCatalogFields(db, CID, { writers: undefined } as unknown as CatalogUpdateData)

    // 既不出现在列名也不出现在参数里
    expect(getSql()).not.toMatch(/SET[^W]*writers/)
    expect(getParams()).not.toContain(null)
  })

  it('director/cast/writers/genres/genresRaw 全 undefined → 5 列全 skip（最小 SET 子句仅 updated_at）', async () => {
    const { db, getSql } = mockDbCapturingSql()
    await updateCatalogFields(db, CID, {
      director: undefined,
      cast: undefined,
      writers: undefined,
      genres: undefined,
      genresRaw: undefined,
    } as unknown as CatalogUpdateData)

    // 5 列 NOT NULL 全部不出现在 SET（避免 NULL 写入）
    const sql = getSql()
    expect(sql).not.toMatch(/SET[\s\S]*?director\s*=/)
    expect(sql).not.toMatch(/SET[\s\S]*?"cast"\s*=/)
    expect(sql).not.toMatch(/SET[\s\S]*?writers\s*=/)
    expect(sql).not.toMatch(/SET[\s\S]*?genres\s*=/)
    expect(sql).not.toMatch(/SET[\s\S]*?genres_raw\s*=/)
  })

  it('显式 null 值（nullable 列清空）仍正常写入', async () => {
    const { db, getSql, getParams } = mockDbCapturingSql()
    // description / coverUrl 是 nullable，传 null 表示清空
    await updateCatalogFields(db, CID, {
      description: null,
      coverUrl: null,
    } as unknown as CatalogUpdateData)

    expect(getSql()).toMatch(/description\s*=\s*\$\d/)
    expect(getSql()).toMatch(/cover_url\s*=\s*\$\d/)
    expect(getParams()).toContain(null) // null 被 push 进去
  })

  it('混合 undefined + 有效值 → undefined skip / 有效值写入', async () => {
    const { db, getSql, getParams } = mockDbCapturingSql()
    await updateCatalogFields(db, CID, {
      writers: undefined,             // skip
      director: ['张三'],              // 写入
      rating: 8.5,                    // 写入
      genres: undefined,              // skip
    } as unknown as CatalogUpdateData)

    expect(getSql()).not.toMatch(/SET[\s\S]*?writers\s*=/)
    expect(getSql()).not.toMatch(/SET[\s\S]*?genres\s*=/)
    expect(getSql()).toMatch(/director\s*=\s*\$\d/)
    expect(getSql()).toMatch(/rating\s*=\s*\$\d/)
    expect(getParams()).toContain(8.5)
    expect(getParams()).toContainEqual(['张三'])
  })

  it('空数组 [] 视为合法值正常写入（不与 undefined 等同）', async () => {
    const { db, getSql, getParams } = mockDbCapturingSql()
    // schema 允许 NOT NULL DEFAULT '{}'，显式写空数组是合法清空
    await updateCatalogFields(db, CID, {
      writers: [],
      director: [],
    } as unknown as CatalogUpdateData)

    expect(getSql()).toMatch(/director\s*=\s*\$\d/)
    expect(getSql()).toMatch(/writers\s*=\s*\$\d/)
    expect(getParams()).toContainEqual([])
  })

  it('全部 undefined + 没其他字段 → setClauses 为空走早返回 SELECT 路径（不抛错）', async () => {
    const { db } = mockDbCapturingSql()
    const result = await updateCatalogFields(db, CID, {
      writers: undefined,
      director: undefined,
    } as unknown as CatalogUpdateData)

    // 当前实现：setClauses 空 → 走 `${CATALOG_SELECT} WHERE id = $1` 早返回路径
    expect(db.query).toHaveBeenCalled()
    expect(result).not.toBeUndefined()
  })
})
