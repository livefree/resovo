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

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export class VideoService {
  constructor(
    private db: Pool,
    private es?: ESClient
  ) {}

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
    void this.indexToES(inserted.id)
    return inserted
  }

  async update(id: string, input: Record<string, unknown>): Promise<unknown | null> {
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

    if (Object.keys(catalogFields).length > 0) {
      const catalogService = new MediaCatalogService(this.db)
      await catalogService.safeUpdate(video.catalog_id, catalogFields, 'manual')
    }

    // Step 3: 更新 videos 表冗余副本字段（title/type/episodeCount/slug）
    const adaptedInput: UpdateVideoMetaInput = {
      ...(input.title !== undefined ? { title: String(input.title) } : {}),
      ...(input.type !== undefined ? { type: input.type as VideoType } : {}),
      ...(input.episodeCount !== undefined ? { episodeCount: input.episodeCount as number } : {}),
      ...(input.slug !== undefined ? { slug: input.slug as string | null } : {}),
    }
    const row = await videoQueries.updateVideoMeta(this.db, id, adaptedInput)
    if (row) void this.indexToES(id)
    return row ?? { id, updated_at: new Date().toISOString() }
  }

  async publish(id: string, isPublished: boolean): Promise<unknown | null> {
    const row = await videoQueries.transitionVideoState(this.db, id, {
      action: isPublished ? 'publish' : 'unpublish',
    })
    if (row) void this.indexToES(id)
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
    if (row) void this.indexToES(id)
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
    if (row) void this.indexToES(id)
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
    if (row) void this.indexToES(id)
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
        void this.indexToES(id)
      }
    }
    return count
  }

  async batchUnpublish(ids: string[]): Promise<number> {
    const count = await videoQueries.batchUnpublishVideos(this.db, ids)
    if (count > 0) ids.forEach((id) => void this.indexToES(id))
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

  // ── ES 同步（异步，不阻塞响应）──────────────────────────────────

  private async indexToES(videoId: string): Promise<void> {
    if (!this.es) return
    try {
      const result = await this.db.query<{
        id: string; short_id: string; slug: string | null; catalog_id: string
        title: string; title_en: string | null; title_original: string | null
        cover_url: string | null; type: string; genres: string[]
        year: number | null; country: string | null; episode_count: number
        rating: number | null; status: string; is_published: boolean
        content_rating: string; review_status: string; visibility_status: string
        imdb_id: string | null; tmdb_id: number | null
      }>(
        `SELECT v.id, v.short_id, v.slug, v.title, v.type, v.episode_count,
                v.is_published, v.content_rating, v.review_status, v.visibility_status,
                v.catalog_id,
                mc.title_en, mc.title_original, mc.cover_url, mc.genres, mc.year,
                mc.country, mc.rating, mc.status, mc.imdb_id, mc.tmdb_id
         FROM videos v
         JOIN media_catalog mc ON mc.id = v.catalog_id
         WHERE v.id = $1`,
        [videoId]
      )
      if (!result.rows[0]) return

      const row = result.rows[0]
      await this.es.index({
        index: 'resovo_videos',
        id: row.id,
        document: {
          id: row.id,
          short_id: row.short_id,
          slug: row.slug,
          catalog_id: row.catalog_id,
          title: row.title,
          title_en: row.title_en,
          title_original: row.title_original,
          cover_url: row.cover_url,
          type: row.type,
          genres: row.genres ?? [],
          year: row.year,
          country: row.country,
          episode_count: row.episode_count,
          rating: row.rating,
          status: row.status,
          is_published: row.is_published,
          content_rating: row.content_rating,
          review_status: row.review_status,
          visibility_status: row.visibility_status,
          imdb_id: row.imdb_id,
          tmdb_id: row.tmdb_id,
          updated_at: new Date().toISOString(),
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[VideoService] ES index failed for ${videoId}: ${message}\n`)
    }
  }
}
