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
import { searchMovie, searchTv, getMovieDetail, getTvDetail, getTvSeasonDetail, getImageBaseUrl, TMDB_IMAGE_BASE_FALLBACK } from '@/api/lib/tmdb'
import type { TmdbMovieDetail, TmdbTvDetail, TmdbMovieSearchItem, TmdbTvSearchItem, TmdbImage, TmdbTvSeason, TmdbSeasonDetail, TmdbSeasonEpisode } from '@/api/lib/tmdb.types'
import { resolveAndWriteExactRef, insertCandidateRef, type ExternalRefKind } from '@/api/db/queries/catalogExternalRefs'
import { upsertCatalogEpisodes, type CatalogEpisodeInput } from '@/api/db/queries/catalogEpisodes'
import { upsertVideoExternalRef } from '@/api/db/queries/externalData'
import { mapTmdbGenres } from '@/api/lib/genreMapper'
import { tmdbTypeSignal, resolveTypeSignal } from '@/api/lib/typeFromProvider'
import { countryToIso } from '@/types'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
import { findCatalogById } from '@/api/db/queries/mediaCatalog'
import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
import { baseLogger } from '@/api/lib/logger'
import { recomputeCatalogBlockingKeys } from '@/api/services/metadata/catalogBlockingKeys'
import { similarity, normalizeForMatch, parseYear } from '@/api/lib/textMatch'
import { splitIdentityScalarFields } from '@/api/services/metadata/fieldSplit'
import { enqueueIdentityVideoRescore } from '@/api/services/identity/enqueueVideoRescore'
import { loadKnownNames, filterForSearchQueries, filterForMatchScore, type KnownName } from '@/api/services/metadata/knownNames'
import { normalizeForExternalMatch } from '@/api/services/TitleNormalizer'
import { isPinyinTitle } from '@/api/services/PinyinDetector'

/** search 候选预览缩略图 base（base+w500；与 confirm 富图片应用的 configuration base 不同关注点，META-43）。 */
const TMDB_PREVIEW_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

/**
 * auto 匹配置信度阈值（META-47，复用 MetadataEnrichService douban 同款语义）：
 *   score ≥ AUTO_MATCH → auto_matched（写 catalog 字段 + cache）；
 *   [CANDIDATE, AUTO_MATCH) → candidate（仅写 refs，不应用字段）；
 *   < CANDIDATE → 丢弃不写。
 */
const CONFIDENCE_AUTO_MATCH = 0.85
const CONFIDENCE_CANDIDATE = 0.6

/** TMDB 多词检索配额上限（D-206-2 / META-50-1B，限流保守值；逐词早停通常更早收敛）。 */
const TMDB_SEARCH_TERM_CAP = 3

/** confirm 富图片应用 size token（per kind；base 来自 getImageBaseUrl configuration 缓存，META-43）。 */
const IMAGE_SIZE = { poster: 'w500', backdrop: 'w1280', logo: 'w500' } as const
/** 图片素材语言偏好：zh 文字版 > null 无字/透明 > en > 其他（按 vote 平手降级，META-43）。 */
const POSTER_LANG_PREF: readonly (string | null)[] = ['zh', null, 'en']
const BACKDROP_LANG_PREF: readonly (string | null)[] = [null, 'zh', 'en']
const LOGO_LANG_PREF: readonly (string | null)[] = ['zh', null, 'en']
/** 触发 getImageBaseUrl 的图片字段（仅选中其一才拉 configuration，避免无谓请求）。 */
const IMAGE_FIELDS: readonly string[] = ['cover_url', 'backdrop', 'logo']

/** confirm 可应用的 catalog 字段白名单（ADR-202 D-202-8；fields 省略/[] = 仅绑 ID 不应用）。 */
export const TMDB_APPLIABLE_FIELDS = ['title', 'title_en', 'title_original', 'original_language', 'description', 'genres', 'country', 'rating', 'cover_url', 'backdrop', 'logo'] as const
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

/** auto 匹配结果（META-47）：成功分两档（auto_matched 写字段 / candidate 仅绑）；失败带原因。 */
export type TmdbAutoMatchResult =
  | {
      matched: true
      tier: 'auto_matched' | 'candidate'
      tmdbId: number
      confidence: number
      applied: string[]
      /** META-49-B1/B2：内容标量字段上抛 enrich 层交 reconcile 多源加权裁决（白名单组 RECONCILE_GROUPS）。 */
      proposedFields?: CatalogUpdateData
      /** ADR-207 D-207-7：季级命中时的季集数（season.episode_count > 0）→ 交卡 C stepTmdb 经 episodesByStatus 派发 total/current_episodes。 */
      seasonEpisodeCount?: number
      /** review P2-3：本次写入的 external ref id（季级=season id / movie·show=tmdbId）——供 provenance sourceRef 准确指向季而非整剧。 */
      externalRefId?: string
    }
  | {
      matched: false
      reason: 'no_credentials' | 'no_candidate' | 'tmdb_unavailable' | 'tmdb_exact_conflict' | 'tmdb_kind_conflict'
      holderCatalogId?: string
    }

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
 * TMDB 候选打分（META-47，仿 douban candidateScore；META-50-1B 扩多 target）：
 * 每个 target 与候选 title/originalTitle 取 max 归一相似度，跨 target 再取 max（D-206-3：
 * knownNames 极性集合对候选取最佳匹配）；再按年份匹配加权（同年 +0.2 / 相邻年 +0.1，封顶 1）。
 * 单字符串入参 = 原 META-47 行为（向后兼容）。目标/候选年份任一缺失则仅用标题分。
 */
function tmdbCandidateScore(
  targetTitles: string | readonly string[],
  targetYear: number | null,
  cand: TmdbCandidate,
): number {
  const titles = typeof targetTitles === 'string' ? [targetTitles] : targetTitles
  const candTitle = normalizeForMatch(cand.title)
  const candOrig = normalizeForMatch(cand.originalTitle)
  let baseScore = 0
  for (const t of titles) {
    const nt = normalizeForMatch(t)
    baseScore = Math.max(baseScore, similarity(nt, candTitle), similarity(nt, candOrig))
  }

  const candYear = parseYear(cand.year)
  if (targetYear == null || candYear == null) return baseScore
  if (targetYear === candYear) return Math.min(1, baseScore + 0.2)
  if (Math.abs(targetYear - candYear) === 1) return Math.min(1, baseScore + 0.1)
  return baseScore
}

/**
 * 从候选列表选最佳（META-47，仿 douban pickBestCandidate）：取最高分，≥0.45 兜底阈值才返回
 * （过严会漏召回，由 detail + 上层置信度分档再兜底）。返回最佳候选与其分数，无合格候选返 null。
 */
export function pickBestTmdbCandidate(
  targetTitles: string | readonly string[],
  targetYear: number | null,
  candidates: TmdbCandidate[],
): { candidate: TmdbCandidate; score: number } | null {
  let best: TmdbCandidate | null = null
  let bestScore = 0
  for (const cand of candidates) {
    const score = tmdbCandidateScore(targetTitles, targetYear, cand)
    if (score > bestScore) {
      bestScore = score
      best = cand
    }
  }
  return best && bestScore >= 0.45 ? { candidate: best, score: bestScore } : null
}

/** 归一去重保序（剔空白；`normalizeForExternalMatch` 键，简繁不归一 → 海贼王/航海王 不并）。 */
function dedupeNormalizedTerms(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const trimmed = v.trim()
    if (!trimmed) continue
    const key = normalizeForExternalMatch(trimmed)
    if (key.length === 0 || seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/**
 * 搜索词集（D-206-2 / META-50-1B）：`filterForSearchQueries` 优先级序
 * [title_original, title_en, official/romanization alias, title] + 视频标题兜底，归一去重后截 N≤3。
 */
function buildTmdbSearchTerms(knownNames: readonly KnownName[], fallbackTitle: string): string[] {
  const ordered = filterForSearchQueries(knownNames).map((n) => n.value)
  return dedupeNormalizedTerms([...ordered, fallbackTitle]).slice(0, TMDB_SEARCH_TERM_CAP)
}

/**
 * 打分 target 集（D-206-3 / META-50-1B）：`filterForMatchScore` 极性集合（title/official/original/
 * localized，排 romanization/crawler）+ 视频标题兜底，归一去重；**不截断**（打分纯本地无 API 成本）。
 */
function buildTmdbScoreTargets(knownNames: readonly KnownName[], fallbackTitle: string): string[] {
  const scored = filterForMatchScore(knownNames).map((n) => n.value)
  return dedupeNormalizedTerms([...scored, fallbackTitle])
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

/**
 * TMDB 英文标题抽取（META-51-A）：优先 `translations` 的 en 条目（movie=data.title / tv=data.name），
 * 回退「`original_language` 以 en 开头则用 original_title/original_name」。**仅返回真英文**——含拉丁
 * 字母且无 CJK（防 en 翻译缺失时 TMDB 回退中文被误当英文写入 title_en）。无合格候选返 null。
 */
function pickEnglishTitle(detail: TmdbMovieDetail | TmdbTvDetail, mediaType: TmdbMediaType): string | null {
  const isMovie = mediaType === 'movie'
  const en = detail.translations?.translations.find((t) => t.iso_639_1 === 'en')
  const fromTrans = (isMovie ? en?.data.title : en?.data.name)?.trim()
  const origTitle = (isMovie ? (detail as TmdbMovieDetail).original_title : (detail as TmdbTvDetail).original_name)?.trim()
  const candidate = fromTrans || (detail.original_language?.toLowerCase().startsWith('en') ? origTitle : undefined)
  if (!candidate) return null
  // 必须含拉丁字母且无 CJK（中日韩统一表意 + 兼容表意），否则视为非英文不写。
  if (!/[A-Za-z]/.test(candidate) || /[㐀-鿿豈-﫿]/.test(candidate)) return null
  // 防再污染（Codex stop-time review）：TMDB en 译名/original_title 本身可能是拼音/罗马音（贡献者误填，
  // 如 "Qing Yu Nian"），复用入库同一 isPinyinTitle 谓词拒绝，避免把拼音重新灌回 title_en。
  if (isPinyinTitle(candidate)) return null
  return candidate
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
  // META-51-A：英文标题 → title_en（仅真英文，修复采集源拼音 title_en；TMDB 优先级覆盖 crawler）。
  if (sel.has('title_en')) {
    const en = pickEnglishTitle(detail, mediaType)
    if (en) out.titleEn = en
  }
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

/** 季路径剔除的标题三件套（D-207-5：季名常为「Season N/第N季」噪声，不覆盖 catalog 作品核心标题；仅季路径）。 */
const SEASON_TITLE_TRIPLE: readonly string[] = ['title', 'title_en', 'title_original']

/**
 * 季级 catalog 字段（ADR-207 D-207-4/5/6）——季回退 show：
 *   description = 季简介 ?? show 简介；rating = 季 vote ?? show；cover = 季海报(pickBestImage) ?? 季 poster_path ?? show 海报（三级回退）；
 *   genres / country / original_language / backdrop / logo 取 **show 级**（季共享，复用 buildImageFields 仅 backdrop+logo）。
 * **剔标题三件套**（D-207-5：不写 title/title_en/title_original）+ **不并入 tmdbId/imdbId cache**（D-207-6，季 catalog 保持 NULL）。
 * 返回纯内容标量（无身份键）→ autoMatch 经 splitIdentityScalarFields 全量上抛 proposedFields 交 reconcile（与 show/movie 路径对称）。
 */
function buildSeasonCatalogFields(
  show: TmdbTvDetail,
  season: TmdbTvSeason,
  seasonDetail: TmdbSeasonDetail | null,
  imageBase: string,
  sel: Set<string>,
): CatalogUpdateData {
  const out: CatalogUpdateData = {}
  if (sel.has('description')) {
    const description = (seasonDetail?.overview?.trim() || season.overview?.trim()) || show.overview?.trim()
    if (description) out.description = description
  }
  if (sel.has('rating')) {
    const seasonRating = seasonDetail?.vote_average ?? season.vote_average
    const rating = typeof seasonRating === 'number' && seasonRating > 0 ? seasonRating : show.vote_average
    if (typeof rating === 'number' && rating > 0) out.rating = rating
  }
  if (sel.has('genres') && show.genres.length > 0) {
    out.genres = mapTmdbGenres(show.genres.map((g) => g.id)) // M5：稳定数值 id
    out.genresRaw = show.genres.map((g) => g.name)
  }
  if (sel.has('country')) {
    const iso = countryToIso(show.origin_country?.[0])
    if (iso) out.country = iso
  }
  if (sel.has('original_language') && show.original_language) out.originalLanguage = show.original_language
  if (sel.has('cover_url')) {
    // cover：季海报多语言择优（复用 pickBestImage）→ 季 poster_path → show 海报（三级回退，D-207-4）
    const seasonPoster = pickBestImage(seasonDetail?.images?.posters, POSTER_LANG_PREF)
    const posterPath = seasonPoster?.file_path ?? season.poster_path ?? show.poster_path
    if (posterPath) {
      out.coverUrl = `${imageBase}${IMAGE_SIZE.poster}${posterPath}`
      out.posterStatus = 'pending_review'
      out.posterSource = 'tmdb'
      if (seasonPoster) {
        out.posterWidth = seasonPoster.width
        out.posterHeight = seasonPoster.height
      }
    }
  }
  // backdrop/logo：season 无独立素材 → 取 show 级（季共享）。复用 buildImageFields，按 sel 过滤（cover 已季级处理，不重算）
  Object.assign(out, buildImageFields(show, imageBase, new Set(['backdrop', 'logo'].filter((f) => sel.has(f)))))
  return out
}

/** TMDB 季逐集 → CatalogEpisodeInput（source='tmdb'、ep_type=0 本篇，D-207-7）；runtime 分钟 → 秒。 */
function toTmdbEpisodeInput(ep: TmdbSeasonEpisode): CatalogEpisodeInput {
  return {
    source: 'tmdb',
    externalEpisodeId: String(ep.id),
    epType: 0,
    sort: ep.episode_number ?? null,
    ep: ep.episode_number ?? null,
    name: ep.name?.trim() || null,
    nameCn: null,
    airdate: ep.air_date || null,
    durationSeconds: typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime * 60 : null,
    description: ep.overview?.trim() || null,
  }
}

// interim 交叉验证（filterCrossValidation/isEmptyValue/CROSS_VALIDATION_GROUPS）已随 reconcile 上线退场
// （META-49-B2）：内容标量多源加权裁决移至 services/metadata/reconcile.ts（白名单组真源为 reconcile.canonical
// RECONCILE_GROUPS）；autoMatch 不再 interim 过滤，content proposedFields 全量上抛由 reconcile 裁决。

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
        ? await getMovieDetail(tmdbId, { language: 'zh-CN', append: ['external_ids', 'images', 'translations'] }, cfg)
        : await getTvDetail(tmdbId, { language: 'zh-CN', append: ['external_ids', 'images', 'translations'] }, cfg)
    if (!detail) return { updated: false, reason: 'tmdb_fetch_failed' }

    const imageBase = fields.some((f) => IMAGE_FIELDS.includes(f))
      ? await getImageBaseUrl(cfg, 'admin_search')
      : TMDB_IMAGE_BASE_FALLBACK

    // D-207-9a：season 分支内部解析季 id（detail.seasons[] 按 season_number 命中；seasons 为 /tv/{id} 默认字段，
    // 无需额外 REST）——闭合 show-id-as-season 误写源头（external_id 改用季自身 id，与 autoMatch 对称，端点 Body/UI 不变）；
    // 未命中季 → 降级 show candidate（D-207-10 level ①）。
    const isSeasonCatalog = mediaType === 'tv' && seasonNumber != null
    let seasonRefId: number | null = null
    let confirmSeason: TmdbTvSeason | null = null
    let confirmKind: ExternalRefKind = mediaType === 'movie' ? 'movie' : seasonNumber != null ? 'season' : 'show'
    if (confirmKind === 'season') {
      confirmSeason = (detail as TmdbTvDetail).seasons?.find((s) => s.season_number === seasonNumber) ?? null
      if (confirmSeason) seasonRefId = confirmSeason.id
      else confirmKind = 'show'
    }
    // 季 catalog 剔标题三件套（D-207-5：不用季名覆盖 catalog 标题；仅季路径，show/movie 路径不变）
    const applicableFields = isSeasonCatalog ? fields.filter((f) => !SEASON_TITLE_TRIPLE.includes(f)) : fields
    // 字段构建（review P1-2）：season 命中 → **季级字段**（人工确认季也用季简介/季海报/季评分，复用 buildSeasonCatalogFields，
    // 与 auto 路径对称；season summary 已含 overview/poster_path → seasonDetail=null 零额外 REST），尊重 moderator 选的 fields；
    // 非季级 → show/movie 路径不变。
    const updateFields = (confirmKind === 'season' && confirmSeason)
      ? buildSeasonCatalogFields(detail as TmdbTvDetail, confirmSeason, null, imageBase, new Set(applicableFields))
      : buildCatalogFields(detail, mediaType, applicableFields, imageBase)
    const imdbId = detail.external_ids?.imdb_id ?? null

    // type 富集修正（ADR-203 D-203-2/4）：仅 current==='other' 才写 provider 形式信号，绝不覆盖具体 type；
    // type 不入 TMDB_APPLIABLE_FIELDS（身份字段不让人工勾选），随 'genres'（type 信号源）opt-in——fields=[] 仅绑 ID 不改 type；
    // 并入 updateFields 同 safeUpdate 单事务（红线①）。
    if (fields.includes('genres')) {
      const currentCatalog = await findCatalogById(this.db, catalogId)
      if (currentCatalog) {
        const outcome = resolveTypeSignal(currentCatalog.type, tmdbTypeSignal(mediaType, detail.genres.map((g) => g.id)))
        if (outcome.typeToWrite) updateFields.type = outcome.typeToWrite
        else if (outcome.conflict) {
          baseLogger.child({ module: 'catalog-type-signal' }).info(
            { outcome: 'type_conflict_skipped', catalogId, provider: 'tmdb', externalId: String(tmdbId), ...outcome.conflict },
            'tmdb type signal conflict with existing concrete type, skipped (ADR-203 D-203-5)',
          )
        }
      }
    }

    // Phase 2：DB 写入单事务（ref + 字段 + cache + video ref 共享 client，D-202-2）
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      if (confirmKind === 'show') {
        // tv-show-root（或季未命中降级）：parent 域不进 exact，落 candidate（D-202-1 / D-207-10 level ①）
        await insertCandidateRef(client, { catalogId, provider: 'tmdb', externalId: String(tmdbId), externalKind: 'show', source: 'manual', linkedBy: 'moderator' })
      } else {
        // movie → tmdbId；season → 季自身 id（D-207-2；confirmKind==='season' 时 seasonRefId 必非空）
        const ref = await resolveAndWriteExactRef(client, {
          catalogId, provider: 'tmdb', externalId: confirmKind === 'season' ? String(seasonRefId) : String(tmdbId), externalKind: confirmKind,
          source: 'manual', linkedBy: 'moderator', seasonNumber: confirmKind === 'season' ? seasonNumber : null,
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

      // cache：tmdb_id 按确认语义写；imdb_id 间接填充走 fill-if-empty（D-202-8 M4 / D-186-2）。
      // D-207-6：季 catalog（season_number != null）**不写** tmdb_id/imdb_id cache（保持 NULL）——多季写同一 show id 撞
      // 026 列级 UNIQUE + findCatalogByTmdbId 误命中后续季；季身份由 season exact ref（+ video ref 季 id）承载。
      if (!isSeasonCatalog) {
        await client.query('UPDATE media_catalog SET tmdb_id = $1 WHERE id = $2', [tmdbId, catalogId])
        if (imdbId) await client.query('UPDATE media_catalog SET imdb_id = $1 WHERE id = $2 AND imdb_id IS NULL', [imdbId, catalogId])
      }

      // video ref：季路径写季自身 id（D-207-6：不同季 video 不跨季过并）；movie/show 路径写 tmdbId
      await upsertVideoExternalRef(client, {
        videoId, provider: 'tmdb', externalId: confirmKind === 'season' ? String(seasonRefId) : String(tmdbId),
        matchStatus: 'manual_confirmed', matchMethod: 'manual', confidence: 1, isPrimary: true, linkedBy: 'moderator',
      })

      await client.query('COMMIT')
      // META-50-2A-2 前置：confirm 应用 catalog 已知名字段（title/title_original）后重算 blocking
      // 归一键——否则派生表 stale、段③ 召回口径漂移（fire-and-forget 非阻断，沿 VideoService.update 范式）。
      // META-51-A FIX（Codex stop-time review）：titleEn 也是 knownNames（kind=official）成员，
      // confirm 应用英文标题后须重算 blocking 归一键，否则派生表 stale（autoMatch 路径在 enrich 无条件重算）。
      if (applied.includes('title') || applied.includes('titleOriginal') || applied.includes('titleEn')) {
        void recomputeCatalogBlockingKeys(this.db, catalogId).catch((err: unknown) => {
          baseLogger.warn({ err, catalog_id: catalogId }, '[blocking-keys] tmdb confirm recompute failed')
        })
      }
      return { updated: true, applied }
    } catch (err) {
      try { await client.query('ROLLBACK') } catch { /* connection may already be lost */ }
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * 多词检索（D-206-2 / META-50-1B）：按优先级序逐词 search，候选 by tmdbId 去重；每词后用
   * scoreTargets 打分，interim best ≥ CONFIDENCE_CANDIDATE 即**逐词早停**（省后续配额）。
   * searchTerms 已 N≤3 截断。返回最佳候选（或 null）。
   */
  private async multiTermSearch(
    searchTerms: readonly string[],
    scoreTargets: readonly string[],
    targetYear: number | null,
    mediaType: TmdbMediaType,
    cfg: Awaited<ReturnType<typeof loadTmdbClientConfig>>,
  ): Promise<{ candidate: TmdbCandidate; score: number } | null> {
    const opts = { language: 'zh-CN', year: targetYear ?? undefined }
    const byId = new Map<number, TmdbCandidate>()
    for (const term of searchTerms) {
      const results =
        mediaType === 'movie'
          ? (await searchMovie(term, opts, cfg, 'enrich_worker')).results.map((r) => toCandidate(r, 'movie'))
          : (await searchTv(term, opts, cfg, 'enrich_worker')).results.map((r) => toCandidate(r, 'tv'))
      for (const c of results) if (!byId.has(c.tmdbId)) byId.set(c.tmdbId, c)
      const interim = pickBestTmdbCandidate(scoreTargets, targetYear, [...byId.values()])
      if (interim && interim.score >= CONFIDENCE_CANDIDATE) return interim
    }
    return pickBestTmdbCandidate(scoreTargets, targetYear, [...byId.values()])
  }

  /**
   * 季解析（ADR-207 D-207-3/10）：`detail.seasons[]` 按 season_number 命中 → 取季摘要 + `getTvSeasonDetail`（逐集/季海报）。
   * 软校验（episode_count=0 / air_date 年份偏离 catalog year >2）记 warn **不阻断**（季 ref 比 show candidate 更精确）。
   * 季详情 REST 失败 → 返 `seasonDetail=null`（level ②：仍可写 season exact，仅跳逐集/季海报）；未命中季 → 返 `null`（level ①：上层降级 show candidate）。
   * 全程 REST 在事务外（autoMatch Phase 0 调用），失败由调用方 graceful skip 包裹。
   */
  private async resolveSeason(
    show: TmdbTvDetail,
    showId: number,
    seasonNumber: number,
    catalogYear: number | null,
    catalogId: string,
    cfg: Awaited<ReturnType<typeof loadTmdbClientConfig>>,
  ): Promise<{ season: TmdbTvSeason; seasonDetail: TmdbSeasonDetail | null } | null> {
    const season = show.seasons?.find((s) => s.season_number === seasonNumber) ?? null
    if (!season) return null
    const airYear = season.air_date ? Number(season.air_date.slice(0, 4)) : null
    const yearOff = airYear !== null && Number.isFinite(airYear) && catalogYear !== null && Math.abs(airYear - catalogYear) > 2
    if (season.episode_count === 0 || yearOff) {
      baseLogger.child({ module: 'tmdb-season' }).warn(
        { catalogId, seasonNumber, seasonId: season.id, episodeCount: season.episode_count, airDate: season.air_date, catalogYear },
        'tmdb season soft validation warn (still writing season exact, ADR-207 D-207-3)',
      )
    }
    const seasonDetail = await getTvSeasonDetail(
      showId, seasonNumber,
      { language: 'zh-CN', append: ['external_ids', 'images', 'translations', 'credits'] }, cfg, 'enrich_worker',
    )
    return { season, seasonDetail }
  }

  /**
   * auto 富集匹配（META-47 / ADR-205 D-205-7）——**非参数化 confirm**，供 worker（META-48）调用。
   *
   * 区别于 confirm：source/linkedBy='auto'、置信度来自打分（非 1）、按分档（auto_matched 写字段 /
   * candidate 仅绑）、tmdb_id cache 经 safeUpdate 受 ref 成功约束（非 confirm:259 无条件写）。
   * 凭证缺失/限流/网络失败 → graceful skip（返 matched:false，不抛）。
   */
  async autoMatch(
    videoId: string,
    catalogId: string,
    params: { title: string; year?: number | null; mediaType: TmdbMediaType; seasonNumber?: number },
  ): Promise<TmdbAutoMatchResult> {
    const { mediaType, seasonNumber } = params
    const title = params.title?.trim()
    if (!title) return { matched: false, reason: 'no_candidate' }
    const targetYear = params.year ?? null

    // ── Phase 0：凭证 + 检索 + （auto_matched 档）detail，全在 REST（事务外）。失败 graceful skip ──
    let tmdbId: number
    let score: number
    let detail: TmdbMovieDetail | TmdbTvDetail | null = null
    let imageBase = TMDB_IMAGE_BASE_FALLBACK
    let season: TmdbTvSeason | null = null
    let seasonDetail: TmdbSeasonDetail | null = null
    try {
      const cfg = await loadTmdbClientConfig(this.db)
      if (!cfg.readAccessToken && !cfg.apiKey) return { matched: false, reason: 'no_credentials' }

      // META-50-1B：knownNames 驱动多词检索（用 catalogId = effectiveCatalogId，含 bangumi redirect 后）。
      // knownNames 空（如新建无别名）→ 兜底单视频标题，行为等价 META-47 单词检索。
      const knownNames = await loadKnownNames(this.db, catalogId)
      const searchTerms = buildTmdbSearchTerms(knownNames, title)
      const scoreTargets = buildTmdbScoreTargets(knownNames, title)
      // review P1-1：季级 catalog 的 year 是**该季年份**（非 show first_air_date_year）；若传给 searchTv（映射 first_air_date_year）
      // 会把 S2/S3 等非首播季的正确 show 直接过滤掉。季级路径搜剧不带 year（也不按季年份打分），命中后由 resolveSeason
      // 对 season.air_date 做弱校验（软 warn 不阻断，ADR-207 D-207-3）。movie/show 路径 year 行为不变。
      const searchYear = mediaType === 'tv' && seasonNumber != null ? null : targetYear
      const best = await this.multiTermSearch(searchTerms, scoreTargets, searchYear, mediaType, cfg)
      if (!best || best.score < CONFIDENCE_CANDIDATE) return { matched: false, reason: 'no_candidate' }
      tmdbId = best.candidate.tmdbId
      score = best.score

      // 仅 auto_matched 档才拉 detail + 应用字段；candidate 档仅绑 ref（省一次 detail 请求）
      if (score >= CONFIDENCE_AUTO_MATCH) {
        detail =
          mediaType === 'movie'
            ? await getMovieDetail(tmdbId, { language: 'zh-CN', append: ['external_ids', 'images', 'translations'] }, cfg, 'enrich_worker')
            : await getTvDetail(tmdbId, { language: 'zh-CN', append: ['external_ids', 'images', 'translations'] }, cfg, 'enrich_worker')
        if (!detail) return { matched: false, reason: 'no_candidate' }
        imageBase = await getImageBaseUrl(cfg, 'enrich_worker')
        // 季级解析（D-207-3）：tv + seasonNumber → seasons[] 命中 + getTvSeasonDetail（逐集/季海报），REST 事务外
        if (mediaType === 'tv' && seasonNumber != null) {
          const resolved = await this.resolveSeason(detail as TmdbTvDetail, tmdbId, seasonNumber, targetYear, catalogId, cfg)
          if (resolved) { season = resolved.season; seasonDetail = resolved.seasonDetail }
        }
      }
    } catch {
      // 凭证错误 / 429 退避耗尽 / 网络 → 不写、不抛，等下次 worker 重试
      return { matched: false, reason: 'tmdb_unavailable' }
    }

    const tier: 'auto_matched' | 'candidate' = detail ? 'auto_matched' : 'candidate'
    const seasonResolved = season != null
    const isSeasonCatalog = mediaType === 'tv' && seasonNumber != null
    // season 命中 → 'season'（external_id=季 id，D-207-2）；季 catalog 未命中季 / tv show-root → 'show'（D-207-10 level ①）；movie → 'movie'
    const externalKind: ExternalRefKind = mediaType === 'movie' ? 'movie' : seasonResolved ? 'season' : 'show'
    const refExternalId = seasonResolved && season ? String(season.id) : String(tmdbId)

    // auto_matched：构造应用字段（事务外预读 type 信号，复用 confirm 的 ADR-203 逻辑）
    const updateFields: CatalogUpdateData = {}
    if (detail) {
      if (seasonResolved && season) {
        // 季级字段：季回退 show（D-207-4）+ 剔标题三件套（D-207-5）+ **不并入 tmdbId/imdbId cache**（D-207-6，季 catalog 保持 NULL）。
        // auto 路径应用全部可应用字段（sel = 全集）。
        Object.assign(updateFields, buildSeasonCatalogFields(detail as TmdbTvDetail, season, seasonDetail, imageBase, new Set(TMDB_APPLIABLE_FIELDS)))
      } else {
        Object.assign(updateFields, buildCatalogFields(detail, mediaType, TMDB_APPLIABLE_FIELDS, imageBase))
        // D-207-6：季 catalog（season_number != null）即便降级 show candidate 也不写 cache（多季写同一 show id 撞 026 列级 UNIQUE）
        if (!isSeasonCatalog) {
          updateFields.tmdbId = tmdbId // 经 safeUpdate fill-if-empty 白名单（M4），受下方 ref 成功约束
          const imdbId = detail.external_ids?.imdb_id ?? null
          if (imdbId) updateFields.imdbId = imdbId
        }
      }
      const currentCatalog = await findCatalogById(this.db, catalogId)
      if (currentCatalog) {
        const outcome = resolveTypeSignal(currentCatalog.type, tmdbTypeSignal(mediaType, detail.genres.map((g) => g.id)))
        if (outcome.typeToWrite) updateFields.type = outcome.typeToWrite
        else if (outcome.conflict) {
          baseLogger.child({ module: 'catalog-type-signal' }).info(
            { outcome: 'type_conflict_skipped', catalogId, provider: 'tmdb', externalId: String(tmdbId), ...outcome.conflict },
            'tmdb auto type signal conflict with existing concrete type, skipped (ADR-203 D-203-5)',
          )
        }
      }
      // META-49-B2：interim 交叉验证退场——content proposedFields 全量上抛，多源加权由 reconcile 裁决。
    }

    // ── Phase 2：DB 写入单事务（ref → 字段/cache → video ref）──
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      if (tier === 'auto_matched' && (externalKind === 'movie' || externalKind === 'season')) {
        // 精确级 exact：冲突 = 归并信号 → ROLLBACK 不写 cache（D-205-7「受 refs 成功约束」）。
        // season → 季自身 id（D-207-2，refExternalId）；movie → tmdbId
        const ref = await resolveAndWriteExactRef(client, {
          catalogId, provider: 'tmdb', externalId: refExternalId, externalKind,
          source: 'auto', linkedBy: 'auto', seasonNumber: externalKind === 'season' ? seasonNumber : null,
        })
        if (ref.outcome === 'conflict_candidate') { await client.query('ROLLBACK'); return { matched: false, reason: 'tmdb_exact_conflict', holderCatalogId: ref.holderCatalogId } }
        if (ref.outcome === 'kind_conflict') { await client.query('ROLLBACK'); return { matched: false, reason: 'tmdb_kind_conflict' } }
      } else {
        // candidate 档（任意 kind）或 auto_matched tv-show-root（D-202-1 never exact）→ candidate ref
        await insertCandidateRef(client, { catalogId, provider: 'tmdb', externalId: String(tmdbId), externalKind, source: 'auto', linkedBy: 'auto' })
      }

      // META-49-B2（ADR-205 方案 X）：身份+type 字段（tmdbId/imdbId cache + type ADR-203）留本事务写
      //（触发 catalog ref/cache 同事务，受上方 ref 成功约束）。`preserveMetadataSource: true` 固定——
      // 身份/cache/type 写入不接管 catalog.metadata_source（内容来源由 reconcile winner 裁决，避免
      // tmdb 仅写 cache 就把 anime bangumi 内容来源翻成 tmdb）。内容标量全量上抛 proposedFields 交 reconcile。
      let applied: string[] = []
      let proposedFields: CatalogUpdateData | undefined
      if (tier === 'auto_matched' && Object.keys(updateFields).length > 0) {
        const { identityFields, contentFields } = splitIdentityScalarFields(updateFields)
        if (Object.keys(identityFields).length > 0) {
          const catalogService = new MediaCatalogService(this.db)
          const { skippedFields } = await catalogService.safeUpdate(catalogId, identityFields, 'tmdb', { sourceRef: String(tmdbId), db: client, preserveMetadataSource: true })
          applied = Object.keys(identityFields).filter((k) => !skippedFields.includes(k))
        }
        if (Object.keys(contentFields).length > 0) proposedFields = contentFields
      }

      // 逐集（D-207-7）：季详情 episodes → catalog_episodes(source='tmdb')，复用 Phase 2 同一 client。
      // review P2-4 / ADR-207 D-207-10「逐集 upsert 失败不回滚已写 season exact」：用 SAVEPOINT 隔离——
      // 逐集失败仅 ROLLBACK TO SAVEPOINT（弃逐集），season exact / 字段 / video ref 已写部分保留并随主事务 COMMIT。
      if (seasonResolved && seasonDetail?.episodes?.length) {
        await client.query('SAVEPOINT tmdb_episodes')
        try {
          await upsertCatalogEpisodes(client, catalogId, seasonDetail.episodes.map(toTmdbEpisodeInput))
          await client.query('RELEASE SAVEPOINT tmdb_episodes')
        } catch (epErr) {
          await client.query('ROLLBACK TO SAVEPOINT tmdb_episodes')
          baseLogger.warn({ err: epErr, catalogId, videoId }, '[tmdb-season] episode upsert failed, season exact retained (ADR-207 D-207-10)')
        }
      }

      // video ref：季路径写季自身 id（D-207-6：不同季 video 不跨季过并）；movie/show 路径写 tmdbId
      await upsertVideoExternalRef(client, {
        videoId, provider: 'tmdb', externalId: refExternalId,
        matchStatus: tier, matchMethod: 'auto', confidence: score, isPrimary: tier === 'auto_matched', linkedBy: 'auto',
      })

      await client.query('COMMIT')

      // META-49-B2：auto_matched primary ref 写入后定向重评（外部 ID 证据面变化，对齐 bangumi
      // applyAutoMatchAtomic:592；META-48 遗漏补齐）。fire-and-forget，失败仅 warn 不阻断。
      if (tier === 'auto_matched') enqueueIdentityVideoRescore(videoId)
      return {
        matched: true, tier, tmdbId, confidence: score, applied, proposedFields,
        // 季集数交卡 C stepTmdb 经 episodesByStatus 派发 total/current_episodes（D-207-7；此处仅回传，避免 service↔enrich 循环 import）
        seasonEpisodeCount: seasonResolved && season && season.episode_count > 0 ? season.episode_count : undefined,
        // review P2-3：provenance 用本次实际 ref id（季级=season id），stepTmdb 取作 sourceRef，准确指向季而非 show
        externalRefId: refExternalId,
      }
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
