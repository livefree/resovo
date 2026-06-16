/**
 * catalogBlockingAliasKeys.ts — catalog_blocking_alias_keys 派生表读写原语
 *   （ADR-206 §META-50-2A 架构裁决 / migration 120 / 2A-1）
 *
 * 表为 alias_normalized blocking 桶的预计算键存储（方案 A）：归一键由 TS `normalizeForExternalMatch`
 * 单一真源算（catalogBlockingKeys.ts 写键 service），本层仅 replace（delete+insert）/ list，不算键。
 * 仅供 blocking 召回 + evidence_hash blockingKeys 并集，不进评分（D-206-6a / 不激活 external_alias_match）。
 */

import type { Pool, PoolClient } from 'pg'

/** 单条 blocking 归一键（PK=(catalog_id, normalized_key)，单 catalog 单键单行，存胜出源信息）。 */
export interface CatalogBlockingAliasKeyRow {
  readonly normalizedKey: string
  readonly source: string
  readonly kind: string
  readonly confidence: number | null
}

interface DbCatalogBlockingAliasKeyRow {
  normalized_key: string
  source: string
  kind: string
  confidence: string | null
}

/**
 * 全量替换某 catalog 的 blocking 归一键（delete + 批量 insert，单事务内幂等重算）。
 * rows 已由写键 service 去重（PK=(catalog_id, normalized_key)，loadKnownNames 归一去重保最强源）。
 * 传 Pool 时自取连接包事务；传 PoolClient 时复用调用方事务。
 */
export async function replaceCatalogBlockingAliasKeys(
  db: Pool | PoolClient,
  catalogId: string,
  rows: readonly CatalogBlockingAliasKeyRow[],
): Promise<void> {
  const hasConnect = typeof (db as Pool).connect === 'function'
  // PoolClient 无 connect；Pool 自取连接包事务保 delete+insert 原子
  if (hasConnect && !('release' in db)) {
    const client = await (db as Pool).connect()
    try {
      await client.query('BEGIN')
      await replaceWithClient(client, catalogId, rows)
      await client.query('COMMIT')
    } catch (err) {
      try { await client.query('ROLLBACK') } catch { /* connection may already be lost */ }
      throw err
    } finally {
      client.release()
    }
    return
  }
  await replaceWithClient(db, catalogId, rows)
}

async function replaceWithClient(
  db: Pool | PoolClient,
  catalogId: string,
  rows: readonly CatalogBlockingAliasKeyRow[],
): Promise<void> {
  await db.query('DELETE FROM catalog_blocking_alias_keys WHERE catalog_id = $1', [catalogId])
  if (rows.length === 0) return
  const values: string[] = []
  const params: unknown[] = [catalogId]
  let i = 2
  for (const row of rows) {
    values.push(`($1, $${i}, $${i + 1}, $${i + 2}, $${i + 3})`)
    params.push(row.normalizedKey, row.source, row.kind, row.confidence)
    i += 4
  }
  await db.query(
    `INSERT INTO catalog_blocking_alias_keys (catalog_id, normalized_key, source, kind, confidence)
     VALUES ${values.join(', ')}`,
    params,
  )
}

/** 列出某 catalog 的全部 blocking 归一键（单 video 召回取 self 键 / 测试用）。 */
export async function listCatalogBlockingAliasKeys(
  db: Pool | PoolClient,
  catalogId: string,
): Promise<CatalogBlockingAliasKeyRow[]> {
  const result = await db.query<DbCatalogBlockingAliasKeyRow>(
    `SELECT normalized_key, source, kind, confidence
       FROM catalog_blocking_alias_keys
      WHERE catalog_id = $1
      ORDER BY normalized_key ASC`,
    [catalogId],
  )
  return result.rows.map((row) => ({
    normalizedKey: row.normalized_key,
    source: row.source,
    kind: row.kind,
    confidence: row.confidence == null ? null : Number(row.confidence),
  }))
}
