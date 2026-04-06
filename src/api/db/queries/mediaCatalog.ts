/**
 * mediaCatalog.ts — media_catalog 表 DB 查询
 * 职责：作品元数据层的所有 CRUD 原语
 * 业务规则（优先级判断、locked_fields 校验）由 MediaCatalogService 处理，不在此层实现
 */

import type { Pool, PoolClient } from 'pg'

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbMediaCatalogRow {
  id: string
  title: string
  title_en: string | null
  title_original: string | null
  title_normalized: string
  type: string
  genre: string | null
  genres_raw: string[]
  year: number | null
  release_date: string | null
  country: string | null
  runtime_minutes: number | null
  status: string
  description: string | null
  cover_url: string | null
  rating: number | null
  rating_votes: number | null
  director: string[]
  cast: string[]
  writers: string[]
  imdb_id: string | null
  tmdb_id: number | null
  douban_id: string | null
  bangumi_subject_id: number | null
  metadata_source: string
  locked_fields: string[]
  created_at: string
  updated_at: string
}

// ── 导出类型（Service 层和调用方使用）────────────────────────────

export interface MediaCatalogRow {
  id: string
  title: string
  titleEn: string | null
  titleOriginal: string | null
  titleNormalized: string
  type: string
  genre: string | null
  genresRaw: string[]
  year: number | null
  releaseDate: string | null
  country: string | null
  runtimeMinutes: number | null
  status: string
  description: string | null
  coverUrl: string | null
  rating: number | null
  ratingVotes: number | null
  director: string[]
  cast: string[]
  writers: string[]
  imdbId: string | null
  tmdbId: number | null
  doubanId: string | null
  bangumiSubjectId: number | null
  metadataSource: string
  lockedFields: string[]
  createdAt: string
  updatedAt: string
}

export interface CatalogInsertData {
  title: string
  titleEn?: string | null
  titleOriginal?: string | null
  titleNormalized: string
  type: string
  genre?: string | null
  genresRaw?: string[]
  year?: number | null
  releaseDate?: string | null
  country?: string | null
  runtimeMinutes?: number | null
  status?: string
  description?: string | null
  coverUrl?: string | null
  rating?: number | null
  ratingVotes?: number | null
  director?: string[]
  cast?: string[]
  writers?: string[]
  imdbId?: string | null
  tmdbId?: number | null
  doubanId?: string | null
  bangumiSubjectId?: number | null
  metadataSource?: string
}

export interface CatalogUpdateData {
  title?: string
  titleEn?: string | null
  titleOriginal?: string | null
  titleNormalized?: string
  type?: string
  genre?: string | null
  genresRaw?: string[]
  year?: number | null
  releaseDate?: string | null
  country?: string | null
  runtimeMinutes?: number | null
  status?: string
  description?: string | null
  coverUrl?: string | null
  rating?: number | null
  ratingVotes?: number | null
  director?: string[]
  cast?: string[]
  writers?: string[]
  imdbId?: string | null
  tmdbId?: number | null
  doubanId?: string | null
  bangumiSubjectId?: number | null
  metadataSource?: string
}

// ── 映射函数 ─────────────────────────────────────────────────────

function mapCatalogRow(row: DbMediaCatalogRow): MediaCatalogRow {
  return {
    id: row.id,
    title: row.title,
    titleEn: row.title_en,
    titleOriginal: row.title_original,
    titleNormalized: row.title_normalized,
    type: row.type,
    genre: row.genre,
    genresRaw: row.genres_raw ?? [],
    year: row.year,
    releaseDate: row.release_date,
    country: row.country,
    runtimeMinutes: row.runtime_minutes,
    status: row.status,
    description: row.description,
    coverUrl: row.cover_url,
    rating: row.rating,
    ratingVotes: row.rating_votes,
    director: row.director ?? [],
    cast: row.cast ?? [],
    writers: row.writers ?? [],
    imdbId: row.imdb_id,
    tmdbId: row.tmdb_id,
    doubanId: row.douban_id,
    bangumiSubjectId: row.bangumi_subject_id,
    metadataSource: row.metadata_source,
    lockedFields: row.locked_fields ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const CATALOG_SELECT = `
  SELECT
    id, title, title_en, title_original, title_normalized,
    type, genre, genres_raw, year, release_date, country, runtime_minutes,
    status, description, cover_url, rating, rating_votes,
    director, "cast", writers,
    imdb_id, tmdb_id, douban_id, bangumi_subject_id,
    metadata_source, locked_fields, created_at, updated_at
  FROM media_catalog
`

// ── 查询函数 ──────────────────────────────────────────────────────

export async function findCatalogById(
  db: Pool | PoolClient,
  id: string
): Promise<MediaCatalogRow | null> {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT} WHERE id = $1`,
    [id]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

export async function findCatalogByImdbId(
  db: Pool | PoolClient,
  imdbId: string
): Promise<MediaCatalogRow | null> {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT} WHERE imdb_id = $1`,
    [imdbId]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

export async function findCatalogByTmdbId(
  db: Pool | PoolClient,
  tmdbId: number
): Promise<MediaCatalogRow | null> {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT} WHERE tmdb_id = $1`,
    [tmdbId]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

export async function findCatalogByDoubanId(
  db: Pool | PoolClient,
  doubanId: string
): Promise<MediaCatalogRow | null> {
  const result = await db.query<DbMediaCatalogRow>(
    `${CATALOG_SELECT} WHERE douban_id = $1`,
    [doubanId]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

export async function findCatalogByBangumiId(
  db: Pool | PoolClient,
  bangumiId: number
): Promise<MediaCatalogRow | null> {
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
): Promise<MediaCatalogRow | null> {
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

// ── 写入函数 ──────────────────────────────────────────────────────

/** 插入新 catalog 条目，返回插入的行（若有唯一冲突则返回 null） */
export async function insertCatalog(
  db: Pool | PoolClient,
  data: CatalogInsertData
): Promise<MediaCatalogRow | null> {
  const result = await db.query<DbMediaCatalogRow>(
    `INSERT INTO media_catalog (
       title, title_en, title_original, title_normalized,
       type, genre, genres_raw, year, release_date, country, runtime_minutes,
       status, description, cover_url, rating, rating_votes,
       director, "cast", writers,
       imdb_id, tmdb_id, douban_id, bangumi_subject_id,
       metadata_source
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16,
       $17, $18, $19,
       $20, $21, $22, $23,
       $24
     )
     ON CONFLICT DO NOTHING
     RETURNING
       id, title, title_en, title_original, title_normalized,
       type, genre, genres_raw, year, release_date, country, runtime_minutes,
       status, description, cover_url, rating, rating_votes,
       director, "cast", writers,
       imdb_id, tmdb_id, douban_id, bangumi_subject_id,
       metadata_source, locked_fields, created_at, updated_at`,
    [
      data.title,
      data.titleEn ?? null,
      data.titleOriginal ?? null,
      data.titleNormalized,
      data.type,
      data.genre ?? null,
      data.genresRaw ?? [],
      data.year ?? null,
      data.releaseDate ?? null,
      data.country ?? null,
      data.runtimeMinutes ?? null,
      data.status ?? 'completed',
      data.description ?? null,
      data.coverUrl ?? null,
      data.rating ?? null,
      data.ratingVotes ?? null,
      data.director ?? [],
      data.cast ?? [],
      data.writers ?? [],
      data.imdbId ?? null,
      data.tmdbId ?? null,
      data.doubanId ?? null,
      data.bangumiSubjectId ?? null,
      data.metadataSource ?? 'crawler',
    ]
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

/**
 * 更新 catalog 指定字段
 * 注意：locked_fields 校验由调用方（MediaCatalogService.safeUpdate）在调用前完成
 *       此函数不做业务规则判断，只执行 SQL 更新
 */
export async function updateCatalogFields(
  db: Pool | PoolClient,
  id: string,
  data: CatalogUpdateData
): Promise<MediaCatalogRow | null> {
  const setClauses: string[] = []
  const params: unknown[] = []
  let idx = 1

  const fieldMap: Record<keyof CatalogUpdateData, string> = {
    title: 'title',
    titleEn: 'title_en',
    titleOriginal: 'title_original',
    titleNormalized: 'title_normalized',
    type: 'type',
    genre: 'genre',
    genresRaw: 'genres_raw',
    year: 'year',
    releaseDate: 'release_date',
    country: 'country',
    runtimeMinutes: 'runtime_minutes',
    status: 'status',
    description: 'description',
    coverUrl: 'cover_url',
    rating: 'rating',
    ratingVotes: 'rating_votes',
    director: 'director',
    cast: '"cast"',
    writers: 'writers',
    imdbId: 'imdb_id',
    tmdbId: 'tmdb_id',
    doubanId: 'douban_id',
    bangumiSubjectId: 'bangumi_subject_id',
    metadataSource: 'metadata_source',
  }

  for (const [key, col] of Object.entries(fieldMap) as [keyof CatalogUpdateData, string][]) {
    if (key in data) {
      setClauses.push(`${col} = $${idx++}`)
      params.push((data as Record<string, unknown>)[key] ?? null)
    }
  }

  if (setClauses.length === 0) return findCatalogById(db, id)

  params.push(id)
  const result = await db.query<DbMediaCatalogRow>(
    `UPDATE media_catalog
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${idx}
     RETURNING
       id, title, title_en, title_original, title_normalized,
       type, genre, genres_raw, year, release_date, country, runtime_minutes,
       status, description, cover_url, rating, rating_votes,
       director, "cast", writers,
       imdb_id, tmdb_id, douban_id, bangumi_subject_id,
       metadata_source, locked_fields, created_at, updated_at`,
    params
  )
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null
}

/** 将字段名追加到 locked_fields 数组（排重） */
export async function addLockedFields(
  db: Pool | PoolClient,
  id: string,
  fields: string[]
): Promise<void> {
  await db.query(
    `UPDATE media_catalog
     SET locked_fields = (
       SELECT array_agg(DISTINCT elem)
       FROM unnest(locked_fields || $1::text[]) AS elem
     ),
     updated_at = NOW()
     WHERE id = $2`,
    [fields, id]
  )
}

/** 覆盖替换 locked_fields 数组（用于批量设置） */
export async function setLockedFields(
  db: Pool | PoolClient,
  id: string,
  fields: string[]
): Promise<void> {
  await db.query(
    `UPDATE media_catalog
     SET locked_fields = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [fields, id]
  )
}

/** 更新 videos.catalog_id（将平台实例绑定到作品层条目） */
export async function linkVideoToCatalog(
  db: Pool | PoolClient,
  videoId: string,
  catalogId: string
): Promise<void> {
  await db.query(
    `UPDATE videos SET catalog_id = $1, updated_at = NOW() WHERE id = $2`,
    [catalogId, videoId]
  )
}
