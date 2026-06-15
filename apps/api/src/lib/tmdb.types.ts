/**
 * tmdb.types.ts — TMDb v3 REST API 响应类型（ADR-201 §TMDB 元数据范围 / META-38）
 *
 * 仅取本项目消费字段子集（对标 bangumi.ts「v0 schema 子集」哲学）：search / detail +
 * append_to_response（external_ids / images / videos / credits / aggregate_credits /
 * content_ratings · release_dates / translations）+ configuration。
 *
 * append 字段在 detail 响应里为**可选嵌套**（仅当 append_to_response 请求时出现），故全 optional。
 */

// ── append_to_response 键（ADR-201 22838）─────────────────────────────────────

/**
 * 可附加到 detail 请求的 append_to_response 键。movie / tv 可用子集不同：
 * - movie：external_ids / images / videos / credits / release_dates / translations
 * - tv：external_ids / images / videos / aggregate_credits（或 credits）/ content_ratings / translations
 */
export const TMDB_APPEND_KEYS = [
  'external_ids',
  'images',
  'videos',
  'credits',
  'aggregate_credits',
  'content_ratings',
  'release_dates',
  'translations',
] as const
export type TmdbAppendKey = (typeof TMDB_APPEND_KEYS)[number]

// ── 通用 ──────────────────────────────────────────────────────────────────────

export interface TmdbGenre {
  id: number
  name: string
}

/** 分页搜索/列表响应信封（results 元素由调用方参数化）。 */
export interface TmdbPagedResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface TmdbMovieSearchItem {
  id: number
  title: string
  original_title: string
  original_language: string
  overview: string
  release_date: string
  poster_path: string | null
  backdrop_path: string | null
  genre_ids: number[]
  popularity: number
  vote_average: number
  vote_count: number
  adult: boolean
  video: boolean
}

export interface TmdbTvSearchItem {
  id: number
  name: string
  original_name: string
  original_language: string
  overview: string
  first_air_date: string
  poster_path: string | null
  backdrop_path: string | null
  genre_ids: number[]
  origin_country: string[]
  popularity: number
  vote_average: number
  vote_count: number
}

export type TmdbMovieSearchResponse = TmdbPagedResponse<TmdbMovieSearchItem>
export type TmdbTvSearchResponse = TmdbPagedResponse<TmdbTvSearchItem>

// ── append: external_ids（ADR-201 D-201-A：IMDb 经 TMDB external_ids 间接填充）──

export interface TmdbExternalIds {
  imdb_id: string | null
  /** 仅 tv：TheTVDB id。 */
  tvdb_id?: number | null
  wikidata_id?: string | null
  facebook_id?: string | null
  instagram_id?: string | null
  twitter_id?: string | null
}

// ── append: images ────────────────────────────────────────────────────────────

export interface TmdbImage {
  file_path: string
  width: number
  height: number
  aspect_ratio: number
  vote_average: number
  vote_count: number
  /** 语言 ISO 639-1，无语种素材为 null。 */
  iso_639_1: string | null
}

export interface TmdbImages {
  backdrops: TmdbImage[]
  posters: TmdbImage[]
  /** 透明 PNG 台标（decisions.md 763：纳入 logo_url/logo_status 填充）。 */
  logos: TmdbImage[]
}

// ── append: videos ────────────────────────────────────────────────────────────

export interface TmdbVideo {
  id: string
  key: string
  name: string
  site: string
  type: string
  size: number
  official: boolean
  published_at: string
  iso_639_1: string
  iso_3166_1: string
}

export interface TmdbVideosAppend {
  results: TmdbVideo[]
}

// ── append: credits / aggregate_credits ───────────────────────────────────────

export interface TmdbCastMember {
  id: number
  name: string
  original_name: string
  character: string
  order: number
  profile_path: string | null
  known_for_department: string
}

export interface TmdbCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TmdbCredits {
  cast: TmdbCastMember[]
  crew: TmdbCrewMember[]
}

/** tv aggregate_credits：cast 角色聚合在 roles[]（与 movie credits 结构不同）。 */
export interface TmdbAggregateCastMember {
  id: number
  name: string
  original_name: string
  total_episode_count: number
  order: number
  profile_path: string | null
  roles: { character: string; episode_count: number }[]
}

export interface TmdbAggregateCredits {
  cast: TmdbAggregateCastMember[]
  crew: TmdbCrewMember[]
}

// ── append: release_dates（movie）/ content_ratings（tv）────────────────────────

export interface TmdbReleaseDateEntry {
  certification: string
  iso_639_1: string
  release_date: string
  type: number
}

export interface TmdbReleaseDates {
  results: { iso_3166_1: string; release_dates: TmdbReleaseDateEntry[] }[]
}

export interface TmdbContentRatings {
  results: { iso_3166_1: string; rating: string }[]
}

// ── append: translations ──────────────────────────────────────────────────────

export interface TmdbTranslation {
  iso_3166_1: string
  iso_639_1: string
  name: string
  english_name: string
  data: {
    title?: string
    name?: string
    overview: string
    tagline?: string
    homepage?: string
  }
}

export interface TmdbTranslations {
  translations: TmdbTranslation[]
}

// ── Detail（base + append optional）───────────────────────────────────────────

export interface TmdbMovieDetail {
  id: number
  imdb_id: string | null
  title: string
  original_title: string
  original_language: string
  overview: string
  tagline: string
  release_date: string
  runtime: number | null
  status: string
  genres: TmdbGenre[]
  production_countries: { iso_3166_1: string; name: string }[]
  poster_path: string | null
  backdrop_path: string | null
  popularity: number
  vote_average: number
  vote_count: number
  adult: boolean
  homepage: string | null
  // append_to_response（仅请求时出现）
  external_ids?: TmdbExternalIds
  images?: TmdbImages
  videos?: TmdbVideosAppend
  credits?: TmdbCredits
  release_dates?: TmdbReleaseDates
  translations?: TmdbTranslations
}

export interface TmdbTvDetail {
  id: number
  name: string
  original_name: string
  original_language: string
  overview: string
  tagline: string
  first_air_date: string
  last_air_date: string | null
  number_of_seasons: number
  number_of_episodes: number
  episode_run_time: number[]
  status: string
  type: string
  in_production: boolean
  genres: TmdbGenre[]
  origin_country: string[]
  poster_path: string | null
  backdrop_path: string | null
  popularity: number
  vote_average: number
  vote_count: number
  homepage: string | null
  // append_to_response（仅请求时出现）
  external_ids?: TmdbExternalIds
  images?: TmdbImages
  videos?: TmdbVideosAppend
  credits?: TmdbCredits
  aggregate_credits?: TmdbAggregateCredits
  content_ratings?: TmdbContentRatings
  translations?: TmdbTranslations
}

// ── Configuration（image base URL / languages / countries，ADR-201 22839）──────

export interface TmdbConfiguration {
  images: {
    base_url: string
    secure_base_url: string
    backdrop_sizes: string[]
    logo_sizes: string[]
    poster_sizes: string[]
    profile_sizes: string[]
    still_sizes: string[]
  }
  change_keys: string[]
}

export interface TmdbLanguage {
  iso_639_1: string
  english_name: string
  name: string
}

export interface TmdbCountry {
  iso_3166_1: string
  english_name: string
  native_name: string
}
