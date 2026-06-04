/**
 * SplitSuggestionsService.ts — 拆分自动分组建议编排（ADR-105 AMENDMENT 2026-06-03 D-105-1 / CHG-VIR-11-B）
 *
 * GET /admin/videos/:id/split-suggestions 业务层：实时只读计算零持久化（R-105-S1）。
 * 线路真源 = getVideoMatrix（与拆分工作台同一函数，R-105-S9 键逐字一致的结构性保证）；
 * facet 信号源 = title_observations site 级聚合；外部 ID 冲突 = 双源 UNION（Y-105a-4 口径）。
 * 算法在 services/identity/splitSuggestions.ts 纯函数（可独立单测）。
 *
 * 独立于 VideoMergesService（后者 pre-existing 超 file-size budget，不再膨胀）。
 */

import type { Pool } from 'pg'
import type { SplitSuggestionsResult, VideoType } from '@resovo/types'
import { getVideoMatrix } from '@/api/db/queries/video-matrix'
import { listObservationsByVideoId } from '@/api/db/queries/titleObservations'
import { listExternalIdConflictProviders } from '@/api/db/queries/split-suggestions'
import { fetchVideosByIds } from '@/api/db/queries/video-merge-mutations'
import { buildSplitSuggestions } from './identity/splitSuggestions'
import { AppError } from '@/api/lib/errors'

export class SplitSuggestionsService {
  constructor(private db: Pool) {}

  async getSuggestions(videoId: string): Promise<SplitSuggestionsResult> {
    // 校验语义与 split 端点一致（404 不存在 / 409 已被合并软删）
    const videos = await fetchVideosByIds(this.db, [videoId])
    const video = videos[0]
    if (!video) {
      throw new AppError('NOT_FOUND', `video ${videoId} 不存在`, 404)
    }
    if (video.deleted_at !== null) {
      throw new AppError('STATE_CONFLICT', '该视频已被合并，请先 unmerge 后再查看拆分建议', 409)
    }

    const [lines, observations, externalIdConflictProviders] = await Promise.all([
      getVideoMatrix(this.db, videoId),
      listObservationsByVideoId(this.db, videoId),
      listExternalIdConflictProviders(this.db, videoId),
    ])

    return buildSplitSuggestions({
      videoId,
      videoType: video.type as VideoType,
      lines,
      observations,
      externalIdConflictProviders,
    })
  }
}
