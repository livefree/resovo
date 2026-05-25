/**
 * sources/api.ts — /admin/sources 视图 API 客户端封装（CHG-SN-5-11）
 */

import { apiClient } from '@/lib/api-client'
import type {
  VideoGroupListResult,
  VideoGroupListParams,
  VideoGroupStats,
  LineMatrixRow,
  SourceLineAlias,
  SourceRouteBySite,
} from './types'

export async function listVideoGroups(params: VideoGroupListParams = {}): Promise<VideoGroupListResult> {
  const qs = new URLSearchParams()
  if (params.page != null)    qs.set('page', String(params.page))
  if (params.limit != null)   qs.set('limit', String(params.limit))
  if (params.keyword)         qs.set('keyword', params.keyword)
  if (params.segment)         qs.set('segment', params.segment)
  if (params.siteKey)         qs.set('siteKey', params.siteKey)
  // HOTFIX-PATCH-2A §1-BUG-1（2026-05-25）：sortField / sortDir URL 透传（4df39524 漏改回填）
  if (params.sortField)       qs.set('sortField', params.sortField)
  if (params.sortDir)         qs.set('sortDir', params.sortDir)
  // HOTFIX-PATCH-2A §2-EXT（2026-05-25）：probeStatus + renderStatus 多选 csv join + updatedAt 日期范围
  if (params.probeStatus && params.probeStatus.length > 0)  qs.set('probeStatus', params.probeStatus.join(','))
  if (params.renderStatus && params.renderStatus.length > 0) qs.set('renderStatus', params.renderStatus.join(','))
  if (params.updatedAtFrom)   qs.set('updatedAtFrom', params.updatedAtFrom)
  if (params.updatedAtTo)     qs.set('updatedAtTo', params.updatedAtTo)
  const q = qs.toString()
  return apiClient.get<VideoGroupListResult>(`/admin/sources/video-groups${q ? `?${q}` : ''}`)
}

export async function getVideoGroupStats(): Promise<VideoGroupStats> {
  const result = await apiClient.get<{ data: VideoGroupStats }>('/admin/sources/video-groups/stats')
  return result.data
}

export async function getVideoMatrix(videoId: string): Promise<LineMatrixRow[]> {
  const result = await apiClient.get<{ data: LineMatrixRow[] }>(`/admin/sources/video-groups/${videoId}/matrix`)
  return result.data
}

export async function listLineAliases(): Promise<SourceLineAlias[]> {
  const result = await apiClient.get<{ data: SourceLineAlias[] }>('/admin/source-line-aliases')
  return result.data
}

export async function upsertLineAlias(
  siteKey: string,
  sourceName: string,
  displayName: string,
): Promise<SourceLineAlias> {
  const result = await apiClient.put<{ data: SourceLineAlias }>(
    `/admin/source-line-aliases/${encodeURIComponent(siteKey)}/${encodeURIComponent(sourceName)}`,
    { displayName },
  )
  return result.data
}

/**
 * 按 siteKey 聚合查线路明细（ADR-117 AMENDMENT 2026-05-19 / CHG-SN-7-REDO-01-E）。
 * 由 crawler 模块 CrawlerSiteExpand 跨域消费 — 前端 fn 真源单一入口在 sources/api.ts。
 */
export async function listRoutesBySite(siteKey: string): Promise<SourceRouteBySite[]> {
  const result = await apiClient.get<{ data: SourceRouteBySite[] }>(
    `/admin/sources/routes/by-site/${encodeURIComponent(siteKey)}`,
  )
  return result.data
}

// ── ADR-117 AMENDMENT 2 2026-05-19 / CHG-SN-7-REDO-01-E2 ──────────
// 行级 3 mutations（admin only / freeze 守卫由后端兜底）

export interface RouteTestResult {
  readonly ok: boolean
  readonly latencyMs: number | null
  readonly sampleVideoId: string | null
  readonly probeJobId: string
}
export interface RouteReprobeResult {
  readonly probeJobId: string
  readonly queuedCount: number
}
export interface RouteDeleteResult {
  readonly deletedCount: number
}

function buildRoutePath(siteKey: string, sourceName: string): string {
  return `/admin/sources/routes/by-site/${encodeURIComponent(siteKey)}/${encodeURIComponent(sourceName)}`
}

export async function testRoute(siteKey: string, sourceName: string): Promise<RouteTestResult> {
  const result = await apiClient.post<{ data: RouteTestResult }>(`${buildRoutePath(siteKey, sourceName)}/test`, {})
  return result.data
}

export async function reprobeRoute(siteKey: string, sourceName: string): Promise<RouteReprobeResult> {
  const result = await apiClient.post<{ data: RouteReprobeResult }>(`${buildRoutePath(siteKey, sourceName)}/reprobe`, {})
  return result.data
}

export async function deleteRoute(siteKey: string, sourceName: string): Promise<RouteDeleteResult> {
  const result = await apiClient.delete<{ data: RouteDeleteResult }>(buildRoutePath(siteKey, sourceName))
  return result.data
}
