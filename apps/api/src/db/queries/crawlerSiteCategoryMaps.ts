/**
 * crawlerSiteCategoryMaps.ts — 站点级分类映射 query 层（ADR-123 / CHG-SN-7-REDO-01-F）
 *
 * 表：crawler_site_category_maps （migration 064）
 * 复合 PK (site_key, source_label) + FK crawler_sites(key) ON DELETE CASCADE
 *
 * 职责：
 *   - listMappingsBySiteKey: 按 site_key 查全部映射（按 source_label ASC 排序）
 *   - replaceMappingsBySiteKey: PUT 全量替换（事务内 DELETE + bulk INSERT）
 *
 * 业务规则（service 层归口）：
 *   - mappings 数组 sourceLabel 唯一约束由 zod refine 保证（PutCategoryMappingSchema）
 *   - target_genre 22 值 CHECK 约束由 DB 层保证
 */

import type { Pool, PoolClient } from 'pg'
import type { CategoryMappingRow, CategoryMappingInput } from '@resovo/types'

interface DbCategoryMappingRow {
  site_key: string
  source_label: string
  target_genre: string
  created_at: string
  updated_at: string
}

function fromDbRow(r: DbCategoryMappingRow): CategoryMappingRow {
  return {
    siteKey: r.site_key,
    sourceLabel: r.source_label,
    targetGenre: r.target_genre as CategoryMappingRow['targetGenre'],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function listMappingsBySiteKey(
  db: Pool,
  siteKey: string,
): Promise<readonly CategoryMappingRow[]> {
  const result = await db.query<DbCategoryMappingRow>(
    `SELECT site_key, source_label, target_genre, created_at, updated_at
       FROM crawler_site_category_maps
      WHERE site_key = $1
      ORDER BY source_label ASC`,
    [siteKey],
  )
  return result.rows.map(fromDbRow)
}

/**
 * PUT 全量替换：事务内先 DELETE 全部该 site_key 行，再 bulk INSERT 新 mappings。
 * 返回 affected = 新写入行数（对运营 PUT 端点 RouteDeleteResult / response 'updated' 字段）。
 * 同 PoolClient 实现保证原子性（参 ADR-105 显式 BEGIN/COMMIT 模式）。
 */
export async function replaceMappingsBySiteKey(
  db: Pool,
  siteKey: string,
  mappings: readonly CategoryMappingInput[],
): Promise<{ readonly written: number; readonly newRows: readonly CategoryMappingRow[] }> {
  const client: PoolClient = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM crawler_site_category_maps WHERE site_key = $1`, [siteKey])
    const inserted: DbCategoryMappingRow[] = []
    for (const m of mappings) {
      const r = await client.query<DbCategoryMappingRow>(
        `INSERT INTO crawler_site_category_maps (site_key, source_label, target_genre)
         VALUES ($1, $2, $3)
         RETURNING site_key, source_label, target_genre, created_at, updated_at`,
        [siteKey, m.sourceLabel, m.targetGenre],
      )
      inserted.push(r.rows[0])
    }
    await client.query('COMMIT')
    return { written: inserted.length, newRows: inserted.map(fromDbRow) }
  } catch (err) {
    try { await client.query('ROLLBACK') } catch { /* ignore rollback failure */ }
    throw err
  } finally {
    client.release()
  }
}

/** 检查 crawler_sites 中 key 是否存在（用于 GET/PUT 404 守卫）*/
export async function siteKeyExists(db: Pool, siteKey: string): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM crawler_sites WHERE key = $1) AS exists`,
    [siteKey],
  )
  return result.rows[0]?.exists ?? false
}
