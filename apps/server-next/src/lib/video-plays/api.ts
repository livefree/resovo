/**
 * video-plays/api.ts — 后台视频播放分析数据层 API 客户端（ADR-217 / SEQ-20260624-02 STATS-07-B）
 *
 * 消费 STATS-07-A 落地的 daily-only 只读三视图端点：
 *   GET /v1/admin/analytics/video-plays/overview?period=7d|30d|90d
 *   GET /v1/admin/analytics/video-plays/trend?period=7d|30d|90d
 *   GET /v1/admin/analytics/video-plays/top-videos?period=7d|30d|90d&limit=20
 *
 * 范式仿 `lib/dashboard/api.ts`（apiClient + `{ data }` 信封解包）。
 * 共享 DTO 走 `@resovo/types`（server-next tsconfig `@/*`→`./src/*`，非 apps/api 的 `@/types` 语境）。
 */

import { apiClient } from '@/lib/api-client'
import type {
  VideoPlaysPeriod,
  VideoPlaysOverview,
  VideoPlaysTrendPoint,
  VideoPlaysTopVideo,
} from '@resovo/types'

export type { VideoPlaysPeriod, VideoPlaysOverview, VideoPlaysTrendPoint, VideoPlaysTopVideo }

export async function getVideoPlaysOverview(
  period: VideoPlaysPeriod = '7d',
): Promise<VideoPlaysOverview> {
  const res = await apiClient.get<{ data: VideoPlaysOverview }>(
    `/admin/analytics/video-plays/overview?period=${period}`,
  )
  return res.data
}

export async function getVideoPlaysTrend(
  period: VideoPlaysPeriod = '7d',
): Promise<readonly VideoPlaysTrendPoint[]> {
  const res = await apiClient.get<{ data: readonly VideoPlaysTrendPoint[] }>(
    `/admin/analytics/video-plays/trend?period=${period}`,
  )
  return res.data
}

export async function getTopVideos(
  period: VideoPlaysPeriod = '7d',
  limit = 20,
): Promise<readonly VideoPlaysTopVideo[]> {
  const res = await apiClient.get<{ data: readonly VideoPlaysTopVideo[] }>(
    `/admin/analytics/video-plays/top-videos?period=${period}&limit=${limit}`,
  )
  return res.data
}
