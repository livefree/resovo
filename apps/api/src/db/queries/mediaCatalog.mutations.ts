/**
 * mediaCatalog.mutations.ts — media_catalog 写入函数
 * 从 mediaCatalog.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool, PoolClient } from 'pg'
import {
  type DbMediaCatalogRow,
  type MediaCatalogRow,
  type CatalogInsertData,
  type CatalogUpdateData,
  mapCatalogRow,
  CATALOG_SELECT,
} from './mediaCatalog.internal'

/** 插入新 catalog 条目，返回插入的行（若有唯一冲突则返回 null） */
export async function insertCatalog(
  db: Pool | PoolClient,
  data: CatalogInsertData
): Promise<MediaCatalogRow | null> {
  const result = await db.query<DbMediaCatalogRow>(
    `INSERT INTO media_catalog (
       title, title_en, title_original, title_normalized,
       type, genres, genres_raw, year, release_date, country, runtime_minutes,
       status, description, cover_url, rating, rating_votes,
       director, "cast", writers,
       imdb_id, tmdb_id, douban_id, bangumi_subject_id,
       metadata_source,
       aliases, languages, official_site, tags, backdrop_url, trailer_url
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16,
       $17, $18, $19,
       $20, $21, $22, $23,
       $24,
       $25, $26, $27, $28, $29, $30
     )
     ON CONFLICT DO NOTHING
     RETURNING
       id, title, title_en, title_original, title_normalized,
       type, genres, genres_raw, year, release_date, country, runtime_minutes,
       status, description, cover_url, rating, rating_votes,
       director, "cast", writers,
       imdb_id, tmdb_id, douban_id, bangumi_subject_id,
       metadata_source, locked_fields,
       aliases, languages, official_site, tags, backdrop_url, trailer_url,
       created_at, updated_at,
       poster_blurhash, poster_primary_color, poster_width, poster_height,
       poster_status, poster_source,
       backdrop_blurhash, backdrop_primary_color, backdrop_status,
       logo_url, logo_status,
       banner_backdrop_url, banner_backdrop_blurhash, banner_backdrop_status,
       stills_urls, stills_meta`,
    [
      data.title,
      data.titleEn ?? null,
      data.titleOriginal ?? null,
      data.titleNormalized,
      data.type,
      data.genres ?? [],
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
      data.aliases ?? [],
      data.languages ?? [],
      data.officialSite ?? null,
      data.tags ?? [],
      data.backdropUrl ?? null,
      data.trailerUrl ?? null,
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
    genres: 'genres',
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
    aliases: 'aliases',
    languages: 'languages',
    officialSite: 'official_site',
    tags: 'tags',
    backdropUrl: 'backdrop_url',
    trailerUrl: 'trailer_url',
    // 图片治理字段（IMG-01，ADR-046）
    posterBlurhash: 'poster_blurhash',
    posterPrimaryColor: 'poster_primary_color',
    posterWidth: 'poster_width',
    posterHeight: 'poster_height',
    posterStatus: 'poster_status',
    posterSource: 'poster_source',
    backdropBlurhash: 'backdrop_blurhash',
    backdropPrimaryColor: 'backdrop_primary_color',
    backdropStatus: 'backdrop_status',
    logoUrl: 'logo_url',
    logoStatus: 'logo_status',
    bannerBackdropUrl: 'banner_backdrop_url',
    bannerBackdropBlurhash: 'banner_backdrop_blurhash',
    bannerBackdropStatus: 'banner_backdrop_status',
    stillsUrls: 'stills_urls',
    stillsMeta: 'stills_meta',
  }

  // CHORE-11 (2026-05-29) — 防御兜底：跳过 undefined value 不写 SET 子句。
  //   旧实现 `if (key in data)` + `data[key] ?? null` 会把 `{writers: undefined}` 写成
  //   `writers = null` 触发 NOT NULL 违规（5 列：director/cast/writers/genres/genres_raw）。
  //   主修在 caller（MetadataEnrichService step2 改条件赋值）；此处加 undefined skip 防未来
  //   caller 同样误用。注意：null（显式赋值 null）仍写入 → 支持 nullable 列清空语义。
  for (const [key, col] of Object.entries(fieldMap) as [keyof CatalogUpdateData, string][]) {
    if (key in data && (data as Record<string, unknown>)[key] !== undefined) {
      setClauses.push(`${col} = $${idx++}`)
      params.push((data as Record<string, unknown>)[key])
    }
  }

  if (setClauses.length === 0) {
    const r = await db.query<DbMediaCatalogRow>(CATALOG_SELECT + ' WHERE id = $1', [id])
    return r.rows[0] ? mapCatalogRow(r.rows[0]) : null
  }

  params.push(id)
  const result = await db.query<DbMediaCatalogRow>(
    `UPDATE media_catalog
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${idx}
     RETURNING
       id, title, title_en, title_original, title_normalized,
       type, genres, genres_raw, year, release_date, country, runtime_minutes,
       status, description, cover_url, rating, rating_votes,
       director, "cast", writers,
       imdb_id, tmdb_id, douban_id, bangumi_subject_id,
       metadata_source, locked_fields,
       aliases, languages, official_site, tags, backdrop_url, trailer_url,
       created_at, updated_at,
       poster_blurhash, poster_primary_color, poster_width, poster_height,
       poster_status, poster_source,
       backdrop_blurhash, backdrop_primary_color, backdrop_status,
       logo_url, logo_status,
       banner_backdrop_url, banner_backdrop_blurhash, banner_backdrop_status,
       stills_urls, stills_meta`,
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
