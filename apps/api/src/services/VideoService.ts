/**
 * VideoService.ts — 视频业务逻辑
 * 所有查询通过 db/queries/videos.ts，不直接拼 SQL
 */

import type { Pool } from 'pg'
import type { Redis } from 'ioredis'
import type { Client as ESClient } from '@elastic/elasticsearch'
import type { Video, VideoCard, VideoType, VideoStatus, VisibilityStatus, Pagination, CountByTypeItem, ExternalRefSummary, BangumiEntrySummary } from '@/types'
import * as videoQueries from '@/api/db/queries/videos'
// ADR-172 AMENDMENT 3 / D-172-AMD3-3：admin 详情注入外部源并集 + bangumi 条目级
import * as externalDataQueries from '@/api/db/queries/externalData'
import type { VideoExternalRef } from '@/api/db/queries/externalData'
// ADR-161 AMENDMENT / META-19：admin 详情注入 bangumi 角色 + CV
import * as catalogCharacterQueries from '@/api/db/queries/catalogCharacters'
// ADR-201 / META-32-A：统一 metadataStatus 派生（列表/详情注入，与 enrichmentSummary 并返）
import {
  getMetadataProviderRefs, buildMetadataStatusSummary, toMetadataStatusSourceRow,
} from '@/api/db/queries/metadata-status.derive'
// ADR-205 M3 / META-49-C：跨源逐字段冲突批量注入（conflict_state → overall needs_review）
import { getConflictFieldsByCatalogIds } from '@/api/db/queries/metadata-field-proposals'
import type {
  UpdateVideoMetaInput,
  ModerationStats,
  PendingReviewVideoRow,
} from '@/api/db/queries/videos'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
// GOV-4（SEQ-20260612-03）：标题实变 → 当前版本观测 + 定向重评 hook
import { insertObservationIfAbsent } from '@/api/db/queries/titleObservations'
import { buildTitleObservation } from '@/api/services/titleObservation.builder'
import { enqueueIdentityVideoRescore } from '@/api/services/identity/enqueueVideoRescore'
import { recomputeCatalogBlockingKeys } from '@/api/services/metadata/catalogBlockingKeys'
import { baseLogger } from '@/api/lib/logger'
import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
// ADR-206 D-206-9（M7）：aliases 手动编辑替换写 manual aka（结构化表单一真源）
import { replaceManualAkaAliases, listCatalogAliases } from '@/api/db/queries/catalogAliases'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'
import { CACHE_PREFIXES } from '@/api/services/CacheService'
import { AuditLogService } from '@/api/services/AuditLogService'
import { NotificationEmitter } from '@/api/services/NotificationEmitter'
import { buildAuditNotificationEmit } from '@/api/services/notification-audit-emit'
import { normalizeMergeKey } from '@/api/services/TitleNormalizer'
import { enrichmentQueue } from '@/api/lib/queue'
import type { EnrichJobData } from '@/api/services/MetadataEnrichService'

// ── ADR-145 / CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A：admin 手动添加视频 ─────

export type VideoPublishMode = 'draft' | 'staging' | 'published'

export interface ManualAddVideoInput {
  title: string
  type: VideoType
  contentRating?: 'general' | 'adult'
  publishMode?: VideoPublishMode
  force?: boolean
  titleEn?: string | null
  description?: string | null
  coverUrl?: string | null
  year?: number | null
  country?: string | null
  episodeCount?: number
  status?: VideoStatus
  rating?: number | null
  director?: string[]
  cast?: string[]
  writers?: string[]
  genres?: string[]
  doubanId?: string | null
}

export interface VideoManualAddResult {
  id: string
  shortId: string
  title: string
  type: VideoType
  catalogId: string
  reviewStatus: 'pending_review' | 'approved'
  visibilityStatus: VisibilityStatus
  isPublished: boolean
  createdAt: string
}

export class VideoManualAddConflictError extends Error {
  readonly existingVideoId: string
  readonly existingTitle: string
  constructor(existingVideoId: string, existingTitle: string) {
    super(`catalog 已存在关联视频：${existingTitle} (${existingVideoId})`)
    this.name = 'VideoManualAddConflictError'
    this.existingVideoId = existingVideoId
    this.existingTitle = existingTitle
  }
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const COUNT_BY_TYPE_TTL = 300

export class VideoService {
  private readonly indexSync?: VideoIndexSyncService
  /** CHG-SN-4-10-A2：admin audit log（fire-and-forget） */
  private readonly auditSvc: AuditLogService
  /** NTLG-P1-c-B-2：解耦双写 emit 中枢（fire-and-forget） */
  private readonly notificationEmitter: NotificationEmitter

  constructor(
    private db: Pool,
    private es?: ESClient,
    private redis?: Redis,
  ) {
    if (es) {
      this.indexSync = new VideoIndexSyncService(db, es)
    }
    this.auditSvc = new AuditLogService(db)
    this.notificationEmitter = new NotificationEmitter(db)
  }

  async list(params: {
    type?: VideoType
    category?: string
    year?: number
    country?: string
    ratingMin?: number
    sort?: 'hot' | 'rating' | 'latest' | 'updated'
    page?: number
    limit?: number
  }): Promise<{ data: VideoCard[]; pagination: Pagination }> {
    const page = Math.max(1, params.page ?? 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT))

    const { rows, total } = await videoQueries.listVideos(this.db, {
      ...params,
      page,
      limit,
    })

    return {
      data: rows,
      pagination: {
        total,
        page,
        limit,
        hasNext: page * limit < total,
      },
    }
  }

  // ADR-160 D-160-4a：options.preview=true 时派发到 findVideoByShortIdAdminPreview
  // 既有调用零影响（options 可选 / 默认走 public 路径）
  async findByShortId(shortId: string, options?: { preview?: boolean }): Promise<Video | null> {
    if (options?.preview) {
      return videoQueries.findVideoByShortIdAdminPreview(this.db, shortId)
    }
    return videoQueries.findVideoByShortId(this.db, shortId)
  }

  async trending(params: {
    period?: 'today' | 'week' | 'month'
    type?: VideoType
    limit?: number
  }): Promise<VideoCard[]> {
    return videoQueries.listTrendingVideos(this.db, {
      period: params.period ?? 'week',
      type: params.type,
      limit: Math.min(MAX_LIMIT, params.limit ?? DEFAULT_LIMIT),
    })
  }

  // ── Admin 方法 ────────────────────────────────────────────────

  async adminList(params: {
    status?: 'pending' | 'published' | 'unpublished' | 'all'
    type?: import('@/types').VideoType
    types?: readonly import('@/types').VideoType[]
    q?: string
    siteKey?: string
    includeAdult?: boolean
    visibilityStatus?: import('@/types').VisibilityStatus
    reviewStatus?: import('@/types').ReviewStatus
    sortField?: string
    sortDir?: 'asc' | 'desc'
    // CHG-VSR-2（§2.6）：三层过滤入参（加性透传）
    yearMin?: number
    yearMax?: number
    country?: readonly string[]
    catalogStatus?: readonly import('@/types').VideoStatus[]
    isPublished?: boolean
    doubanStatus?: readonly import('@/types').DoubanStatus[]
    bangumiStatus?: readonly import('@/types').BangumiStatus[]
    metaScoreMin?: number
    metaScoreMax?: number
    episodeMismatch?: boolean
    episodeMissing?: boolean
    metaIncomplete?: boolean
    pendingReview?: boolean
    // META-32-B（ADR-201 §视频库 过滤）：元数据状态服务端过滤（加性透传）
    metadataOverall?: readonly import('@/types').MetadataStatusOverall[]
    // META-36-A：单列 provider facet（加性透传）
    metadataProvider?: readonly import('@/types').MetadataProvider[]
    metadataProviderState?: readonly import('@/types').MetadataProviderState[]
    metadataIssueLevel?: readonly import('@/types').MetadataIssueLevel[]
    metadataUpdatedFrom?: string
    metadataUpdatedTo?: string
    metadataNeedsReview?: boolean
    metadataHasCandidate?: boolean
    metadataMissing?: boolean
    metadataTmdbPending?: boolean
    // META-36-C：「已匹配源」OR 过滤（四源 applied + none 哨兵，加性透传）
    metadataMatched?: readonly import('@/types').MetadataMatchedFilterValue[]
    page?: number
    limit?: number
  }): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page ?? 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT))

    const { rows, total } = await videoQueries.listAdminVideos(this.db, {
      status: params.status ?? 'all',
      type: params.type,
      types: params.types,
      q: params.q,
      siteKey: params.siteKey,
      includeAdult: params.includeAdult,
      visibilityStatus: params.visibilityStatus,
      reviewStatus: params.reviewStatus,
      sortField: params.sortField,
      sortDir: params.sortDir,
      yearMin: params.yearMin,
      yearMax: params.yearMax,
      country: params.country,
      catalogStatus: params.catalogStatus,
      isPublished: params.isPublished,
      doubanStatus: params.doubanStatus,
      bangumiStatus: params.bangumiStatus,
      metaScoreMin: params.metaScoreMin,
      metaScoreMax: params.metaScoreMax,
      episodeMismatch: params.episodeMismatch,
      episodeMissing: params.episodeMissing,
      metaIncomplete: params.metaIncomplete,
      pendingReview: params.pendingReview,
      metadataOverall: params.metadataOverall,
      metadataProvider: params.metadataProvider,
      metadataProviderState: params.metadataProviderState,
      metadataIssueLevel: params.metadataIssueLevel,
      metadataUpdatedFrom: params.metadataUpdatedFrom,
      metadataUpdatedTo: params.metadataUpdatedTo,
      metadataNeedsReview: params.metadataNeedsReview,
      metadataHasCandidate: params.metadataHasCandidate,
      metadataMissing: params.metadataMissing,
      metadataTmdbPending: params.metadataTmdbPending,
      metadataMatched: params.metadataMatched,
      page,
      limit,
    })

    // ADR-170 C-3 / R-5：admin 路径注入 enrichmentSummary（raw 行，不经 public mapVideoRow）
    // ADR-201 / META-32-A：并注入统一 metadataStatus（按页批量 refs，避免 cell N+1）
    const refsMap = await getMetadataProviderRefs(
      this.db, rows.map((r) => ({ id: r.id, catalogId: r.catalog_id })),
    )
    // ADR-205 M3：批量取冲突字段（按 catalog 去重，走 partial index 避 N+1）→ 冲突 catalog 浮 needs_review
    const conflictsMap = await getConflictFieldsByCatalogIds(
      this.db, [...new Set(rows.map((r) => r.catalog_id))],
    )
    const data = rows.map((r) => ({
      ...r,
      enrichmentSummary: videoQueries.buildEnrichmentSummary(r),
      metadataStatus: buildMetadataStatusSummary(
        toMetadataStatusSourceRow(r, refsMap.get(r.id) ?? [], conflictsMap.get(r.catalog_id) ?? []),
      ),
    }))
    return { data, total, page, limit }
  }

  async adminFindById(id: string): Promise<unknown | null> {
    const row = await videoQueries.findAdminVideoById(this.db, id)
    if (!row) return null
    // ADR-172 AMENDMENT 3：外部源并集（多源映射）+ bangumi 条目级（anime + 命中时）。
    // 仅详情注入（不挂列表 / 不挂 public mapVideoRow / R-5）。
    const refs = await externalDataQueries.listVideoExternalRefs(this.db, id)
    const externalRefs: ExternalRefSummary[] = refs.map((r) => ({
      provider: r.provider,
      externalId: r.externalId,
      matchStatus: r.matchStatus,
      matchMethod: r.matchMethod,
      confidence: r.confidence,
      isPrimary: r.isPrimary,
    }))
    const bangumiInfo = await this.loadBangumiInfo(row, refs)
    // ADR-161 AMENDMENT / META-19：anime 角色 + CV（仅命中时下发；非 anime 跳过）
    const bangumiCharacters = row.type === 'anime'
      ? await catalogCharacterQueries.listCatalogCharactersForDisplay(this.db, row.catalog_id, 'bangumi')
      : []
    // ADR-201 / META-32-A：详情注入统一 metadataStatus（单视频 refs）+ ADR-205 M3 冲突字段
    const refsMap = await getMetadataProviderRefs(this.db, [{ id: row.id, catalogId: row.catalog_id }])
    const conflictsMap = await getConflictFieldsByCatalogIds(this.db, [row.catalog_id])
    // ADR-206 D-206-9（3B-1）：注入结构化 manual aka（source=manual ∧ kind=aka）供编辑/快编回填——
    // 读结构化表（mc.aliases 数组列与结构化表无同步会 stale）；过滤 manual 保回填=replaceManualAkaAliases
    // 提交作用域双向一致（防回填非 manual 别名被提交时误转 manual）。
    const aliasRows = await listCatalogAliases(this.db, row.catalog_id, ['aka'])
    const aliases = aliasRows.filter((a) => a.source === 'manual').map((a) => a.alias)
    return {
      ...row,
      aliases,
      enrichmentSummary: videoQueries.buildEnrichmentSummary(row),
      metadataStatus: buildMetadataStatusSummary(
        toMetadataStatusSourceRow(row, refsMap.get(row.id) ?? [], conflictsMap.get(row.catalog_id) ?? []),
      ),
      externalRefs,
      ...(bangumiInfo ? { bangumiInfo } : {}),
      ...(bangumiCharacters.length > 0 ? { bangumiCharacters } : {}),
    }
  }

  /**
   * ADR-172 AMENDMENT 3 / D-172-AMD3-3：取 anime 的 Bangumi 条目级展示投影。
   * 仅 type==='anime' 时尝试；优先 primary bangumi ref 的 externalId，回退 row.bangumi_subject_id；
   * dump 无该条目（findBangumiById=null）则返回 null（bangumiInfo 不下发）。
   */
  private async loadBangumiInfo(
    row: { type: string; bangumi_subject_id: number | null },
    refs: VideoExternalRef[],
  ): Promise<BangumiEntrySummary | null> {
    if (row.type !== 'anime') return null
    const primaryBangumi = refs.find((r) => r.provider === 'bangumi' && r.isPrimary)
    const bangumiId = primaryBangumi ? Number(primaryBangumi.externalId) : row.bangumi_subject_id
    if (!bangumiId || !Number.isFinite(bangumiId)) return null
    const entry = await externalDataQueries.findBangumiById(this.db, bangumiId)
    if (!entry) return null
    return {
      bangumiId: entry.bangumiId,
      titleCn: entry.titleCn,
      titleJp: entry.titleJp,
      year: entry.year,
      rating: entry.rating,
      summary: entry.summary,
      airDate: entry.airDate,
      coverUrl: entry.coverUrl,
      rank: entry.rank,
      nsfw: entry.nsfw,
    }
  }

  /**
   * ADR-145 / CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A：admin 手动添加视频
   *
   * 流程：findOrCreate catalog（metadataSource='manual'）→ 重复检测 →
   *      createVideo → publishMode 三路径状态映射 → indexSync + audit fire-and-forget
   *
   * 错误：catalog 已有关联 video 且 force≠true → throw VideoManualAddConflictError（Route 转 409）
   */
  async create(input: ManualAddVideoInput, actorId: string): Promise<VideoManualAddResult> {
    // Step 1: 复用 MediaCatalogService.findOrCreate（含 5 步匹配 + locked_fields 保护）
    const catalogService = new MediaCatalogService(this.db)
    const catalog = await catalogService.findOrCreate({
      title: input.title,
      titleNormalized: normalizeMergeKey(input.title),
      type: input.type,
      year: input.year ?? null,
      titleEn: input.titleEn ?? null,
      description: input.description ?? null,
      coverUrl: input.coverUrl ?? null,
      genres: input.genres ?? [],
      country: input.country ?? null,
      status: input.status ?? 'completed',
      rating: input.rating ?? null,
      director: input.director ?? [],
      cast: input.cast ?? [],
      writers: input.writers ?? [],
      doubanId: input.doubanId ?? null,
      metadataSource: 'manual',
    })

    // Step 2: 重复检测（D-145-2 软匹配 + force 跳过）
    const existing = await this.db.query<{ id: string; title: string }>(
      `SELECT id, title FROM videos WHERE catalog_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [catalog.id],
    )
    const isCatalogNewForVideos = existing.rows.length === 0
    if (!isCatalogNewForVideos && !input.force) {
      throw new VideoManualAddConflictError(existing.rows[0]!.id, existing.rows[0]!.title)
    }

    // Step 3: createVideo（默认 pending_review + internal + is_published=false）
    const video = await videoQueries.createVideo(this.db, {
      catalogId: catalog.id,
      title: input.title,
      type: input.type,
      episodeCount: input.episodeCount ?? 1,
      contentRating: input.contentRating ?? 'general',
    })

    // Step 4: publishMode 三路径（D-145-4）
    const publishMode = input.publishMode ?? 'staging'
    let finalReviewStatus: 'pending_review' | 'approved' = 'pending_review'
    let finalVisibility: VisibilityStatus = 'internal'
    let finalIsPublished = false
    if (publishMode === 'draft') {
      // hidden + 仍 pending（与 staging 区别在 visibility）
      await this.db.query(
        `UPDATE videos SET visibility_status = 'hidden' WHERE id = $1`,
        [video.id],
      )
      finalVisibility = 'hidden'
    } else if (publishMode === 'published') {
      // approved + public + published（admin 自审自发；走状态机 trigger 守卫）
      await videoQueries.transitionVideoState(this.db, video.id, { action: 'approve_and_publish' })
      finalReviewStatus = 'approved'
      finalVisibility = 'public'
      finalIsPublished = true
    }
    // 'staging' 默认：保持 createVideo 初始状态（pending_review + internal + false）

    // Step 5: ES index sync（fire-and-forget）
    void this.indexSync?.syncVideo(video.id)

    // Step 6: R-MID-1 第 24 次系统化 audit fire-and-forget
    this.auditSvc.write({
      actorId,
      actionType: 'video.manual_add',
      targetKind: 'video',
      targetId: video.id,
      beforeJsonb: null,
      afterJsonb: {
        id: video.id,
        title: input.title,
        type: input.type,
        year: input.year ?? null,
        publishMode,
        catalogId: catalog.id,
        isNewCatalog: isCatalogNewForVideos,
        contentRating: input.contentRating ?? 'general',
      },
    })

    // NTLG-P1-c-B-2：解耦双写 emit（与 audit 互不依赖；fire-and-forget）
    this.notificationEmitter.emit(
      buildAuditNotificationEmit({ actionType: 'video.manual_add', targetId: video.id }),
    )

    return {
      id: video.id,
      shortId: video.short_id,
      title: video.title,
      type: video.type,
      catalogId: catalog.id,
      reviewStatus: finalReviewStatus,
      visibilityStatus: finalVisibility,
      isPublished: finalIsPublished,
      createdAt: video.created_at,
    }
  }

  async update(
    id: string,
    input: Record<string, unknown>,
  ): Promise<{ data: unknown; skippedFields: string[] } | null> {
    // Step 1: 获取当前视频（含 catalog_id）
    const video = await videoQueries.findAdminVideoById(this.db, id)
    if (!video) return null

    // Step 2: 提取 catalog 元数据字段，通过 MediaCatalogService.safeUpdate 写入（source='manual'）
    const catalogFields: CatalogUpdateData = {}
    if (input.title !== undefined) catalogFields.title = String(input.title)
    if (input.titleEn !== undefined) catalogFields.titleEn = input.titleEn as string | null
    // ADR-206 D-206-8（M6）：原名/原语种经既有 safeUpdate fieldMap 写（不旁路 reconcile）
    if (input.titleOriginal !== undefined) catalogFields.titleOriginal = input.titleOriginal as string | null
    if (input.originalLanguage !== undefined) catalogFields.originalLanguage = input.originalLanguage as string | null
    if (input.description !== undefined) catalogFields.description = input.description as string | null
    if (input.coverUrl !== undefined) catalogFields.coverUrl = input.coverUrl as string | null
    if (input.type !== undefined) catalogFields.type = input.type as string
    if (input.genres !== undefined) catalogFields.genres = input.genres as string[]
    if (input.year !== undefined) catalogFields.year = input.year as number | null
    if (input.country !== undefined) catalogFields.country = input.country as string | null
    if (input.status !== undefined) catalogFields.status = input.status as string
    if (input.rating !== undefined) catalogFields.rating = input.rating as number | null
    if (input.director !== undefined) catalogFields.director = input.director as string[]
    if (input.cast !== undefined) catalogFields.cast = input.cast as string[]
    if (input.writers !== undefined) catalogFields.writers = input.writers as string[]
    if (input.doubanId !== undefined) catalogFields.doubanId = input.doubanId as string | null

    let skippedFields: string[] = []
    if (Object.keys(catalogFields).length > 0) {
      const catalogService = new MediaCatalogService(this.db)
      const result = await catalogService.safeUpdate(video.catalog_id, catalogFields, 'manual', {})
      skippedFields = result.skippedFields
    }

    // META-50-3A（ADR-206 D-206-9 M7）：aliases 替换写 manual aka（结构化表单一真源）。
    // 在 recompute 前 await——新 aka 入 knownNames → blocking 桶；写失败应让请求失败（主数据非派生）。
    if (input.aliases !== undefined) {
      await replaceManualAkaAliases(this.db, video.catalog_id, input.aliases as string[])
    }

    // META-50-2A-1（Codex fix）+ 3A 扩：手动编辑改 catalog 已知名字段（title/titleEn/titleOriginal/aliases）
    // 后重算 blocking 归一键——否则派生表 stale，2A-2 召回口径漂移。originalLanguage 是语种标注非名字
    // （不入 knownNames 文本投影）→ 不触发。fire-and-forget 非阻断（失败仅 warn 不阻断 admin 主流程）。
    if (
      catalogFields.title !== undefined ||
      catalogFields.titleEn !== undefined ||
      catalogFields.titleOriginal !== undefined ||
      input.aliases !== undefined
    ) {
      void recomputeCatalogBlockingKeys(this.db, video.catalog_id).catch((err: unknown) => {
        baseLogger.warn({ err, catalog_id: video.catalog_id }, '[blocking-keys] manual edit recompute failed')
      })
    }

    // Step 3: 更新 videos 表冗余副本字段（title/type/episodeCount/slug）
    const adaptedInput: UpdateVideoMetaInput = {
      ...(input.title !== undefined ? { title: String(input.title) } : {}),
      ...(input.type !== undefined ? { type: input.type as VideoType } : {}),
      ...(input.episodeCount !== undefined ? { episodeCount: input.episodeCount as number } : {}),
      ...(input.slug !== undefined ? { slug: input.slug as string | null } : {}),
    }
    const row = await videoQueries.updateVideoMeta(this.db, id, adaptedInput)
    if (row) void this.indexSync?.syncVideo(id)

    // GOV-4（SEQ-20260612-03 缺陷 B）：标题**实变**时写当前版本观测 + 定向重评——
    // 标题修正恰是制造合并候选的时机（标准化趋同案例：重案解密们），此前无任何触达机制。
    // fire-and-forget 容错（沿 ingestShadow 范式：失败仅 warn 不阻断 admin 主流程）。
    const newTitle = input.title !== undefined ? String(input.title) : null
    if (row && newTitle !== null && newTitle !== video.title) {
      void insertObservationIfAbsent(this.db, buildTitleObservation(id, newTitle, null))
        .then(() => enqueueIdentityVideoRescore(id, 'title_change'))
        .catch((err: unknown) => {
          baseLogger.warn({ err, video_id: id }, '[identity] title_change observation/rescore hook failed')
        })
    }

    // ADR-161 决策要点 6：改类型为 anime（原非 anime）时入队 Bangumi 丰富（去重 jobId，延迟 5min）
    // 经 enrichmentQueue 直接入队（与 CrawlerService 同模式），避免引入 worker 模块的 db 单例
    if (input.type === 'anime' && video.type !== 'anime') {
      const jobData: EnrichJobData = {
        videoId: id,
        catalogId: video.catalog_id,
        title: input.title !== undefined ? String(input.title) : video.title,
        year: input.year !== undefined ? (input.year as number | null) : video.year,
        type: 'anime',
      }
      void enrichmentQueue
        .add(jobData, { delay: 300_000, jobId: `enrich-${id}` })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          process.stderr.write(`[VideoService] enqueue enrich (type→anime) failed for ${id}: ${msg}\n`)
        })
    }

    return {
      data: row ?? { id, updated_at: new Date().toISOString() },
      skippedFields,
    }
  }

  async publish(id: string, isPublished: boolean): Promise<unknown | null> {
    const row = await videoQueries.transitionVideoState(this.db, id, {
      action: isPublished ? 'publish' : 'unpublish',
    })
    if (row) void this.indexSync?.syncVideo(id)
    return row
  }

  async updateVisibility(
    id: string,
    visibility: VisibilityStatus,
    /** CHG-SN-4-10-A2：actor + request 用于 audit log；optional 兼容旧调用方（非 admin 路径不写 audit） */
    audit?: { actorId: string; requestId?: string },
  ): Promise<{ id: string; visibility_status: string; is_published: boolean } | null> {
    const action = visibility === 'public'
      ? 'publish'
      : visibility === 'internal'
        ? 'set_internal'
        : 'set_hidden'
    const row = await videoQueries.transitionVideoState(this.db, id, { action })
    if (row) {
      void this.indexSync?.syncVideo(id)
      // CHG-SN-4-10-A2：admin 显式调用时写入 audit log（video.visibility_patch）
      if (audit) {
        this.auditSvc.write({
          actorId: audit.actorId,
          actionType: 'video.visibility_patch',
          targetKind: 'video',
          targetId: id,
          afterJsonb: { visibility },
          requestId: audit.requestId,
        })
      }
    }
    return row
  }

  async review(
    id: string,
    input: { action: videoQueries.ReviewAction; reason?: string; reviewedBy: string }
  ): Promise<{
    id: string; review_status: string; visibility_status: string; is_published: boolean
  } | null> {
    const action: videoQueries.VideoStateTransitionAction =
      input.action === 'approve_and_publish' ? 'approve_and_publish'
      : input.action === 'approve' ? 'approve'
      : 'reject'
    const row = await videoQueries.transitionVideoState(this.db, id, {
      action,
      reviewedBy: input.reviewedBy,
      reason: input.reason,
    })
    if (row) void this.indexSync?.syncVideo(id)
    return row
  }

  async transitionState(
    id: string,
    input: {
      action: videoQueries.VideoStateTransitionAction
      reviewedBy?: string
      reason?: string
      expectedUpdatedAt?: string
    },
  ): Promise<{
    id: string
    review_status: string
    visibility_status: string
    is_published: boolean
    updated_at: string
  } | null> {
    const row = await videoQueries.transitionVideoState(this.db, id, input)
    if (row) void this.indexSync?.syncVideo(id)
    return row
  }

  async batchPublish(ids: string[], isPublished: boolean): Promise<number> {
    let count = 0
    for (const id of ids) {
      const row = await videoQueries.transitionVideoState(this.db, id, {
        action: isPublished ? 'publish' : 'unpublish',
      })
      if (row) {
        count += 1
        void this.indexSync?.syncVideo(id)
      }
    }
    return count
  }

  async batchUnpublish(ids: string[]): Promise<number> {
    const count = await videoQueries.batchUnpublishVideos(this.db, ids)
    if (count > 0) ids.forEach((id) => void this.indexSync?.syncVideo(id))
    return count
  }

  // ── 审核台（CHG-220）────────────────────────────────────────────

  async moderationStats(): Promise<ModerationStats> {
    return videoQueries.getModerationStats(this.db)
  }

  async pendingReviewList(params: {
    page: number
    limit: number
    type?: string
    sortDir?: 'asc' | 'desc'
    q?: string
    siteKey?: string
    sourceState?: 'all' | 'active' | 'missing'
    includeAdult?: boolean
    doubanStatus?: import('@/types').DoubanStatus
    sourceCheckStatus?: import('@/types').SourceCheckStatus
  }): Promise<{ data: PendingReviewVideoRow[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page)
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit))
    const { rows, total } = await videoQueries.listPendingReviewVideos(this.db, {
      page,
      limit,
      type: params.type,
      sortDir: params.sortDir,
      q: params.q,
      siteKey: params.siteKey,
      sourceState: params.sourceState,
      includeAdult: params.includeAdult,
      doubanStatus: params.doubanStatus,
      sourceCheckStatus: params.sourceCheckStatus,
    })
    return { data: rows, total, page, limit }
  }

  // ── Home 首页原子方法 ──────────────────────────────────────────

  /** 按 rating DESC 取 VideoCard（首页 top10 fallback 补位专用） */
  async listByRatingDesc(limit: number, excludeIds: string[] = []): Promise<VideoCard[]> {
    return videoQueries.listVideosByRatingDesc(this.db, limit, excludeIds)
  }

  /**
   * 各类型视频数量（含全部 11 种 VideoType，无数据的类型返回 count=0）
   * Redis 缓存 TTL 300s；未配置 Redis 时降级为直接查询
   */
  async countByType(): Promise<CountByTypeItem[]> {
    const cacheKey = `${CACHE_PREFIXES.home}count-by-type`

    if (this.redis) {
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached) as CountByTypeItem[]
      }
    }

    const result = await videoQueries.countVideosByType(this.db)

    if (this.redis) {
      await this.redis.setex(cacheKey, COUNT_BY_TYPE_TTL, JSON.stringify(result))
    }

    return result
  }

}
