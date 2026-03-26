/**
 * VideoService.ts — 视频业务逻辑
 * 所有查询通过 db/queries/videos.ts，不直接拼 SQL
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
import type { Video, VideoCard, VideoType, VisibilityStatus, Pagination } from '@/types'
import * as videoQueries from '@/api/db/queries/videos'
import type { CreateVideoInput, UpdateVideoMetaInput } from '@/api/db/queries/videos'

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
      page,
      limit,
    })

    return { data: rows, total, page, limit }
  }

  async adminFindById(id: string): Promise<unknown | null> {
    return videoQueries.findAdminVideoById(this.db, id)
  }

  async create(input: CreateVideoInput): Promise<unknown> {
    const row = await videoQueries.createVideo(this.db, input)
    void this.indexToES(row.id)
    return row
  }

  async update(id: string, input: UpdateVideoMetaInput): Promise<unknown | null> {
    const row = await videoQueries.updateVideoMeta(this.db, id, input)
    if (row) void this.indexToES(id)
    return row
  }

  async publish(id: string, isPublished: boolean): Promise<unknown | null> {
    const row = await videoQueries.publishVideo(this.db, id, isPublished)
    if (row) void this.indexToES(id)
    return row
  }

  async updateVisibility(
    id: string,
    visibility: VisibilityStatus
  ): Promise<{ id: string; visibility_status: string; is_published: boolean } | null> {
    const row = await videoQueries.updateVisibility(this.db, id, visibility)
    if (row) void this.indexToES(id)
    return row
  }

  async review(
    id: string,
    input: { action: videoQueries.ReviewAction; reason?: string; reviewedBy: string }
  ): Promise<{
    id: string; review_status: string; visibility_status: string; is_published: boolean
  } | null> {
    const row = await videoQueries.reviewVideo(this.db, id, input)
    if (row) void this.indexToES(id)
    return row
  }

  async batchPublish(ids: string[], isPublished: boolean): Promise<number> {
    const count = await videoQueries.batchPublishVideos(this.db, ids, isPublished)
    if (count > 0) ids.forEach((id) => void this.indexToES(id))
    return count
  }

  async batchUnpublish(ids: string[]): Promise<number> {
    const count = await videoQueries.batchUnpublishVideos(this.db, ids)
    if (count > 0) ids.forEach((id) => void this.indexToES(id))
    return count
  }

  // ── ES 同步（异步，不阻塞响应）──────────────────────────────────

  private async indexToES(videoId: string): Promise<void> {
    if (!this.es) return
    try {
      const result = await this.db.query<{
        id: string; short_id: string; slug: string | null
        title: string; title_en: string | null; cover_url: string | null
        type: string; genre: string | null; year: number | null
        country: string | null; episode_count: number
        rating: number | null; status: string; is_published: boolean
        content_rating: string
        review_status: string; visibility_status: string
      }>(
        `SELECT id, short_id, slug, title, title_en, cover_url,
                type, genre, year, country, episode_count,
                rating, status, is_published, content_rating,
                review_status, visibility_status
         FROM videos WHERE id = $1`,
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
          title: row.title,
          title_en: row.title_en,
          cover_url: row.cover_url,
          type: row.type,
          genre: row.genre,
          year: row.year,
          country: row.country,
          episode_count: row.episode_count,
          rating: row.rating,
          status: row.status,
          is_published: row.is_published,
          content_rating: row.content_rating,
          review_status: row.review_status,
          visibility_status: row.visibility_status,
          updated_at: new Date().toISOString(),
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[VideoService] ES index failed for ${videoId}: ${message}\n`)
    }
  }
}
