/**
 * MetadataEnrichService.ts — 自动元数据丰富服务
 * CHG-385 Phase 3：入库后自动豆瓣匹配 + Bangumi 补充 + 源检验 + meta_score
 * META-05：Step1 改为多字段召回（title_norm → alias fallback）+ 置信度决策
 *           + video_external_refs 写入
 *
 * 五步流程：
 *   Step1: 本地 external_data.douban_entries 多字段召回（title_norm → alias）
 *          置信度 ≥0.85 → auto_matched 写 catalog；[0.60,0.85) → candidate 仅写 refs
 *   Step2: 本地无结果 fallback → douban 网络搜索（置信度分级）
 *   Step3: type=anime 时查 external_data.bangumi_entries
 *   Step4: 源 HEAD 检验，写 source_check_status
 *   Step5: 计算 meta_score（title/cover/description/genres/year/type 各有权重）
 */

import type { Pool } from 'pg'
import type { DoubanStatus, DoubanMatchMethod, SourceCheckStatus, VideoMetaQuality } from '@/types'
import { countryToIso } from '@/types'
import { searchDouban } from '@/api/lib/douban'
import { getDoubanDetailRich } from '@/api/lib/doubanAdapter'
import { mapDoubanGenres } from '@/api/lib/genreMapper'
import { MediaCatalogService } from './MediaCatalogService'
import { BangumiService } from './BangumiService'
import { TmdbConfirmService, type TmdbMediaType } from './TmdbConfirmService'
import { isAmbiguousLocalMatch } from './BangumiService.utils'
import { baseLogger } from '@/api/lib/logger'
import { normalizeForExternalMatch } from './TitleNormalizer'
import { isPinyin } from './PinyinDetector'
import * as externalDataQueries from '@/api/db/queries/externalData'
import * as sourcesQueries from '@/api/db/queries/sources'
import * as videosQueries from '@/api/db/queries/videos'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import type { DoubanEntryMatch } from '@/api/db/queries/externalData'
import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
import { enqueueIdentityVideoRescore } from './identity/enqueueVideoRescore'
import { reconcileMetadata, type ReconcileSource } from './metadata/reconcile'

// ── 公开接口 ──────────────────────────────────────────────────────

export interface EnrichJobData {
  videoId: string
  catalogId: string
  title: string
  year: number | null
  type: string
  /** 触发来源（可观测；crawl=爬虫入库 / backfill=批量重富集 / manual=后台手动）。省略视为 crawl。 */
  trigger?: 'crawl' | 'backfill' | 'manual'
}

// ── 内部常量 ──────────────────────────────────────────────────────

/** 置信度阈值：≥ AUTO_MATCH → 写 catalog；≥ CANDIDATE → 仅写 refs */
const CONFIDENCE_AUTO_MATCH = 0.85
const CONFIDENCE_CANDIDATE = 0.60

/** 豆瓣 Step2 网络搜索置信度阈值（沿用原有语义） */
const MATCH_THRESHOLD = 0.75
const CANDIDATE_THRESHOLD = 0.45

/** 源检验最大并发 HEAD 请求数 */
const SOURCE_CHECK_CONCURRENCY = 5
/** 源检验单次超时 ms */
const SOURCE_CHECK_TIMEOUT_MS = 8_000
/** 每视频最多检验源数 */
const SOURCE_CHECK_LIMIT = 20

// ── Service ───────────────────────────────────────────────────────

export class MetadataEnrichService {
  private catalogService: MediaCatalogService
  private bangumiService: BangumiService
  private tmdbConfirmService: TmdbConfirmService

  constructor(private db: Pool) {
    this.catalogService = new MediaCatalogService(db)
    this.bangumiService = new BangumiService(db, this.catalogService)
    this.tmdbConfirmService = new TmdbConfirmService(db)
  }

  async enrich(data: EnrichJobData): Promise<void> {
    const { videoId, catalogId, title, year, type } = data
    // 外部源富集匹配用标点不敏感归一化（META-22）：仅流向 step1 douban dump 查询 +
    // step3 bangumi matchAndEnrich 两个匹配边界；不参与持久化归并键。
    const titleNorm = normalizeForExternalMatch(title)

    // 预取 catalog 以获取 imdbId / titleEn（供 step1 精确匹配 / 拼音判断）+ status
    //（决定 episodes 写 total 还是 current / ADR-163 D-163-5）
    const catalogSnapshot = await catalogQueries.findCatalogById(this.db, catalogId)
    const imdbId = catalogSnapshot?.imdbId ?? null
    const titleEn = catalogSnapshot?.titleEn ?? null
    const catalogStatus = catalogSnapshot?.status ?? null

    let doubanStatus: DoubanStatus = 'unmatched'

    // CHG-365-A2: meta_quality 信号字典累计器；step1/step2 写入豆瓣置信度，
    // enrich 入口直接判 title_en 是否拼音（PinyinDetector / CHG-365-A1）
    const metaQuality: VideoMetaQuality = {
      title_en_is_pinyin: isPinyin(titleEn),
    }

    // Step 1: 本地豆瓣多字段召回
    // 注：DoubanEntryMatch 本地 dump 无 episodes 字段 / 不写 total/current_episodes
    // （ADR-163 §11 A3 advisory / 留给 step2 网络搜索补 + step3 bangumi 补）
    const step1 = await this.step1LocalDouban(
      videoId, catalogId, titleNorm, title, year, imdbId, metaQuality,
    )
    if (step1 !== null) {
      doubanStatus = step1
    } else {
      // Step 2: 本地无任何匹配，fallback 至网络搜索
      const step2 = await this.step2NetworkSearch(
        videoId, catalogId, title, year, metaQuality, catalogStatus,
      )
      if (step2 !== null) doubanStatus = step2
    }

    // 豆瓣未命中（Step1/Step2 均未写信号）→ 显式标记 unmatched 便于审核台筛选
    if (metaQuality.douban_match_status === undefined) {
      metaQuality.douban_match_status = 'unmatched'
    }

    // Step 3: 动画类型补充 Bangumi 数据（ADR-161：委托 BangumiService，含置信度 + ref + rich 详情 + 逐集）
    // ADR-174 D-174-3：bangumi 真去重可能把 video.catalog_id 重指向到 existing catalog →
    // 返回有效 catalogId 供 step5 使用（用旧入参 catalogId 会对已弃置 orphan catalog 算分）。
    // ADR-205 D-205-1（gather → reconcile → write，META-49-B2）：bangumi/tmdb 内容标量 proposedFields
    // 先收集、再逐字段加权裁决（reconcileMetadata），不再各自立即 safeUpdate。身份副作用（ref/cache/
    // redirect/episodes/type）已在各源自有事务写（方案 X）。douban Step1/2 不进 gather（留 49-D），其
    // 已写内容由 reconcile winner 经优先级闸门覆盖。
    let effectiveCatalogId = catalogId
    const reconcileSources: ReconcileSource[] = []
    if (type === 'anime') {
      const bangumiResult = await this.step3Bangumi(videoId, catalogId, titleNorm, year)
      effectiveCatalogId = bangumiResult.effectiveCatalogId
      if (bangumiResult.proposedFields && bangumiResult.bangumiSubjectId != null) {
        reconcileSources.push({
          source: 'bangumi',
          sourceRef: String(bangumiResult.bangumiSubjectId),
          confidence: bangumiResult.confidence ?? 0,
          fields: bangumiResult.proposedFields,
        })
      }
    }

    // Step 3.5: TMDB 全类型自动富集（META-48 / ADR-205 D-205-7）——用 step3 后 effectiveCatalogId
    // （含 bangumi redirect 真去重场景，防写 orphan）；身份/ref/cache/type 在 autoMatch 自有事务写，
    // 内容标量上抛交 reconcile 加权（interim 交叉验证已退场）。
    const tmdbSource = await this.stepTmdb(videoId, effectiveCatalogId, title, year, type)
    if (tmdbSource) reconcileSources.push(tmdbSource)

    // reconcile：bangumi/tmdb 内容标量逐字段 canonical 加权裁决 + winner 写 catalog + proposals 落表
    //（含 conflict_state，49-C derive 消费）。单源（如非 anime 仅 tmdb）退化为按 confidence 直接 winner。
    if (reconcileSources.length > 0) {
      await reconcileMetadata(this.db, effectiveCatalogId, reconcileSources)
    }

    // Step 4: 源 HEAD 检验
    const sourceStatus = await this.step4SourceCheck(videoId)

    // Step 5: 计算 meta_score（用 step3 后的有效 catalogId，含 redirect 真去重场景）
    const metaScore = await this.step5MetaScore(effectiveCatalogId)

    metaQuality.enriched_at = new Date().toISOString()

    await videosQueries.updateVideoEnrichStatus(this.db, videoId, {
      doubanStatus, metaScore, metaQuality,
    })
    await videosQueries.updateVideoSourceCheckStatus(this.db, videoId, sourceStatus)
  }

  /**
   * Step 3.5（META-48 / ADR-205 D-205-7）：TMDB 全类型自动富集（sequential-write，调 autoMatch）。
   *
   * - **去重守卫**：已有 primary tmdb 绑定（auto_matched/manual_confirmed）→ skip 不重配
   *   （对齐 bangumi D-170-4-AMD，避免覆盖人工确认 + 省 API）。
   * - **全类型**（D-用户-1）：`type==='movie'?'movie':'tv'`（series/anime/variety → tv）。
   * - **凭证/限流**：autoMatch 内已 graceful skip；本层 try/catch 保 TMDB 失败不阻断 enrich 主流程
   *   （douban/bangumi 已写、step4/5 仍跑）。交叉验证（等/高优先级源仅补空）在 autoMatch 内（Option A）。
   */
  private async stepTmdb(
    videoId: string,
    effectiveCatalogId: string,
    title: string,
    year: number | null,
    type: string,
  ): Promise<ReconcileSource | null> {
    const tmdbLog = baseLogger.child({ module: 'enrich-tmdb', video_id: videoId })
    try {
      const tmdbRefs = await externalDataQueries.listVideoExternalRefs(this.db, videoId, 'tmdb')
      const alreadyBound = tmdbRefs.some(
        (r) => r.isPrimary && (r.matchStatus === 'auto_matched' || r.matchStatus === 'manual_confirmed'),
      )
      if (alreadyBound) {
        tmdbLog.info({ outcome: 'skip_already_bound' }, 'tmdb auto skipped: already bound')
        return null
      }

      const mediaType: TmdbMediaType = type === 'movie' ? 'movie' : 'tv'
      const result = await this.tmdbConfirmService.autoMatch(videoId, effectiveCatalogId, { title, year, mediaType })
      if (result.matched) {
        tmdbLog.info(
          { outcome: 'matched', tier: result.tier, tmdb_id: result.tmdbId, confidence: result.confidence, applied: result.applied.length },
          'tmdb auto matched',
        )
        // META-49-B2（方案 X）：身份/ref/cache/type 已在 autoMatch 自有事务写；内容标量上抛交 reconcile 加权。
        if (result.proposedFields && Object.keys(result.proposedFields).length > 0) {
          return { source: 'tmdb', sourceRef: String(result.tmdbId), confidence: result.confidence, fields: result.proposedFields }
        }
        return null
      }
      tmdbLog.info({ outcome: 'skip', reason: result.reason }, 'tmdb auto no write')
      return null
    } catch (err) {
      // TMDB 为补充源，失败不阻断 enrich（douban/bangumi 已写、step4/5 仍跑）
      tmdbLog.warn({ err }, 'tmdb auto step failed (non-blocking)')
      return null
    }
  }

  /**
   * ADR-186 D-186-4：豆瓣 auto 候选写入后，依 safeUpdate 返回的 skippedFields 判定 doubanId
   * 是否真正落地 catalog（INV-1）。
   * - doubanId ∈ skippedFields（来源优先级 fill 失败已不可能至此 / 字段锁 / exact 冲突降级 /
   *   列已被占用）→ 落 'candidate'（refStatus='candidate'），catalog 未绑定，保留人工确认（INV-2）。
   * - 否则 → 落 'matched'（refStatus='auto_matched'）。
   * 同步把 recordDoubanSignal + video_external_refs 用最终 refStatus 写入，三处状态一致
   *（douban_status / meta_quality.douban_match_status / video_external_refs.match_status）。
   */
  private async finalizeDoubanAutoWrite(params: {
    videoId: string
    doubanId: string
    skippedFields: string[]
    confidence: number
    method: DoubanMatchMethod
    breakdown: Record<string, number>
    metaQuality: VideoMetaQuality
  }): Promise<DoubanStatus> {
    const { videoId, doubanId, skippedFields, confidence, method, breakdown, metaQuality } = params
    const landed = !skippedFields.includes('doubanId')
    const refStatus: 'auto_matched' | 'candidate' = landed ? 'auto_matched' : 'candidate'
    recordDoubanSignal(metaQuality, confidence, method, refStatus)
    await this.writeExternalRef(videoId, doubanId, refStatus, confidence, breakdown, method)
    return landed ? 'matched' : 'candidate'
  }

  // ── Step 1 ───────────────────────────────────────────────────────

  private async step1LocalDouban(
    videoId: string,
    catalogId: string,
    titleNorm: string,
    originalTitle: string,
    year: number | null,
    imdbId: string | null,
    metaQuality: VideoMetaQuality,
  ): Promise<DoubanStatus | null> {
    // 1a: imdb_id 精确匹配（最高置信度，auto 候选）
    if (imdbId) {
      const imdbMatch = await externalDataQueries.findDoubanByImdbId(this.db, imdbId)
      if (imdbMatch) {
        // ADR-186 D-186-4：先 safeUpdate，据 doubanId 是否真正落地决定 status / refStatus
        // （避免 catalog 未绑定却虚标 matched）。
        const { skippedFields } = await this.catalogService.safeUpdate(catalogId, {
          doubanId: imdbMatch.doubanId,
          rating: imdbMatch.rating ?? undefined,
          description: imdbMatch.description ?? undefined,
          coverUrl: imdbMatch.coverUrl ?? undefined,
          director: imdbMatch.directors,
          cast: imdbMatch.cast,
          writers: imdbMatch.writers,
          genres: imdbMatch.genres.length > 0 ? mapDoubanGenres(imdbMatch.genres) : undefined,
          genresRaw: imdbMatch.genres.length > 0 ? imdbMatch.genres : undefined,
          country: countryToIso(imdbMatch.country) ?? undefined,
        }, 'douban', { sourceRef: imdbMatch.doubanId })
        return this.finalizeDoubanAutoWrite({
          videoId, doubanId: imdbMatch.doubanId, skippedFields,
          confidence: 1.0, method: 'imdb_id', breakdown: { imdb_id: 1.0 }, metaQuality,
        })
      }
    }

    // 1b: title_normalized 精确匹配
    let matches = await externalDataQueries.findDoubanByTitleNorm(this.db, titleNorm, year)
    let matchBy: 'title' | 'alias' = 'title'

    // 1c: alias fallback（title_norm 无结果时用原始标题搜 aliases[]）
    if (matches.length === 0) {
      matches = await externalDataQueries.findDoubanByAlias(this.db, originalTitle, year)
      matchBy = 'alias'
    }

    if (matches.length === 0) return null

    const best = matches[0]
    const { confidence, breakdown } = computeLocalDoubanConfidence(best, matchBy, year)

    if (confidence < CONFIDENCE_CANDIDATE) return null

    // META-22：本地有损键命中多条不同 douban 记录且年份同档 → 歧义，禁止 auto 绑定（降级候选人工确认）
    const ambiguous = isAmbiguousLocalMatch(matches, year)
    const wantAuto = confidence >= CONFIDENCE_AUTO_MATCH && !ambiguous

    // 置信度未达 auto（或歧义）→ candidate（不写 catalog，行为不变）
    if (!wantAuto) {
      recordDoubanSignal(metaQuality, confidence, matchBy, 'candidate')
      await this.writeExternalRef(videoId, best.doubanId, 'candidate', confidence, breakdown, matchBy)
      return 'candidate'
    }

    // auto 候选：ADR-186 D-186-4 先 safeUpdate，据 doubanId 落地结果决定最终 status / refStatus
    const { skippedFields } = await this.catalogService.safeUpdate(catalogId, {
      doubanId: best.doubanId,
      rating: best.rating ?? undefined,
      description: best.description ?? undefined,
      coverUrl: best.coverUrl ?? undefined,
      director: best.directors,
      cast: best.cast,
      writers: best.writers,
      genres: best.genres.length > 0 ? mapDoubanGenres(best.genres) : undefined,
      genresRaw: best.genres.length > 0 ? best.genres : undefined,
      country: countryToIso(best.country) ?? undefined,
    }, 'douban', { sourceRef: best.doubanId })
    return this.finalizeDoubanAutoWrite({
      videoId, doubanId: best.doubanId, skippedFields,
      confidence, method: matchBy, breakdown, metaQuality,
    })
  }

  // ── Step 2 ───────────────────────────────────────────────────────

  private async step2NetworkSearch(
    videoId: string,
    catalogId: string,
    title: string,
    year: number | null,
    metaQuality: VideoMetaQuality,
    catalogStatus: string | null,
  ): Promise<DoubanStatus | null> {
    let candidates: Awaited<ReturnType<typeof searchDouban>>
    try {
      // ADR-188 D-188-4：采集埋点归因 source=enrich_worker（透传至 searchDoubanRich HTTP 出口）
      candidates = await searchDouban(title, year ?? undefined, 'enrich_worker')
    } catch {
      return null
    }
    if (candidates.length === 0) return 'unmatched'

    const best = pickBestCandidate(title, year, candidates)
    if (!best) return 'unmatched'

    if (best.score >= MATCH_THRESHOLD) {
      const detail = await getDoubanDetailRich(best.id, 'enrich_worker')
      if (detail) {
        // CHORE-11 (2026-05-29) — 改条件赋值范式（同 step1 imdb / step1b title_norm /
        //   DoubanService 既有正确模式），消除 step2 之前用三元 `: undefined` 模式：
        //   `{writers: undefined}` 在 JS 中 property 真实存在 → safeUpdate/updateCatalogFields
        //   无 undefined skip → `undefined ?? null` → SQL `writers = null` → 违反
        //   `writers TEXT[] NOT NULL` 等 5 列约束。详 docs/decisions.md ADR-167 (TBD) /
        //   PR #4 SEQ-20260529-01 / 修法 (b) updateCatalogFields 同 commit 加 undefined skip 防御
        const ratingNum = detail.rate ? parseFloat(detail.rate) : NaN
        const updateFields: import('@/api/db/queries/mediaCatalog').CatalogUpdateData = {
          doubanId: detail.id,
        }
        if (!isNaN(ratingNum)) updateFields.rating = ratingNum
        if (detail.plotSummary) updateFields.description = detail.plotSummary
        if (detail.poster) updateFields.coverUrl = detail.poster
        if (detail.directors.length > 0) updateFields.director = detail.directors
        if (detail.cast.length > 0) updateFields.cast = detail.cast
        if (detail.screenwriters.length > 0) updateFields.writers = detail.screenwriters
        if (detail.genres.length > 0) {
          updateFields.genresRaw = detail.genres
          const mapped = mapDoubanGenres(detail.genres)
          if (mapped.length > 0) updateFields.genres = mapped
        }
        if (detail.countries[0]) {
          const iso = countryToIso(detail.countries[0])
          if (iso) updateFields.country = iso
        }

        // ADR-186 D-186-4：先 safeUpdate，据 doubanId 落地结果决定 status / refStatus
        const { skippedFields } = await this.catalogService.safeUpdate(catalogId, updateFields, 'douban', { sourceRef: detail.id })
        const doubanStatus = await this.finalizeDoubanAutoWrite({
          videoId, doubanId: detail.id, skippedFields,
          confidence: best.score, method: 'network', breakdown: { network_score: best.score }, metaQuality,
        })
        // ADR-163 D-163-5/6：豆瓣 detail.episodes 按 catalog.status 写入 total / current
        // auto 模式：仅当目标列 NULL 时写入（不覆盖人工校正值）。episodes 与 douban 绑定状态正交，
        // 即便 doubanId 未落地（降级 candidate）仍是有效集数信号，照写（沿既有口径）。
        if (typeof detail.episodes === 'number' && detail.episodes > 0) {
          await videosQueries.updateVideoEpisodes(
            this.db, videoId, episodesByStatus(catalogStatus, detail.episodes), 'auto',
          )
        }
        return doubanStatus
      }
    }

    const status = best.score >= CANDIDATE_THRESHOLD ? 'candidate' : 'unmatched'
    if (status === 'candidate') {
      recordDoubanSignal(metaQuality, best.score, 'network', 'candidate')
      await this.writeExternalRef(
        videoId, best.id, 'candidate',
        best.score, { network_score: best.score }, 'network'
      )
    }
    return status
  }

  // ── Step 3 ───────────────────────────────────────────────────────

  private async step3Bangumi(
    videoId: string,
    catalogId: string,
    titleNorm: string,
    year: number | null,
  ): Promise<{ effectiveCatalogId: string; proposedFields?: CatalogUpdateData; bangumiSubjectId?: number; confidence?: number }> {
    // ADR-161：置信度评分 + video_external_refs(provider='bangumi') + auto 命中拉 REST rich 详情 + 逐集
    // META-49-B1（方案 X）：enrich 走 defer——auto 内容标量上抛 proposedFields 交 reconcile 加权
    // （bangumi-sync 等直调不传 → 默认 inline 内部写全部，不丢内容字段）。
    const result = await this.bangumiService.matchAndEnrich({ videoId, catalogId, titleNorm, year, deferContentFields: true })
    // ADR-174 D-174-3：仅 auto 写入路径可能 redirect 真去重 → 返回有效 catalogId；
    // candidate/none 无 catalog 写入与重指向，沿用入参 catalogId。
    // META-49-B2（方案 X）：auto 流内容标量（proposedFields）+ confidence 上抛由 enrich 收集交 reconcile；
    // refresh 路径走 inline（service 内已写）→ 无 proposedFields，不进 reconcile（避免重复）。
    if (result.matched === 'auto') {
      return { effectiveCatalogId: result.catalogId, proposedFields: result.proposedFields, bangumiSubjectId: result.bangumiSubjectId, confidence: result.confidence }
    }
    return { effectiveCatalogId: catalogId }
  }

  // ── Step 4 ───────────────────────────────────────────────────────

  private async step4SourceCheck(videoId: string): Promise<SourceCheckStatus> {
    const sources = await sourcesQueries.listSourcesForBatchVerify(this.db, {
      scope: 'video',
      videoId,
      activeOnly: false,
      limit: SOURCE_CHECK_LIMIT,
    })
    if (sources.length === 0) return 'pending'

    let activeCount = 0
    for (let i = 0; i < sources.length; i += SOURCE_CHECK_CONCURRENCY) {
      const chunk = sources.slice(i, i + SOURCE_CHECK_CONCURRENCY)
      const results = await Promise.all(chunk.map((s) => headCheck(s.source_url)))
      for (let j = 0; j < chunk.length; j++) {
        const isActive = results[j]
        await sourcesQueries.updateSourceActiveStatus(this.db, chunk[j].id, isActive)
        if (isActive) activeCount++
      }
    }

    if (activeCount === 0) return 'all_dead'
    if (activeCount === sources.length) return 'ok'
    return 'partial'
  }

  // ── Step 5 ───────────────────────────────────────────────────────

  private async step5MetaScore(catalogId: string): Promise<number> {
    const catalog = await catalogQueries.findCatalogById(this.db, catalogId)
    if (!catalog) return 0
    let score = 0
    if (catalog.title) score += 20
    if (catalog.coverUrl) score += 20
    if (catalog.description) score += 20
    if (catalog.genres && catalog.genres.length > 0) score += 20
    if (catalog.year) score += 10
    if (catalog.type && catalog.type !== 'other') score += 10
    return Math.min(100, score)
  }

  // ── 辅助 ─────────────────────────────────────────────────────────

  private async writeExternalRef(
    videoId: string,
    externalId: string,
    matchStatus: 'auto_matched' | 'candidate',
    confidence: number,
    breakdown: Record<string, number>,
    matchMethod: string,
  ): Promise<void> {
    try {
      await externalDataQueries.upsertVideoExternalRef(this.db, {
        videoId,
        provider: 'douban',
        externalId,
        matchStatus,
        matchMethod,
        confidence,
        isPrimary: matchStatus === 'auto_matched',
        linkedBy: 'auto',
        notes: JSON.stringify(breakdown),
      })
      // BUGFIX-IDENTITY-ENRICH-RESCORE：外部 ID 证据面变化 → 定向重评入 identity 候选。
      // candidate 不入队（externalIdLoader 双源均不认 candidate，证据面不变）。
      if (matchStatus === 'auto_matched') {
        enqueueIdentityVideoRescore(videoId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[MetadataEnrichService] writeExternalRef failed for ${videoId}: ${msg}\n`)
    }
  }
}

// ── 纯函数工具 ─────────────────────────────────────────────────────

/**
 * CHG-365-A2: 把豆瓣命中信号写入 meta_quality 累计对象（auto enrich 内部用）。
 *
 * 后写覆盖前写：单次 enrich 内 step1 imdb → step1 title/alias → step2 network 至多
 * 命中其一；若不同 step 都命中（理论不可能因为 step1 命中后 step2 不执行），后写
 * 覆盖前写代表"最终生效的匹配信号"。
 */
export function recordDoubanSignal(
  metaQuality: VideoMetaQuality,
  confidence: number,
  method: DoubanMatchMethod,
  matchStatus: 'auto_matched' | 'candidate',
): void {
  metaQuality.douban_confidence = confidence
  metaQuality.douban_match_method = method
  metaQuality.douban_match_status = matchStatus
}

/**
 * CHG-367-B-A / ADR-163 D-163-5：按 catalog.status 把外部 episodes 数派发到
 * total_episodes（completed）或 current_episodes（ongoing / null）。
 *
 * 豆瓣 + bangumi 均不区分 total/current（单一 episodes 字段）→ 按 status 启发式判定。
 * 完结剧集 episodes = total；连载中 episodes = current（持续更新）。这是 ADR-163
 * §3 D-163-5 明确的可接受折衷（局限：标记 completed 但实际还在更新的剧集可能误判
 * → 人工 confirmSubject 路径可覆盖）。
 *
 * @param status catalog.status（'ongoing' | 'completed' | null / 其它）
 * @param episodes 外部源 episodes 数（应 > 0 / 调用方负责过滤）
 */
export function episodesByStatus(
  status: string | null,
  episodes: number,
): { totalEpisodes?: number; currentEpisodes?: number } {
  if (status === 'completed') {
    return { totalEpisodes: episodes }
  }
  // ongoing / null / 其它 → 写 current（连载语义 / NULL 默认按连载处理）
  return { currentEpisodes: episodes }
}

/**
 * CHG-365-A2 / Codex stop-time review #8 fix: 手动豆瓣操作时合并新信号到既有
 * meta_quality，避免 auto enrich 写入的 title_en_is_pinyin 等字段被清零。
 *
 * 三个手动入口：
 *   - DoubanService.confirmSubject  → method='manual',        confidence=1.0,  status='manual_confirmed'
 *   - DoubanService.confirmFields   → method='manual_fields', confidence=1.0,  status='manual_confirmed'
 *   - moderation.douban-ignore      → method=undefined,       confidence=null, status='unmatched'（清零）
 *
 * confidence 传 `null` 表示清零（如 ignore），传 number 表示写入；method 传
 * `null` 表示保留旧值（避免清零）。enriched_at 总是更新为当前时刻。
 */
export function buildManualMetaQuality(
  prev: VideoMetaQuality | null,
  patch: {
    status: 'manual_confirmed' | 'unmatched'
    method: DoubanMatchMethod | null
    confidence: number | null
  },
): VideoMetaQuality {
  const next: VideoMetaQuality = { ...(prev ?? {}) }
  next.douban_match_status = patch.status
  if (patch.method !== null) {
    next.douban_match_method = patch.method
  }
  if (patch.confidence === null) {
    // ignore 路径：清零 confidence + method（status 已置 unmatched）
    delete next.douban_confidence
    delete next.douban_match_method
  } else {
    next.douban_confidence = patch.confidence
  }
  next.enriched_at = new Date().toISOString()
  return next
}

/**
 * META-05: 计算本地 dump 条目的置信度
 *
 * 基础分（匹配方式）：
 *   title_norm 精确: 0.70
 *   alias 精确:       0.65
 *
 * 年份加分：
 *   diff == 0: +0.22
 *   diff == 1: +0.17
 *   diff >= 2: +0（不加分）
 *   无年份:    +0
 *
 * 阈值：≥0.85 → auto_matched；[0.60,0.85) → candidate；<0.60 → 丢弃
 */
export function computeLocalDoubanConfidence(
  entry: DoubanEntryMatch,
  matchBy: 'title' | 'alias',
  year: number | null,
): { confidence: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {}

  const base = matchBy === 'alias' ? 0.65 : 0.70
  breakdown[matchBy] = base
  let confidence = base

  if (year !== null && entry.year !== null) {
    const diff = Math.abs(entry.year - year)
    if (diff === 0) {
      breakdown.year_exact = 0.22
      confidence += 0.22
    } else if (diff === 1) {
      breakdown.year_close = 0.17
      confidence += 0.17
    }
    // diff >= 2: no bonus
  }

  return { confidence: Math.min(1, confidence), breakdown }
}

type Candidate = Awaited<ReturnType<typeof searchDouban>>[number]
interface ScoredCandidate { id: string; score: number }

function pickBestCandidate(
  title: string,
  year: number | null,
  candidates: Candidate[],
): ScoredCandidate | null {
  function similarity(a: string, b: string): number {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')
    const na = normalize(a); const nb = normalize(b)
    if (na === nb) return 1
    if (!na || !nb) return 0
    const bigrams = (s: string) => {
      const set = new Set<string>()
      for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
      return set
    }
    const sa = bigrams(na); const sb = bigrams(nb)
    let intersection = 0
    for (const g of sa) if (sb.has(g)) intersection++
    return (2 * intersection) / (sa.size + sb.size)
  }
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[（(][^）)]*[）)]/g, '').replace(/[^\p{L}\p{N}]/gu, '')

  let best: ScoredCandidate | null = null
  for (const item of candidates) {
    const titleSim = Math.max(
      similarity(normalize(title), normalize(item.title)),
      similarity(normalize(title), normalize(item.sub_title ?? '')),
    )
    const yearMatch = year && item.year ? (() => {
      const cy = parseInt(item.year); return Math.abs(cy - year)
    })() : 0
    const score = yearMatch === 0 ? Math.min(1, titleSim + 0.2) :
      yearMatch === 1 ? Math.min(1, titleSim + 0.1) : titleSim
    if (!best || score > best.score) best = { id: item.id, score }
  }
  return best
}

async function headCheck(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SOURCE_CHECK_TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
