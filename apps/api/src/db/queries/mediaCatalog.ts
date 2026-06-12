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

// ── 缺口清单（ADR-161 端点 5）─────────────────────────────────────

export interface BangumiGapQueryRow {
  catalogId: string
  bangumiSubjectId: number
  title: string
  year: number | null
  rank: number | null
  coverUrl: string | null
}

const BANGUMI_GAP_WHERE = `
  WHERE mc.bangumi_subject_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM videos v
      WHERE v.catalog_id = mc.id
        AND v.is_published = true
        AND v.deleted_at IS NULL
    )`

/**
 * 缺口清单：有 bangumi_subject_id 但无 published video 的 catalog（= 站内缺失的动漫）。
 * LEFT JOIN bangumi_entries 取 rank 供排序/展示。
 */
export async function listBangumiGaps(
  db: Pool,
  opts: { limit: number; offset: number }
): Promise<BangumiGapQueryRow[]> {
  const result = await db.query<{
    catalog_id: string; bangumi_subject_id: number; title: string
    year: number | null; rank: number | null; cover_url: string | null
  }>(
    `SELECT mc.id AS catalog_id, mc.bangumi_subject_id, mc.title, mc.year,
            be.rank, mc.cover_url
     FROM media_catalog mc
     LEFT JOIN external_data.bangumi_entries be ON be.bangumi_id = mc.bangumi_subject_id
     ${BANGUMI_GAP_WHERE}
     ORDER BY be.rank ASC NULLS LAST, mc.year DESC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [opts.limit, opts.offset]
  )
  return result.rows.map((r) => ({
    catalogId: r.catalog_id,
    bangumiSubjectId: r.bangumi_subject_id,
    title: r.title,
    year: r.year,
    rank: r.rank,
    coverUrl: r.cover_url,
  }))
}

export async function countBangumiGaps(db: Pool): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM media_catalog mc
     ${BANGUMI_GAP_WHERE}`
  )
  return Number(result.rows[0]?.count ?? 0)
}

/** 无精确外部 ID 时的三元组模糊匹配（title_normalized + year + type） */
export async function findCatalogByNormalizedKey(
  db: Pool | PoolClient,
  titleNormalized: string,
  year: number | null,
  type: string,
  seasonNumber?: number | null,
) {
  if (seasonNumber !== undefined) {
    const result = await db.query<DbMediaCatalogRow>(
      `${CATALOG_SELECT}
       WHERE title_normalized = $1
         AND type = $2
         AND year IS NOT DISTINCT FROM $3
         AND season_number IS NOT DISTINCT FROM $4
       LIMIT 1`,
      [titleNormalized, type, year, seasonNumber]
    )
    return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
  }

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
