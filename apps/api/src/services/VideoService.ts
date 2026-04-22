/**
 * VideoService.ts — 视频业务逻辑
 * 所有查询通过 db/queries/videos.ts，不直接拼 SQL
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
import type { Video, VideoCard, VideoType, VideoStatus, VisibilityStatus, Pagination } from '@/types'
import * as videoQueries from '@/api/db/queries/videos'
import type {
  UpdateVideoMetaInput,
  ModerationStats,
  PendingReviewVideoRow,
} from '@/api/db/queries/videos'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export class VideoService {
  private readonly indexSync?: VideoIndexSyncService

  constructor(
    private db: Pool,
    private es?: ESClient
  ) {
    if (es) {
      this.indexSync = new VideoIndexSyncService(db, es)
    }
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

  async findByShortId(shortId: string): Promise<Video | null> {
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
    q?: string
    siteKey?: string
    includeAdult?: boolean
    visibilityStatus?: import('@/types').VisibilityStatus
    reviewStatus?: import('@/types').ReviewStatus
    sortField?: string
    sortDir?: 'asc' | 'desc'
    page?: number
    limit?: number
  }): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page ?? 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT))

    const { rows, total } = await videoQueries.listAdminVideos(this.db, {
      status: params.status ?? 'all',
      type: params.type,
      q: params.q,
      siteKey: params.siteKey,
      includeAdult: params.includeAdult,
      visibilityStatus: params.visibilityStatus,
      reviewStatus: params.reviewStatus,
      sortField: params.sortField,
      sortDir: params.sortDir,
      page,
      limit,
    })

    return { data: rows, total, page, limit }
  }

  async adminFindById(id: string): Promise<unknown | null> {
    return videoQueries.findAdminVideoById(this.db, id)
  }

  async create(input: Record<string, unknown>): Promise<unknown> {
    // CHG-365 完成后，admin 流程改为先调用 MediaCatalogService.findOrCreate 获取 catalogId
    // 当前临时将 admin 输入转换为 CrawlerInsertInput 并走 insertCrawledVideo 的 catalog 自动创建路径
    const inserted = await videoQueries.insertCrawledVideo(this.db, {
      shortId: Math.random().toString(36).slice(2, 10),
      title: String(input.title ?? ''),
      type: (input.type as VideoType) ?? 'movie',
      sourceCategory: null,
      contentRating: 'general',
      episodeCount: (input.episodeCount as number) ?? 1,
      isPublished: false,
      reviewStatus: 'pending_review',
      visibilityStatus: 'internal',
      // @deprecated 临时字段，供 insertCrawledVideo 自动创建 catalog 条目
      titleNormalized: undefined,
      titleEn: input.titleEn as string | null,
      coverUrl: input.coverUrl as string | null,
      genre: Array.isArray(input.genres) && input.genres.length > 0 ? (input.genres as string[])[0] : null,
      year: input.year as number | null,
      country: input.country as string | null,
      cast: (input.cast as string[]) ?? [],
      director: (input.director as string[]) ?? [],
      writers: (input.writers as string[]) ?? [],
      description: input.description as string | null,
      status: (input.status as VideoStatus) ?? 'completed',
      metadataSource: 'manual',
    })
    void this.indexSync?.syncVideo(inserted.id as string)
    return inserted
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

    // Step 3: 更新 videos 表冗余副本字段（title/type/episodeCount/slug）
    const adaptedInput: UpdateVideoMetaInput = {
      ...(input.title !== undefined ? { title: String(input.title) } : {}),
      ...(input.type !== undefined ? { type: input.type as VideoType } : {}),
      ...(input.episodeCount !== undefined ? { episodeCount: input.episodeCount as number } : {}),
      ...(input.slug !== undefined ? { slug: input.slug as string | null } : {}),
    }
    const row = await videoQueries.updateVideoMeta(this.db, id, adaptedInput)
    if (row) void this.indexSync?.syncVideo(id)
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
    visibility: VisibilityStatus
  ): Promise<{ id: string; visibility_status: string; is_published: boolean } | null> {
    const action = visibility === 'public'
      ? 'publish'
      : visibility === 'internal'
        ? 'set_internal'
        : 'set_hidden'
    const row = await videoQueries.transitionVideoState(this.db, id, { action })
    if (row) void this.indexSync?.syncVideo(id)
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

}
