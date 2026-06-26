// VideoPlayAnalyticsService.ts — 后台视频播放分析只读读模型服务（ADR-217 / SEQ-20260624-02 STATS-07-A）
//
// 编排 GET /admin/analytics/video-plays/{overview,trend,top-videos} 业务：period→天数窗口、
//   调 videoPlayStats analytics query（唯一源 video_play_daily）、原始聚合行 → DTO 映射。
// route 不含业务逻辑、零内联 SQL（D-217-9）；本服务唯一数据出入口为 videoPlayStats query（不查 users）。
// BIGINT/NUMERIC ::text → 裸 Number()（沿用现网 analytics mapRow 范式，无 MAX_SAFE_INTEGER 断言，D-217-7）。

import type { Pool } from 'pg'
import {
  getVideoPlaysOverview,
  getVideoPlaysTrend,
  getTopVideosByPlays,
} from '@/api/db/queries/videoPlayStats'
import type {
  VideoPlaysPeriod,
  VideoPlaysOverview,
  VideoPlaysTrendPoint,
  VideoPlaysTopVideo,
} from '@/types'

/** period 枚举 → 近 N 自然日窗口天数（D-217-2；无 today、最小 7d）。 */
const PERIOD_DAYS: Record<VideoPlaysPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

export class VideoPlayAnalyticsService {
  constructor(private db: Pool) {}

  /** overview：period 窗口全站汇总 + avg 除零保护 + period 回显（D-217-4）。 */
  async getOverview(period: VideoPlaysPeriod): Promise<VideoPlaysOverview> {
    const row = await getVideoPlaysOverview(this.db, PERIOD_DAYS[period])
    const totalPlays = Number(row.total_plays)
    const totalWatchSeconds = Number(row.total_watch_seconds)
    return {
      period,
      totalPlays,
      totalWatchSeconds,
      // 除零保护：无播放返回 0（非 null/NaN，D-217-4）
      avgWatchSeconds: totalPlays > 0 ? totalWatchSeconds / totalPlays : 0,
      anonPlays: Number(row.anon_plays),
      loggedInPlays: Number(row.logged_in_plays),
    }
  }

  /** trend：恰好 N 个有序日点（zero-fill），date 严格 YYYY-MM-DD（D-217-5）。 */
  async getTrend(period: VideoPlaysPeriod): Promise<VideoPlaysTrendPoint[]> {
    const rows = await getVideoPlaysTrend(this.db, PERIOD_DAYS[period])
    return rows.map((r) => ({
      date: r.date,
      plays: Number(r.plays),
      watchSeconds: Number(r.watch_seconds),
      anonPlays: Number(r.anon_plays),
      loggedInPlays: Number(r.logged_in_plays),
    }))
  }

  /** top-videos：period 内按 SUM(play_count) 前 limit（存活视频，确定性 tie-break，D-217-6）。 */
  async getTopVideos(period: VideoPlaysPeriod, limit: number): Promise<VideoPlaysTopVideo[]> {
    const rows = await getTopVideosByPlays(this.db, PERIOD_DAYS[period], limit)
    return rows.map((r) => ({
      shortId: r.short_id,
      title: r.title,
      plays: Number(r.plays),
      watchSeconds: Number(r.watch_seconds),
    }))
  }
}
