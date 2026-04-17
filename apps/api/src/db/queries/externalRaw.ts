/**
 * externalRaw.ts — 外部原始数据暂存表 DB 查询
 * 唯一职责：external_import_batches / external_*_raw / external_imdb_tmdb_links 的原子写读操作
 */

import type { Pool } from 'pg'

// ── Batch 管理 ────────────────────────────────────────────────────

export async function createImportBatch(
  db: Pool,
  source: 'douban' | 'tmdb' | 'bangumi' | 'movielens',
  fileName: string,
  fileSizeBytes?: number
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO external_import_batches (source, file_name, file_size_bytes, status, started_at)
     VALUES ($1, $2, $3, 'running', NOW())
     RETURNING id`,
    [source, fileName, fileSizeBytes ?? null]
  )
  return result.rows[0].id
}

export async function finishImportBatch(
  db: Pool,
  batchId: string,
  importedRows: number,
  status: 'done' | 'failed',
  errorMsg?: string
): Promise<void> {
  await db.query(
    `UPDATE external_import_batches
     SET status = $1, imported_rows = $2, finished_at = NOW(), error_msg = $3
     WHERE id = $4`,
    [status, importedRows, errorMsg ?? null, batchId]
  )
}

export async function updateBatchProgress(
  db: Pool,
  batchId: string,
  importedRows: number
): Promise<void> {
  await db.query(
    `UPDATE external_import_batches SET imported_rows = $1 WHERE id = $2`,
    [importedRows, batchId]
  )
}

// ── Douban 原始数据 ────────────────────────────────────────────────

export interface DoubanRawInsert {
  movieId: string | null
  name: string | null
  alias: string | null
  actors: string | null
  cover: string | null
  directors: string | null
  doubanScore: number | null
  doubanVotes: number | null
  genres: string | null
  imdbId: string | null
  languages: string | null
  mins: number | null
  regions: string | null
  releaseDate: string | null
  slug: string | null
  storyline: string | null
  tags: string | null
  year: number | null
}

export async function batchInsertDoubanRaw(
  db: Pool,
  batchId: string,
  rows: DoubanRawInsert[]
): Promise<void> {
  if (rows.length === 0) return
  await db.query(
    `INSERT INTO external_douban_movies_raw
       (batch_id, movie_id, name, alias, actors, cover, directors,
        douban_score, douban_votes, genres, imdb_id, languages, mins,
        regions, release_date, slug, storyline, tags, year)
     SELECT
       $1::UUID,
       unnest($2::TEXT[]),  unnest($3::TEXT[]),  unnest($4::TEXT[]),
       unnest($5::TEXT[]),  unnest($6::TEXT[]),  unnest($7::TEXT[]),
       unnest($8::NUMERIC[]), unnest($9::NUMERIC[]), unnest($10::TEXT[]),
       unnest($11::TEXT[]), unnest($12::TEXT[]), unnest($13::NUMERIC[]),
       unnest($14::TEXT[]), unnest($15::TEXT[]), unnest($16::TEXT[]),
       unnest($17::TEXT[]), unnest($18::TEXT[]), unnest($19::INT[])`,
    [
      batchId,
      rows.map(r => r.movieId),
      rows.map(r => r.name),
      rows.map(r => r.alias),
      rows.map(r => r.actors),
      rows.map(r => r.cover),
      rows.map(r => r.directors),
      rows.map(r => r.doubanScore),
      rows.map(r => r.doubanVotes),
      rows.map(r => r.genres),
      rows.map(r => r.imdbId),
      rows.map(r => r.languages),
      rows.map(r => r.mins),
      rows.map(r => r.regions),
      rows.map(r => r.releaseDate),
      rows.map(r => r.slug),
      rows.map(r => r.storyline),
      rows.map(r => r.tags),
      rows.map(r => r.year),
    ]
  )
}

export interface DoubanRawRow extends DoubanRawInsert {
  id: number
  batchId: string
  catalogId: string | null
}

export async function fetchUnprocessedDoubanRows(
  db: Pool,
  batchId: string | null,
  afterId: number,
  limit: number
): Promise<DoubanRawRow[]> {
  const result = await db.query<{
    id: number; batch_id: string; movie_id: string | null; name: string | null
    alias: string | null; actors: string | null; cover: string | null
    directors: string | null; douban_score: string | null; douban_votes: string | null
    genres: string | null; imdb_id: string | null; languages: string | null
    mins: string | null; regions: string | null; release_date: string | null
    slug: string | null; storyline: string | null; tags: string | null
    year: number | null; catalog_id: string | null
  }>(
    `SELECT id, batch_id, movie_id, name, alias, actors, cover, directors,
            douban_score, douban_votes, genres, imdb_id, languages, mins,
            regions, release_date, slug, storyline, tags, year, catalog_id
     FROM external_douban_movies_raw
     WHERE catalog_id IS NULL
       AND ($1::UUID IS NULL OR batch_id = $1)
       AND id > $2
     ORDER BY id
     LIMIT $3`,
    [batchId, afterId, limit]
  )
  return result.rows.map(r => ({
    id: r.id,
    batchId: r.batch_id,
    movieId: r.movie_id,
    name: r.name,
    alias: r.alias,
    actors: r.actors,
    cover: r.cover,
    directors: r.directors,
    doubanScore: r.douban_score != null ? Number(r.douban_score) : null,
    doubanVotes: r.douban_votes != null ? Number(r.douban_votes) : null,
    genres: r.genres,
    imdbId: r.imdb_id,
    languages: r.languages,
    mins: r.mins != null ? Number(r.mins) : null,
    regions: r.regions,
    releaseDate: r.release_date,
    slug: r.slug,
    storyline: r.storyline,
    tags: r.tags,
    year: r.year,
    catalogId: r.catalog_id,
  }))
}

// ── TMDB 原始数据 ─────────────────────────────────────────────────

export interface TmdbRawInsert {
  tmdbId: number | null
  title: string | null
  originalTitle: string | null
  imdbId: string | null
  releaseDate: string | null
  runtime: number | null
  adult: boolean
  posterPath: string | null
  overview: string | null
  genres: string | null
  productionCountries: string | null
  spokenLanguages: string | null
  voteAverage: number | null
  voteCount: number | null
}

export async function batchInsertTmdbRaw(
  db: Pool,
  batchId: string,
  rows: TmdbRawInsert[]
): Promise<void> {
  if (rows.length === 0) return
  await db.query(
    `INSERT INTO external_tmdb_movies_raw
       (batch_id, tmdb_id, title, original_title, imdb_id, release_date, runtime,
        adult, poster_path, overview, genres, production_countries, spoken_languages,
        vote_average, vote_count)
     SELECT
       $1::UUID,
       unnest($2::INT[]),   unnest($3::TEXT[]),  unnest($4::TEXT[]),
       unnest($5::TEXT[]),  unnest($6::TEXT[]),  unnest($7::INT[]),
       unnest($8::BOOLEAN[]), unnest($9::TEXT[]), unnest($10::TEXT[]),
       unnest($11::TEXT[]), unnest($12::TEXT[]), unnest($13::TEXT[]),
       unnest($14::NUMERIC[]), unnest($15::INT[])
     ON CONFLICT (tmdb_id) WHERE tmdb_id IS NOT NULL DO NOTHING`,
    [
      batchId,
      rows.map(r => r.tmdbId),
      rows.map(r => r.title),
      rows.map(r => r.originalTitle),
      rows.map(r => r.imdbId),
      rows.map(r => r.releaseDate),
      rows.map(r => r.runtime),
      rows.map(r => r.adult),
      rows.map(r => r.posterPath),
      rows.map(r => r.overview),
      rows.map(r => r.genres),
      rows.map(r => r.productionCountries),
      rows.map(r => r.spokenLanguages),
      rows.map(r => r.voteAverage),
      rows.map(r => r.voteCount),
    ]
  )
}

export interface TmdbRawRow extends TmdbRawInsert {
  id: number
  batchId: string
  catalogId: string | null
}

export async function fetchUnprocessedTmdbRows(
  db: Pool,
  batchId: string | null,
  afterId: number,
  limit: number
): Promise<TmdbRawRow[]> {
  const result = await db.query<{
    id: number; batch_id: string; tmdb_id: number | null; title: string | null
    original_title: string | null; imdb_id: string | null; release_date: string | null
    runtime: number | null; adult: boolean; poster_path: string | null
    overview: string | null; genres: string | null
    production_countries: string | null; spoken_languages: string | null
    vote_average: string | null; vote_count: number | null; catalog_id: string | null
  }>(
    `SELECT id, batch_id, tmdb_id, title, original_title, imdb_id, release_date, runtime,
            adult, poster_path, overview, genres, production_countries, spoken_languages,
            vote_average, vote_count, catalog_id
     FROM external_tmdb_movies_raw
     WHERE catalog_id IS NULL
       AND ($1::UUID IS NULL OR batch_id = $1)
       AND id > $2
     ORDER BY id
     LIMIT $3`,
    [batchId, afterId, limit]
  )
  return result.rows.map(r => ({
    id: r.id,
    batchId: r.batch_id,
    tmdbId: r.tmdb_id,
    title: r.title,
    originalTitle: r.original_title,
    imdbId: r.imdb_id,
    releaseDate: r.release_date,
    runtime: r.runtime,
    adult: r.adult,
    posterPath: r.poster_path,
    overview: r.overview,
    genres: r.genres,
    productionCountries: r.production_countries,
    spokenLanguages: r.spoken_languages,
    voteAverage: r.vote_average != null ? Number(r.vote_average) : null,
    voteCount: r.vote_count,
    catalogId: r.catalog_id,
  }))
}

// ── Bangumi 原始数据 ──────────────────────────────────────────────

export interface BangumiRawInsert {
  bangumiId: number
  bgmType: number
  name: string | null
  nameCn: string | null
  date: string | null
  platform: number | null
  summary: string | null
  tags: unknown
}

export async function batchInsertBangumiRaw(
  db: Pool,
  batchId: string,
  rows: BangumiRawInsert[]
): Promise<void> {
  if (rows.length === 0) return
  await db.query(
    `INSERT INTO external_bangumi_subjects_raw
       (batch_id, bangumi_id, bgm_type, name, name_cn, date, platform, summary, tags)
     SELECT
       $1::UUID,
       unnest($2::INT[]),  unnest($3::INT[]),  unnest($4::TEXT[]),
       unnest($5::TEXT[]), unnest($6::TEXT[]), unnest($7::INT[]),
       unnest($8::TEXT[]), unnest($9::JSONB[])
     ON CONFLICT (bangumi_id) DO NOTHING`,
    [
      batchId,
      rows.map(r => r.bangumiId),
      rows.map(r => r.bgmType),
      rows.map(r => r.name),
      rows.map(r => r.nameCn),
      rows.map(r => r.date),
      rows.map(r => r.platform),
      rows.map(r => r.summary),
      rows.map(r => JSON.stringify(r.tags ?? [])),
    ]
  )
}

export interface BangumiRawRow extends BangumiRawInsert {
  id: number
  batchId: string
  catalogId: string | null
}

export async function fetchUnprocessedBangumiRows(
  db: Pool,
  batchId: string | null,
  afterId: number,
  limit: number
): Promise<BangumiRawRow[]> {
  const result = await db.query<{
    id: number; batch_id: string; bangumi_id: number; bgm_type: number
    name: string | null; name_cn: string | null; date: string | null
    platform: number | null; summary: string | null; tags: unknown
    catalog_id: string | null
  }>(
    `SELECT id, batch_id, bangumi_id, bgm_type, name, name_cn, date, platform, summary, tags, catalog_id
     FROM external_bangumi_subjects_raw
     WHERE catalog_id IS NULL
       AND bgm_type IN (2, 6)
       AND ($1::UUID IS NULL OR batch_id = $1)
       AND id > $2
     ORDER BY id
     LIMIT $3`,
    [batchId, afterId, limit]
  )
  return result.rows.map(r => ({
    id: r.id,
    batchId: r.batch_id,
    bangumiId: r.bangumi_id,
    bgmType: r.bgm_type,
    name: r.name,
    nameCn: r.name_cn,
    date: r.date,
    platform: r.platform,
    summary: r.summary,
    tags: r.tags,
    catalogId: r.catalog_id,
  }))
}

// ── MovieLens ID 桥接 ─────────────────────────────────────────────

export interface MovieLensLinkInsert {
  movielensId: number
  imdbId: string
  tmdbId: number
}

export async function batchInsertMovieLensLinks(
  db: Pool,
  rows: MovieLensLinkInsert[]
): Promise<void> {
  if (rows.length === 0) return
  await db.query(
    `INSERT INTO external_imdb_tmdb_links (movielens_id, imdb_id, tmdb_id)
     SELECT unnest($1::INT[]), unnest($2::TEXT[]), unnest($3::INT[])
     ON CONFLICT DO NOTHING`,
    [rows.map(r => r.movielensId), rows.map(r => r.imdbId), rows.map(r => r.tmdbId)]
  )
}

export async function lookupTmdbByImdbId(
  db: Pool,
  imdbId: string
): Promise<number | null> {
  const result = await db.query<{ tmdb_id: number }>(
    `SELECT tmdb_id FROM external_imdb_tmdb_links WHERE imdb_id = $1 LIMIT 1`,
    [imdbId]
  )
  return result.rows[0]?.tmdb_id ?? null
}

// ── 通用：更新原始表 catalog_id 回填 ─────────────────────────────

export type ExternalRawTable =
  | 'external_douban_movies_raw'
  | 'external_tmdb_movies_raw'
  | 'external_bangumi_subjects_raw'

const ALLOWED_TABLES: ReadonlySet<string> = new Set([
  'external_douban_movies_raw',
  'external_tmdb_movies_raw',
  'external_bangumi_subjects_raw',
])

export async function updateRawRowCatalogId(
  db: Pool,
  table: ExternalRawTable,
  rawRowId: number,
  catalogId: string
): Promise<void> {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`)
  await db.query(
    `UPDATE ${table} SET catalog_id = $1 WHERE id = $2`,
    [catalogId, rawRowId]
  )
}
