/**
 * crawler/api.ts — /admin/crawler 视图 API 客户端（CHG-SN-6-13 MVP 扩展）
 *
 * 端点（v1 CHG-34 / allowlist 豁免）：
 *   GET    /admin/crawler/sites             — 列表
 *   POST   /admin/crawler/sites             — 新增
 *   PATCH  /admin/crawler/sites/:key        — 更新
 *   DELETE /admin/crawler/sites/:key        — 删除（fromConfig=true 不可删）
 *   POST   /admin/crawler/sites/batch       — 批量操作
 *   POST   /admin/crawler/sites/validate    — 验证 API 可达性
 *   GET    /admin/crawler/system-status     — 调度器 + 队列状态
 */

import { apiClient } from '@/lib/api-client'
import type { CrawlerSite as CrawlerSiteFull } from '@resovo/types'

export type { CrawlerSiteFull as CrawlerSite }

export type CrawlerSourceType = 'vod' | 'shortdrama'
export type CrawlerSiteFormat = 'json' | 'xml'

export interface CreateCrawlerSiteInput {
  readonly key: string
  readonly name: string
  readonly apiUrl: string
  readonly detail?: string
  readonly sourceType?: CrawlerSourceType
  readonly format?: CrawlerSiteFormat
  readonly weight?: number
  readonly isAdult?: boolean
}

export interface UpdateCrawlerSiteInput {
  readonly name?: string
  readonly apiUrl?: string
  readonly detail?: string
  readonly sourceType?: CrawlerSourceType
  readonly format?: CrawlerSiteFormat
  readonly weight?: number
  readonly isAdult?: boolean
  readonly disabled?: boolean
  readonly allowAutoPublish?: boolean
}

export type CrawlerSiteBatchAction =
  | 'enable' | 'disable' | 'delete'
  | 'mark_adult' | 'unmark_adult'
  | 'mark_shortdrama' | 'mark_vod'

export interface BatchResult { readonly affected: number }
export interface ValidateApiResult {
  readonly ok: boolean
  readonly statusCode?: number
  readonly message?: string
}
export interface CrawlerSystemStatus {
  readonly enabled?: boolean
  readonly schedulers?: ReadonlyArray<{ readonly name: string; readonly enabled: boolean; readonly intervalMs: number }>
  readonly [key: string]: unknown
}

export async function listCrawlerSites(): Promise<readonly CrawlerSiteFull[]> {
  const res = await apiClient.get<{ data: readonly CrawlerSiteFull[] }>('/admin/crawler/sites')
  return res.data
}

export async function createCrawlerSite(input: CreateCrawlerSiteInput): Promise<CrawlerSiteFull> {
  const res = await apiClient.post<{ data: CrawlerSiteFull }>('/admin/crawler/sites', input)
  return res.data
}

export async function updateCrawlerSite(key: string, input: UpdateCrawlerSiteInput): Promise<CrawlerSiteFull> {
  const res = await apiClient.patch<{ data: CrawlerSiteFull }>(
    `/admin/crawler/sites/${encodeURIComponent(key)}`, input,
  )
  return res.data
}

export async function deleteCrawlerSite(key: string): Promise<void> {
  await apiClient.delete(`/admin/crawler/sites/${encodeURIComponent(key)}`)
}

export async function batchCrawlerSites(
  keys: readonly string[],
  action: CrawlerSiteBatchAction,
): Promise<BatchResult> {
  const res = await apiClient.post<{ data: BatchResult }>('/admin/crawler/sites/batch', { keys, action })
  return res.data
}

export async function validateCrawlerSite(apiUrl: string): Promise<ValidateApiResult> {
  const res = await apiClient.post<{ data: ValidateApiResult }>('/admin/crawler/sites/validate', { apiUrl })
  return res.data
}

export async function getCrawlerSystemStatus(): Promise<CrawlerSystemStatus> {
  const res = await apiClient.get<{ data: CrawlerSystemStatus }>('/admin/crawler/system-status')
  return res.data
}

// ── Runs（批次列表 / CHG-SN-6-15） ────────────────────────────────

export type CrawlerRunStatus =
  | 'queued' | 'running' | 'paused' | 'success' | 'partial_failed' | 'failed' | 'cancelled'
export type CrawlerRunTriggerType = 'single' | 'batch' | 'all' | 'schedule'

export interface CrawlerRun {
  readonly id: string
  readonly triggerType: CrawlerRunTriggerType
  readonly mode: string
  readonly status: CrawlerRunStatus
  readonly controlStatus: string
  readonly requestedSiteCount: number
  readonly enqueuedSiteCount: number
  readonly skippedSiteCount: number
  readonly timeoutSeconds: number
  readonly createdBy: string | null
  readonly scheduleId: string | null
  readonly summary: Record<string, unknown> | null
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly crawlMode: string
  readonly keyword: string | null
  readonly targetVideoId: string | null
}

export interface ListCrawlerRunsParams {
  readonly status?: CrawlerRunStatus
  readonly triggerType?: CrawlerRunTriggerType
  readonly page?: number
  readonly limit?: number
}

export interface ListCrawlerRunsResult {
  readonly data: readonly CrawlerRun[]
  readonly pagination: { readonly total: number; readonly page: number; readonly limit: number; readonly hasNext: boolean }
}

export async function listCrawlerRuns(params: ListCrawlerRunsParams = {}): Promise<ListCrawlerRunsResult> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.triggerType) qs.set('triggerType', params.triggerType)
  if (params.page != null) qs.set('page', String(params.page))
  if (params.limit != null) qs.set('limit', String(params.limit))
  const q = qs.toString()
  return apiClient.get<ListCrawlerRunsResult>(`/admin/crawler/runs${q ? `?${q}` : ''}`)
}

// ── Runs 行操作（CHG-SN-6-16-B / audit 已通过 -A 补齐写入位点）───────────

export interface CancelRunResult {
  readonly run: CrawlerRun | null
  readonly cancelledPending: number
  readonly signaledRunning: number
}

export interface PauseResumeResult {
  readonly runId: string
  readonly controlStatus: string
}

export async function cancelCrawlerRun(id: string): Promise<CancelRunResult> {
  const res = await apiClient.post<{ data: CancelRunResult }>(
    `/admin/crawler/runs/${encodeURIComponent(id)}/cancel`,
    {},
  )
  return res.data
}

export async function pauseCrawlerRun(id: string): Promise<PauseResumeResult> {
  const res = await apiClient.post<{ data: PauseResumeResult }>(
    `/admin/crawler/runs/${encodeURIComponent(id)}/pause`,
    {},
  )
  return res.data
}

export async function resumeCrawlerRun(id: string): Promise<PauseResumeResult> {
  const res = await apiClient.post<{ data: PauseResumeResult }>(
    `/admin/crawler/runs/${encodeURIComponent(id)}/resume`,
    {},
  )
  return res.data
}
