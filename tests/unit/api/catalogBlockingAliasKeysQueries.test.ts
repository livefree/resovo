/**
 * tests/unit/api/catalogBlockingAliasKeysQueries.test.ts — META-50-2A-1
 *
 * 验证 catalog_blocking_alias_keys 读写原语 SQL 形状（mock pg）：
 *   - replaceCatalogBlockingAliasKeys：PoolClient 直路 DELETE+多行 INSERT / 空 rows 仅 DELETE / Pool 事务路
 *   - listCatalogBlockingAliasKeys：mapper NUMERIC confidence→number
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import {
  replaceCatalogBlockingAliasKeys,
  listCatalogBlockingAliasKeys,
} from '@/api/db/queries/catalogBlockingAliasKeys'

const CID = 'cat-uuid-1'

function makeClient(rows: Record<string, unknown>[] = []) {
  const calls: { sql: string; params: unknown[] }[] = []
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] })
      return { rows, rowCount: rows.length }
    }),
    release: vi.fn(),
  } as unknown as PoolClient
  return { client, calls }
}

describe('replaceCatalogBlockingAliasKeys — PoolClient 直路', () => {
  it('非空 rows：DELETE + 多行 INSERT（占位符 + 参数）', async () => {
    const { client, calls } = makeClient()
    await replaceCatalogBlockingAliasKeys(client, CID, [
      { normalizedKey: '航海王', source: 'catalog', kind: 'title', confidence: 1.0 },
      { normalizedKey: '海贼王', source: 'douban', kind: 'localized', confidence: 0.9 },
    ])
    expect(calls[0].sql).toContain('DELETE FROM catalog_blocking_alias_keys WHERE catalog_id = $1')
    expect(calls[0].params).toEqual([CID])
    expect(calls[1].sql).toContain('INSERT INTO catalog_blocking_alias_keys (catalog_id, normalized_key, source, kind, confidence)')
    expect(calls[1].sql).toContain('($1, $2, $3, $4, $5), ($1, $6, $7, $8, $9)')
    expect(calls[1].params).toEqual([CID, '航海王', 'catalog', 'title', 1.0, '海贼王', 'douban', 'localized', 0.9])
  })

  it('空 rows：仅 DELETE，不 INSERT', async () => {
    const { client, calls } = makeClient()
    await replaceCatalogBlockingAliasKeys(client, CID, [])
    expect(calls).toHaveLength(1)
    expect(calls[0].sql).toContain('DELETE FROM catalog_blocking_alias_keys')
  })
})

describe('replaceCatalogBlockingAliasKeys — Pool 事务路', () => {
  it('Pool（有 connect 无 release）：自取连接 BEGIN/COMMIT 包 DELETE+INSERT', async () => {
    const { client, calls } = makeClient()
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool
    await replaceCatalogBlockingAliasKeys(pool, CID, [
      { normalizedKey: 'k', source: 'manual', kind: 'aka', confidence: 1.0 },
    ])
    const sqls = calls.map((c) => c.sql)
    expect(sqls[0]).toBe('BEGIN')
    expect(sqls.some((s) => s.includes('DELETE FROM catalog_blocking_alias_keys'))).toBe(true)
    expect(sqls.some((s) => s.includes('INSERT INTO catalog_blocking_alias_keys'))).toBe(true)
    expect(sqls[sqls.length - 1]).toBe('COMMIT')
  })
})

describe('listCatalogBlockingAliasKeys — mapper', () => {
  it('NUMERIC confidence string→number / null→null + snake→camel', async () => {
    const { client } = makeClient([
      { normalized_key: '航海王', source: 'catalog', kind: 'title', confidence: '1.00' },
      { normalized_key: '海贼王', source: 'douban', kind: 'localized', confidence: null },
    ])
    const rows = await listCatalogBlockingAliasKeys(client, CID)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ normalizedKey: '航海王', source: 'catalog', kind: 'title' })
    expect(typeof rows[0].confidence).toBe('number')
    expect(rows[0].confidence).toBe(1)
    expect(rows[1].confidence).toBeNull()
  })
})
