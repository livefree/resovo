/**
 * SourceService.ts — 播放源业务逻辑
 * ADR-001: 只返回 source_url 直链，不做任何代理或转发
 */

import type { Pool } from 'pg'
import type { VideoSource } from '@/types'
import * as sourceQueries from '@/api/db/queries/sources'
import * as videoQueries from '@/api/db/queries/videos'

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND'
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class SourceService {
  constructor(private db: Pool) {}

  /**
   * 获取视频播放源列表
   * ADR-001: 返回直链，不做代理
   */
  async listSources(videoShortId: string, episode?: number): Promise<VideoSource[]> {
    // 先确认视频存在且已发布
    const video = await videoQueries.findVideoByShortId(this.db, videoShortId)
    if (!video) throw new NotFoundError('视频不存在')

    return sourceQueries.findActiveSourcesByVideoId(this.db, video.id, episode)
  }
}
