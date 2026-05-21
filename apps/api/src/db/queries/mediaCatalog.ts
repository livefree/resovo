/**
 * mediaCatalog.ts — media_catalog 表 DB 查询
 * 职责：作品元数据层的所有 CRUD 原语
 * 业务规则（优先级判断、locked_fields 校验）由 MediaCatalogService 处理，不在此层实现
 * 写入函数迁至 mediaCatalog.mutations.ts（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool, PoolClient } from 'pg'
import {
  type DbMediaCatalogRow,
  mapCatalogRow,
  CATALOG_SELECT,
} from './mediaCatalog.internal'

export type { MediaCatalogRow, CatalogInsertData, CatalogUpdateData } from './mediaCatalog.internal'
export { insertCatalog, updateCatalogFields, addLockedFields, setLockedFields, linkVideoToCatalog } from './mediaCatalog.mutations'

// ── 查询函数 ──────────────────────────────────────────────────────

export async function findCatalogById(
  db: Pool | PoolClient,
  id: string
) {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT} WHERE id = $1`,
    [id]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

export async function findCatalogByImdbId(
  db: Pool | PoolClient,
  imdbId: string
) {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT} WHERE imdb_id = $1`,
    [imdbId]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

export async function findCatalogByTmdbId(
  db: Pool | PoolClient,
  tmdbId: number
) {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT} WHERE tmdb_id = $1`,
    [tmdbId]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

export async function findCatalogByDoubanId(
  db: Pool | PoolClient,
  doubanId: string
) {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT} WHERE douban_id = $1`,
    [doubanId]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

export async function findCatalogByBangumiId(
  db: Pool | PoolClient,
  bangumiId: number
) {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT} WHERE bangumi_subject_id = $1`,
    [bangumiId]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

/** 无精确外部 ID 时的三元组模糊匹配（title_normalized + year + type） */
export async function findCatalogByNormalizedKey(
  db: Pool | PoolClient,
  titleNormalized: string,
  year: number | null,
  type: string
) {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT}
     WHERE title_normalized = $1
       AND type = $2
       AND year IS NOT DISTINCT FROM $3
     LIMIT 1`,
    [titleNormalized, type, year]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}
