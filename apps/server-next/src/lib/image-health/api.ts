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
  // brokenTrend 字段对齐后端 getBrokenEventsTrend 实返（imageHealth.scan.ts:43 push({ date, count })）；
  // SQL 内部别名 AS day 不出现在返回值，全链无转换层（IMGH-P1-1 修正：原误标 day → date）
  readonly brokenTrend?: ReadonlyArray<{ readonly date: string; readonly count: number }>
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
  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单扩 4 子查询派生字段
  readonly sortField?:
    | 'created_at' | 'title' | 'poster_status'
    | 'poster_source' | 'broken_domain' | 'occurrence_count' | 'last_seen_broken_at'
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

export type RescanScope = 'all' | 'broken_only' | 'missing_only'

export interface RescanResult {
  readonly updatedCount: number
  readonly enqueued: boolean
  readonly scope: RescanScope
}

export interface SwitchDomainResult {
  readonly dryRun: boolean
  readonly affectedRows: number
  readonly affectedColumns: number
  readonly breakdown: {
    readonly cover_url: number
    readonly backdrop_url: number
    readonly banner_backdrop_url: number
  }
}

// ADR-208 D-208-2：补图候选（跨源 metadata_field_proposals）
export type ImageCandidateField = 'coverUrl' | 'backdropUrl' | 'logoUrl'

export interface ImageCandidate {
  readonly source: string
  readonly sourceRef: string | null
  readonly url: string
  readonly confidence: number | null
  /** reconcile 逻辑 winner（ADR-205 D-205-4）；UI 高置信 🟢 信号 */
  readonly isWinner: boolean
  /** 已经 safeUpdate 落 media_catalog */
  readonly applied: boolean
  /** 派生 CATALOG_SOURCE_PRIORITY[source]（后端算，UI 直接用、禁再硬编码） */
  readonly trust: number
}

export async function getImageHealthStats(): Promise<ImageHealthStats> {
  const result = await apiClient.get<{ data: ImageHealthStats }>('/admin/image-health/stats')
  return result.data
}

/** 读单 catalog 单字段的跨源补图候选（ADR-208 D-208-2）。无候选返空数组。 */
export async function listImageCandidates(
  catalogId: string,
  field: ImageCandidateField,
): Promise<readonly ImageCandidate[]> {
  const qs = new URLSearchParams({ catalogId, field })
  const result = await apiClient.get<{ data: { candidates: readonly ImageCandidate[] } }>(
    `/admin/image-health/candidates?${qs.toString()}`,
  )
  return result.data.candidates
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

export async function triggerImageRescan(scope: RescanScope = 'broken_only'): Promise<RescanResult> {
  const result = await apiClient.post<{ data: RescanResult }>('/admin/image-health/rescan', { scope })
  return result.data
}

export async function switchImageFallbackDomain(
  fromDomain: string,
  toDomain: string,
  dryRun: boolean,
): Promise<SwitchDomainResult> {
  const result = await apiClient.post<{ data: SwitchDomainResult }>(
    '/admin/image-health/switch-fallback-domain',
    { fromDomain, toDomain, dryRun },
  )
  return result.data
}
