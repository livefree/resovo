/**
 * tests/unit/api/catalogAliasesMutations.test.ts — META-50-3A（ADR-206 D-206-9 M7）
 *
 * 验证 replaceManualAkaAliases 写路径 SQL 形状（mock pg）：
 *   - PoolClient 直路：DELETE manual aka + 逐条 upsert（kind=aka/source=manual/confidence=1.0）
 *   - 去重 + trim 空跳过 / 空列表仅 DELETE（清空语义）
 *   - Pool 事务路：BEGIN…COMMIT 包 delete+insert / 异常 ROLLBACK + 释放连接 + 冒泡
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { replaceManualAkaAliases } from '@/api/db/queries/catalogAliases'

const CID = 'cat-uuid-1'

function makeClient() {
  const calls: { sql: string; params: unknown[] }[] = []
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] })
      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  } as unknown as PoolClient
  return { client, calls }
}

describe('replaceManualAkaAliases — PoolClient 直路', () => {
  it('DELETE manual aka + 逐条 upsert（kind=aka/source=manual/confidence=1.0/维度 NULL）', async () => {
    const { client, calls } = makeClient()
    await replaceManualAkaAliases(client, CID, ['航海王', 'ONE PIECE'])

    expect(calls[0].sql).toContain(
      "DELETE FROM media_catalog_aliases WHERE catalog_id = $1 AND source = 'manual' AND kind = 'aka'",
    )
    expect(calls[0].params).toEqual([CID])
    // upsertStructuredCatalogAlias：INSERT ON CONFLICT，参数序 catalogId/alias/lang/region/script/kind/confidence/source
    expect(calls[1].sql).toContain('INSERT INTO media_catalog_aliases')
    expect(calls[1].params).toEqual([CID, '航海王', null, null, null, 'aka', 1.0, 'manual'])
    expect(calls[2].params).toEqual([CID, 'ONE PIECE', null, null, null, 'aka', 1.0, 'manual'])
    expect(calls).toHaveLength(3)
  })

  it('去重 + trim 空跳过（重复/纯空白只写一次有效值）', async () => {
    const { client, calls } = makeClient()
    await replaceManualAkaAliases(client, CID, ['航海王', '  航海王  ', '', '   ', '海盗'])

    const inserts = calls.filter((c) => c.sql.includes('INSERT INTO media_catalog_aliases'))
    expect(inserts).toHaveLength(2)
    expect(inserts[0].params[1]).toBe('航海王')
    expect(inserts[1].params[1]).toBe('海盗')
  })

  it('空列表：仅 DELETE 不 INSERT（清空 manual aka）', async () => {
    const { client, calls } = makeClient()
    await replaceManualAkaAliases(client, CID, [])
    expect(calls).toHaveLength(1)
    expect(calls[0].sql).toContain('DELETE FROM media_catalog_aliases')
  })
})

describe('replaceManualAkaAliases — Pool 事务路', () => {
  it('Pool（有 connect 无 release）：BEGIN/COMMIT 包 DELETE+upsert + 释放连接', async () => {
    const { client, calls } = makeClient()
    const release = (client as unknown as { release: ReturnType<typeof vi.fn> }).release
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool

    await replaceManualAkaAliases(pool, CID, ['航海王'])

    const sqls = calls.map((c) => c.sql)
    expect(sqls[0]).toBe('BEGIN')
    expect(sqls.some((s) => s.includes('DELETE FROM media_catalog_aliases'))).toBe(true)
    expect(sqls.some((s) => s.includes('INSERT INTO media_catalog_aliases'))).toBe(true)
    expect(sqls[sqls.length - 1]).toBe('COMMIT')
    expect(release).toHaveBeenCalled()
  })

  it('upsert 抛错 → ROLLBACK + 释放连接 + 冒泡', async () => {
    const calls: string[] = []
    const release = vi.fn()
    const client = {
      query: vi.fn(async (sql: string) => {
        calls.push(sql)
        if (sql.includes('INSERT')) throw new Error('boom')
        return { rows: [], rowCount: 0 }
      }),
      release,
    } as unknown as PoolClient
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool

    await expect(replaceManualAkaAliases(pool, CID, ['x'])).rejects.toThrow('boom')
    expect(calls).toContain('ROLLBACK')
    expect(release).toHaveBeenCalled()
  })
})
