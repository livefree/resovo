/**
 * mediaCatalog.internal.ts — mediaCatalog 层内部共享类型与工具
 * 从 mediaCatalog.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 * 本文件不作为公开 import 路径使用，仅供同目录子文件引用。
 */

// ── 内部 DB 行类型 ────────────────────────────────────────────────

export interface DbMediaCatalogRow {
  id: string
  title: string
  title_en: string | null
  title_original: string | null
  /** ADR-175 D-175-1（CHG-VIR-11-C / migration 089）：title_original 语种 BCP47 subtag，NULL=未知 */
  original_language: string | null
  /** ADR-176 D-176-2（CHG-VIR-12-B / migration 090）：正篇季号；NULL=非分季/单季/电影/特别篇 */
  season_number: number | null
  title_normalized: string
  type: string
  genres: string[]
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
  // META-06 新增字段
  aliases: string[]
  languages: string[]
  official_site: string | null
  tags: string[]
  backdrop_url: string | null
  trailer_url: string | null
  created_at: string
  updated_at: string
  // 图片治理字段（IMG-01，ADR-046）
  poster_blurhash: string | null
  poster_primary_color: string | null
  poster_width: number | null
  poster_height: number | null
  poster_status: string | null
  poster_source: string | null
  backdrop_blurhash: string | null
  backdrop_primary_color: string | null
  backdrop_status: string | null
  logo_url: string | null
  logo_status: string | null
  banner_backdrop_url: string | null
  banner_backdrop_blurhash: string | null
  banner_backdrop_status: string | null
  stills_urls: unknown[]
  stills_meta: unknown[]
}

// ── 导出类型（Service 层和调用方使用）────────────────────────────

export interface MediaCatalogRow {
  id: string
  title: string
  titleEn: string | null
  titleOriginal: string | null
  /** ADR-175 D-175-1：title_original 语种（BCP47 subtag；NULL=未知） */
  originalLanguage: string | null
  /** ADR-176 D-176-2：正篇季号（NULL=非分季/单季/电影/特别篇；SP/OVA/剧场版用独立 catalog + edition_of） */
  seasonNumber: number | null
  titleNormalized: string
  type: string
  genres: string[]
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
  // META-06 新增字段
  aliases: string[]
  languages: string[]
  officialSite: string | null
  tags: string[]
  backdropUrl: string | null
  trailerUrl: string | null
  createdAt: string
  updatedAt: string
  // 图片治理字段（IMG-01，ADR-046）
  posterBlurhash: string | null
  posterPrimaryColor: string | null
  posterWidth: number | null
  posterHeight: number | null
  posterStatus: string | null
  posterSource: string | null
  backdropBlurhash: string | null
  backdropPrimaryColor: string | null
  backdropStatus: string | null
  logoUrl: string | null
  logoStatus: string | null
  bannerBackdropUrl: string | null
  bannerBackdropBlurhash: string | null
  bannerBackdropStatus: string | null
  stillsUrls: unknown[]
  stillsMeta: unknown[]
}

export interface CatalogInsertData {
  title: string
  titleEn?: string | null
  titleOriginal?: string | null
  titleNormalized: string
  type: string
  genres?: string[]
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
  // META-06 新增字段
  aliases?: string[]
  languages?: string[]
  officialSite?: string | null
  tags?: string[]
  backdropUrl?: string | null
  trailerUrl?: string | null
}

export interface CatalogUpdateData {
  title?: string
  titleEn?: string | null
  titleOriginal?: string | null
  /** ADR-175 D-175-6：original_language 纳入 safeUpdate 口径（CHG-VIR-11-C） */
  originalLanguage?: string | null
  /** ADR-176 D-176-6：season_number 纳入 safeUpdate 口径（CHG-VIR-12-B；写入=富集/manual，
   *  findOrCreate 不纳入匹配 D-176-7 故 CatalogInsertData 不扩） */
  seasonNumber?: number | null
  titleNormalized?: string
  type?: string
  genres?: string[]
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
  // META-06 新增字段
  aliases?: string[]
  languages?: string[]
  officialSite?: string | null
  tags?: string[]
  backdropUrl?: string | null
  trailerUrl?: string | null
  // 图片治理字段（IMG-01，ADR-046）
  posterBlurhash?: string | null
  posterPrimaryColor?: string | null
  posterWidth?: number | null
  posterHeight?: number | null
  posterStatus?: string | null
  posterSource?: string | null
  backdropBlurhash?: string | null
  backdropPrimaryColor?: string | null
  backdropStatus?: string | null
  logoUrl?: string | null
  logoStatus?: string | null
  bannerBackdropUrl?: string | null
  bannerBackdropBlurhash?: string | null
  bannerBackdropStatus?: string | null
  stillsUrls?: unknown[]
  stillsMeta?: unknown[]
}

// ── 映射函数 ─────────────────────────────────────────────────────

export function mapCatalogRow(row: DbMediaCatalogRow): MediaCatalogRow {
  return {
    id: row.id,
    title: row.title,
    titleEn: row.title_en,
    titleOriginal: row.title_original,
    originalLanguage: row.original_language,
    seasonNumber: row.season_number,
    titleNormalized: row.title_normalized,
    type: row.type,
    genres: row.genres ?? [],
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
    aliases: row.aliases ?? [],
    languages: row.languages ?? [],
    officialSite: row.official_site,
    tags: row.tags ?? [],
    backdropUrl: row.backdrop_url,
    trailerUrl: row.trailer_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    posterBlurhash: row.poster_blurhash ?? null,
    posterPrimaryColor: row.poster_primary_color ?? null,
    posterWidth: row.poster_width ?? null,
    posterHeight: row.poster_height ?? null,
    posterStatus: row.poster_status ?? null,
    posterSource: row.poster_source ?? null,
    backdropBlurhash: row.backdrop_blurhash ?? null,
    backdropPrimaryColor: row.backdrop_primary_color ?? null,
    backdropStatus: row.backdrop_status ?? null,
    logoUrl: row.logo_url ?? null,
    logoStatus: row.logo_status ?? null,
    bannerBackdropUrl: row.banner_backdrop_url ?? null,
    bannerBackdropBlurhash: row.banner_backdrop_blurhash ?? null,
    bannerBackdropStatus: row.banner_backdrop_status ?? null,
    stillsUrls: row.stills_urls ?? [],
    stillsMeta: row.stills_meta ?? [],
  }
}

export const CATALOG_SELECT = `
  SELECT
    id, title, title_en, title_original, original_language, season_number, title_normalized,
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
    stills_urls, stills_meta
  FROM media_catalog
`
