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

    const externalKind: ExternalRefKind = mediaType === 'movie' ? 'movie' : seasonNumber != null ? 'season' : 'show'
    const updateFields = buildCatalogFields(detail, mediaType, fields, imageBase)
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
    try {
      const cfg = await loadTmdbClientConfig(this.db)
      if (!cfg.readAccessToken && !cfg.apiKey) return { matched: false, reason: 'no_credentials' }

      // META-50-1B：knownNames 驱动多词检索（用 catalogId = effectiveCatalogId，含 bangumi redirect 后）。
      // knownNames 空（如新建无别名）→ 兜底单视频标题，行为等价 META-47 单词检索。
      const knownNames = await loadKnownNames(this.db, catalogId)
      const searchTerms = buildTmdbSearchTerms(knownNames, title)
      const scoreTargets = buildTmdbScoreTargets(knownNames, title)
      const best = await this.multiTermSearch(searchTerms, scoreTargets, targetYear, mediaType, cfg)
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
      }
    } catch {
      // 凭证错误 / 429 退避耗尽 / 网络 → 不写、不抛，等下次 worker 重试
      return { matched: false, reason: 'tmdb_unavailable' }
    }

    const tier: 'auto_matched' | 'candidate' = detail ? 'auto_matched' : 'candidate'
    const externalKind: ExternalRefKind = mediaType === 'movie' ? 'movie' : seasonNumber != null ? 'season' : 'show'

    // auto_matched：构造应用字段（事务外预读 type 信号，复用 confirm 的 ADR-203 逻辑）
    const updateFields: CatalogUpdateData = {}
    if (detail) {
      Object.assign(updateFields, buildCatalogFields(detail, mediaType, TMDB_APPLIABLE_FIELDS, imageBase))
      updateFields.tmdbId = tmdbId // 经 safeUpdate fill-if-empty 白名单（M4），受下方 ref 成功约束
      const imdbId = detail.external_ids?.imdb_id ?? null
      if (imdbId) updateFields.imdbId = imdbId
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
        // 精确级 exact：冲突 = 归并信号 → ROLLBACK 不写 cache（D-205-7「受 refs 成功约束」）
        const ref = await resolveAndWriteExactRef(client, {
          catalogId, provider: 'tmdb', externalId: String(tmdbId), externalKind,
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

      await upsertVideoExternalRef(client, {
        videoId, provider: 'tmdb', externalId: String(tmdbId),
        matchStatus: tier, matchMethod: 'auto', confidence: score, isPrimary: tier === 'auto_matched', linkedBy: 'auto',
      })

      await client.query('COMMIT')

      // META-49-B2：auto_matched primary ref 写入后定向重评（外部 ID 证据面变化，对齐 bangumi
      // applyAutoMatchAtomic:592；META-48 遗漏补齐）。fire-and-forget，失败仅 warn 不阻断。
      if (tier === 'auto_matched') enqueueIdentityVideoRescore(videoId)
      return { matched: true, tier, tmdbId, confidence: score, applied, proposedFields }
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
