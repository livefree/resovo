/**
 * TmdbConfirmService.ts — TMDB 候选搜索 / 确认 / 拒绝（ADR-202 / META-39-A）
 *
 * - search：用 catalog.title 或显式 query 调 TMDB search（只读返回候选，不落库 candidate；
 *   自动富集 candidate 态归 FU 自动 worker，手动 search→confirm 即时流程不经中间 candidate）。
 * - confirm：拉 detail（zh-CN + external_ids）→ **单事务**写 catalog_external_refs（movie/season→exact、
 *   show→candidate，D-202-1）+ 应用核心标量字段（safeUpdate，D-202-8 M1/M3/M5）+ tmdb_id cache（确认语义）
 *   + imdb_id cache（fill-if-empty，M4）+ video_external_refs manual_confirmed。冲突软降级→422（D-202-4）。
 * - reject：video_external_refs → rejected。
 *
 * 复用现成写侧原语（零 migration）：resolveAndWriteExactRef / insertCandidateRef / safeUpdate /
 * upsertVideoExternalRef。单事务范式对齐 BangumiService.confirmMatch（REST 事务外、DB 写事务内）。
 */

import type { Pool } from 'pg'
import { loadTmdbClientConfig } from '@/api/services/tmdb-config'
import { searchMovie, searchTv, getMovieDetail, getTvDetail, getImageBaseUrl, TMDB_IMAGE_BASE_FALLBACK } from '@/api/lib/tmdb'
import type { TmdbMovieDetail, TmdbTvDetail, TmdbMovieSearchItem, TmdbTvSearchItem, TmdbImage } from '@/api/lib/tmdb.types'
import { resolveAndWriteExactRef, insertCandidateRef, type ExternalRefKind } from '@/api/db/queries/catalogExternalRefs'
import { upsertVideoExternalRef } from '@/api/db/queries/externalData'
import { mapTmdbGenres } from '@/api/lib/genreMapper'
import { countryToIso } from '@/types'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'

/** search 候选预览缩略图 base（base+w500；与 confirm 富图片应用的 configuration base 不同关注点，META-43）。 */
const TMDB_PREVIEW_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

/** confirm 富图片应用 size token（per kind；base 来自 getImageBaseUrl configuration 缓存，META-43）。 */
const IMAGE_SIZE = { poster: 'w500', backdrop: 'w1280', logo: 'w500' } as const
/** 图片素材语言偏好：zh 文字版 > null 无字/透明 > en > 其他（按 vote 平手降级，META-43）。 */
const POSTER_LANG_PREF: readonly (string | null)[] = ['zh', null, 'en']
const BACKDROP_LANG_PREF: readonly (string | null)[] = [null, 'zh', 'en']
const LOGO_LANG_PREF: readonly (string | null)[] = ['zh', null, 'en']
/** 触发 getImageBaseUrl 的图片字段（仅选中其一才拉 configuration，避免无谓请求）。 */
const IMAGE_FIELDS: readonly string[] = ['cover_url', 'backdrop', 'logo']

/** confirm 可应用的 catalog 字段白名单（ADR-202 D-202-8；fields 省略/[] = 仅绑 ID 不应用）。 */
export const TMDB_APPLIABLE_FIELDS = ['title', 'title_original', 'original_language', 'description', 'genres', 'country', 'rating', 'cover_url', 'backdrop', 'logo'] as const
export type TmdbAppliableField = typeof TMDB_APPLIABLE_FIELDS[number]

export type TmdbMediaType = 'movie' | 'tv'

export interface TmdbCandidate {
  tmdbId: number
  mediaType: TmdbMediaType
  title: string
  originalTitle: string
  originalLanguage: string
  year: string | null
  overview: string
  posterUrl: string | null
}

export type TmdbConfirmResult =
  | { updated: true; applied: string[] }
  | { updated: false; reason: string; holderCatalogId?: string }

function toCandidate(item: TmdbMovieSearchItem | TmdbTvSearchItem, mediaType: TmdbMediaType): TmdbCandidate {
  const isMovie = mediaType === 'movie'
  const date = isMovie ? (item as TmdbMovieSearchItem).release_date : (item as TmdbTvSearchItem).first_air_date
  return {
    tmdbId: item.id,
    mediaType,
    title: isMovie ? (item as TmdbMovieSearchItem).title : (item as TmdbTvSearchItem).name,
    originalTitle: isMovie ? (item as TmdbMovieSearchItem).original_title : (item as TmdbTvSearchItem).original_name,
    originalLanguage: item.original_language,
    year: date ? date.slice(0, 4) : null,
    overview: item.overview,
    posterUrl: item.poster_path ? `${TMDB_PREVIEW_IMAGE_BASE}${item.poster_path}` : null,
  }
}

/**
 * 从同 kind 候选图中选最佳（META-43）：语言优先级 → vote_average → vote_count。
 * langPrefs 命中索引越小越优先；未命中（含 langPrefs 外语言）排在末尾。
 */
function pickBestImage(images: TmdbImage[] | undefined, langPrefs: readonly (string | null)[]): TmdbImage | null {
  if (!images || images.length === 0) return null
  const rank = (lang: string | null): number => {
    const i = langPrefs.indexOf(lang)
    return i === -1 ? langPrefs.length : i
  }
  return [...images].sort(
    (a, b) =>
      rank(a.iso_639_1) - rank(b.iso_639_1) ||
      b.vote_average - a.vote_average ||
      b.vote_count - a.vote_count,
  )[0]
}

/**
 * 图片字段应用（META-43）：poster/backdrop/logo 三 kind，URL = base+size+file_path。
 * 写 url + status='pending_review'（触发既有治理 sweep 重探测 + blurhash，imageHealth.ts），
 * poster 额外写 source='tmdb' + 尺寸；backdrop/logo 无 source 列。blurhash/primaryColor 不从 TMDB 写（交 sweep）。
 */
function buildImageFields(detail: TmdbMovieDetail | TmdbTvDetail, imageBase: string, sel: Set<string>): CatalogUpdateData {
  const out: CatalogUpdateData = {}
  const images = detail.images

  if (sel.has('cover_url')) {
    // 优先 images.posters 多语言最佳（zh 海报），回退 detail.poster_path（默认海报）
    const best = pickBestImage(images?.posters, POSTER_LANG_PREF)
    const path = best?.file_path ?? detail.poster_path
    if (path) {
      out.coverUrl = `${imageBase}${IMAGE_SIZE.poster}${path}`
      out.posterStatus = 'pending_review'
      out.posterSource = 'tmdb'
      if (best) {
        out.posterWidth = best.width
        out.posterHeight = best.height
      }
    }
  }
  if (sel.has('backdrop')) {
    const best = pickBestImage(images?.backdrops, BACKDROP_LANG_PREF)
    if (best) {
      out.backdropUrl = `${imageBase}${IMAGE_SIZE.backdrop}${best.file_path}`
      out.backdropStatus = 'pending_review'
    }
  }
  if (sel.has('logo')) {
    const best = pickBestImage(images?.logos, LOGO_LANG_PREF)
    if (best) {
      out.logoUrl = `${imageBase}${IMAGE_SIZE.logo}${best.file_path}`
      out.logoStatus = 'pending_review'
    }
  }
  return out
}

/** detail → CatalogUpdateData（仅 fields 选中字段；ADR-202 D-202-8 M1/M3/M5 + META-42 country + META-43 图片）。 */
function buildCatalogFields(
  detail: TmdbMovieDetail | TmdbTvDetail,
  mediaType: TmdbMediaType,
  fields: readonly string[],
  imageBase: string,
): CatalogUpdateData {
  const sel = new Set(fields)
  const out: CatalogUpdateData = {}
  const isMovie = mediaType === 'movie'
  const title = isMovie ? (detail as TmdbMovieDetail).title : (detail as TmdbTvDetail).name
  const originalTitle = isMovie ? (detail as TmdbMovieDetail).original_title : (detail as TmdbTvDetail).original_name

  if (sel.has('title')) {
    const t = title?.trim() || originalTitle?.trim() // M1：zh-CN title 缺失回退 original_title，不写英文
    if (t) out.title = t
  }
  if (sel.has('title_original') && originalTitle?.trim()) out.titleOriginal = originalTitle.trim()
  // M3：存 language-only BCP47（TMDB ISO 639-1 zh/ja/...），不强推简繁 script（FU-202-3）
  if (sel.has('original_language') && detail.original_language) out.originalLanguage = detail.original_language
  if (sel.has('description') && detail.overview?.trim()) out.description = detail.overview.trim() // M1：空不写
  if (sel.has('genres') && detail.genres.length > 0) {
    out.genres = mapTmdbGenres(detail.genres.map((g) => g.id)) // M5：用稳定数值 id，不用本地化 name
    out.genresRaw = detail.genres.map((g) => g.name)
  }
  // country（META-42）：TMDB origin_country/production_countries 本是干净 ISO alpha-2，仍经 META-40
  // countryToIso 真源防御性归一（已 ISO → 大写归一；归一不到/空数组不写，保列纯净，对齐 META-41-B 保守口径）。
  if (sel.has('country')) {
    const rawCountry = isMovie
      ? (detail as TmdbMovieDetail).production_countries?.[0]?.iso_3166_1
      : (detail as TmdbTvDetail).origin_country?.[0]
    const iso = countryToIso(rawCountry)
    if (iso) out.country = iso
  }
  if (sel.has('rating') && typeof detail.vote_average === 'number') out.rating = detail.vote_average
  // 图片（META-43）：poster(cover_url)/backdrop/logo 经 images append 选最佳，委托 buildImageFields
  return { ...out, ...buildImageFields(detail, imageBase, sel) }
}

export class TmdbConfirmService {
  constructor(private readonly db: Pool) {}

  /** 只读搜索候选（query 省略时取 fallbackTitle = catalog.title）。strict：失败抛出。 */
  async search(
    fallbackTitle: string | null,
    params: { query?: string; mediaType: TmdbMediaType; year?: number },
  ): Promise<{ candidates: TmdbCandidate[] }> {
    const q = (params.query ?? fallbackTitle ?? '').trim()
    if (!q) return { candidates: [] }
    const cfg = await loadTmdbClientConfig(this.db)
    const opts = { language: 'zh-CN', year: params.year }
    const results =
      params.mediaType === 'movie'
        ? (await searchMovie(q, opts, cfg, 'admin_search')).results.map((r) => toCandidate(r, 'movie'))
        : (await searchTv(q, opts, cfg, 'admin_search')).results.map((r) => toCandidate(r, 'tv'))
    return { candidates: results.slice(0, 10) }
  }

  /** 确认候选 → 单事务写 ref + 应用字段 + cache + video ref（ADR-202 D-202-1/2/4/8）。 */
  async confirm(
    videoId: string,
    catalogId: string,
    params: { tmdbId: number; mediaType: TmdbMediaType; seasonNumber?: number; fields?: readonly string[] },
  ): Promise<TmdbConfirmResult> {
    const { tmdbId, mediaType, seasonNumber } = params
    const fields = params.fields ?? []
    const cfg = await loadTmdbClientConfig(this.db)
    // Phase 1：REST 事务外。append images（META-43）供图片应用；仅选中图片字段才拉 image base configuration。
    const detail =
      mediaType === 'movie'
        ? await getMovieDetail(tmdbId, { language: 'zh-CN', append: ['external_ids', 'images'] }, cfg)
        : await getTvDetail(tmdbId, { language: 'zh-CN', append: ['external_ids', 'images'] }, cfg)
    if (!detail) return { updated: false, reason: 'tmdb_fetch_failed' }

    const imageBase = fields.some((f) => IMAGE_FIELDS.includes(f))
      ? await getImageBaseUrl(cfg, 'admin_search')
      : TMDB_IMAGE_BASE_FALLBACK

    const externalKind: ExternalRefKind = mediaType === 'movie' ? 'movie' : seasonNumber != null ? 'season' : 'show'
    const updateFields = buildCatalogFields(detail, mediaType, fields, imageBase)
    const imdbId = detail.external_ids?.imdb_id ?? null

    // Phase 2：DB 写入单事务（ref + 字段 + cache + video ref 共享 client，D-202-2）
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      if (externalKind === 'show') {
        // tv-show-root：parent 域不进 exact，落 candidate（D-202-1）
        await insertCandidateRef(client, { catalogId, provider: 'tmdb', externalId: String(tmdbId), externalKind: 'show', source: 'manual', linkedBy: 'moderator' })
      } else {
        const ref = await resolveAndWriteExactRef(client, {
          catalogId, provider: 'tmdb', externalId: String(tmdbId), externalKind,
          source: 'manual', linkedBy: 'moderator', seasonNumber: externalKind === 'season' ? seasonNumber : null,
        })
        if (ref.outcome === 'conflict_candidate') { await client.query('ROLLBACK'); return { updated: false, reason: 'tmdb_exact_conflict', holderCatalogId: ref.holderCatalogId } }
        if (ref.outcome === 'kind_conflict') { await client.query('ROLLBACK'); return { updated: false, reason: 'tmdb_kind_conflict' } }
      }

      let applied: string[] = []
      if (Object.keys(updateFields).length > 0) {
        const catalogService = new MediaCatalogService(this.db)
        const { skippedFields } = await catalogService.safeUpdate(catalogId, updateFields, 'tmdb', { sourceRef: String(tmdbId), db: client })
        applied = Object.keys(updateFields).filter((k) => !skippedFields.includes(k))
      }

      // cache：tmdb_id 按确认语义写；imdb_id 间接填充走 fill-if-empty（D-202-8 M4 / D-186-2）
      await client.query('UPDATE media_catalog SET tmdb_id = $1 WHERE id = $2', [tmdbId, catalogId])
      if (imdbId) await client.query('UPDATE media_catalog SET imdb_id = $1 WHERE id = $2 AND imdb_id IS NULL', [imdbId, catalogId])

      await upsertVideoExternalRef(client, {
        videoId, provider: 'tmdb', externalId: String(tmdbId),
        matchStatus: 'manual_confirmed', matchMethod: 'manual', confidence: 1, isPrimary: true, linkedBy: 'moderator',
      })

      await client.query('COMMIT')
      return { updated: true, applied }
    } catch (err) {
      try { await client.query('ROLLBACK') } catch { /* connection may already be lost */ }
      throw err
    } finally {
      client.release()
    }
  }

  /** 拒绝候选（video_external_refs → rejected；复活语义由 upsert 承载）。 */
  async reject(videoId: string, tmdbId: number): Promise<{ rejected: true }> {
    await upsertVideoExternalRef(this.db, {
      videoId, provider: 'tmdb', externalId: String(tmdbId),
      matchStatus: 'rejected', matchMethod: 'manual', confidence: 0, isPrimary: false, linkedBy: 'moderator',
    })
    return { rejected: true }
  }
}
