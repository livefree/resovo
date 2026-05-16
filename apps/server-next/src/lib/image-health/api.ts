/**
 * image-health/api.ts — /admin/image-health 视图 API 客户端（CHG-SN-6-02）
 *
 * 复用既有 4 端点（apps/api/src/routes/admin/image-health.ts / IMG-05 / allowlist 豁免）：
 *   GET  /admin/image-health/stats
 *   GET  /admin/image-health/broken-domains
 *   GET  /admin/image-health/missing-videos
 *   POST /admin/image-health/backfill
 */

import { apiClient } from '@/lib/api-client'

export interface ImageHealthStats {
  readonly totalVideos: number
  readonly posterOkCount: number
  readonly posterCoverage: number      // 0–1
  readonly backdropOkCount: number
  readonly backdropCoverage: number
  readonly brokenLast7Days: number
  readonly brokenTrend?: ReadonlyArray<{ readonly day: string; readonly count: number }>
}

export interface BrokenDomainRow {
  readonly domain: string
  readonly eventCount: number
  readonly affectedVideos: number
}

export interface MissingVideoRow {
  readonly videoId: string
  readonly title: string
  readonly posterStatus: 'missing' | 'broken' | 'pending_review' | string
  // CHG-SN-6-RETRO-3-B / ultrareview P2-7：列扩展
  readonly posterUrl: string | null
  readonly posterSource: string | null
  readonly lastSeenBrokenAt: string | null
  readonly brokenDomain: string | null
  readonly occurrenceCount: number
}

export interface ListMissingVideosParams {
  readonly page?: number
  readonly limit?: number
  readonly sortField?: 'created_at' | 'title' | 'poster_status'
  readonly sortDir?: 'asc' | 'desc'
}

export interface ListMissingVideosResult {
  readonly data: readonly MissingVideoRow[]
  readonly total: number
}

export interface BackfillResult {
  readonly enqueued: boolean
  readonly message: string
}

export async function getImageHealthStats(): Promise<ImageHealthStats> {
  const result = await apiClient.get<{ data: ImageHealthStats }>('/admin/image-health/stats')
  return result.data
}

export async function getTopBrokenDomains(limit = 20): Promise<readonly BrokenDomainRow[]> {
  const result = await apiClient.get<{ data: readonly BrokenDomainRow[] }>(
    `/admin/image-health/broken-domains?limit=${limit}`,
  )
  return result.data
}

export async function listMissingVideos(
  params: ListMissingVideosParams = {},
): Promise<ListMissingVideosResult> {
  const qs = new URLSearchParams()
  if (params.page != null)      qs.set('page', String(params.page))
  if (params.limit != null)     qs.set('limit', String(params.limit))
  if (params.sortField)         qs.set('sortField', params.sortField)
  if (params.sortDir)           qs.set('sortDir', params.sortDir)
  const q = qs.toString()
  return apiClient.get<ListMissingVideosResult>(
    `/admin/image-health/missing-videos${q ? `?${q}` : ''}`,
  )
}

export async function triggerImageBackfill(): Promise<BackfillResult> {
  const result = await apiClient.post<{ data: BackfillResult }>('/admin/image-health/backfill', {})
  return result.data
}
