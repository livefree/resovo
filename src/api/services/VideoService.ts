/**
 * VideoService.ts — 视频业务逻辑
 * 所有查询通过 db/queries/videos.ts，不直接拼 SQL
 */

import type { Pool } from 'pg'
import type { Video, VideoCard, VideoType, Pagination } from '@/types'
import * as videoQueries from '@/api/db/queries/videos'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export class VideoService {
  constructor(private db: Pool) {}

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
}
