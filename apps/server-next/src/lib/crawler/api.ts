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
import type {
  CrawlerSite as CrawlerSiteFull,
  CategoryMappingRow,
  CategoryMappingInput,
} from '@resovo/types'

export type { CrawlerSiteFull as CrawlerSite }
export type { CategoryMappingRow, CategoryMappingInput }

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
  /** CHG-SN-6-20-B：全局采集冻结开关 */
  readonly freezeEnabled?: boolean
  /** CHG-SN-6-20-B：游离任务计数（无关联 run 的活跃 task） */
  readonly orphanTaskCount?: number
  /** CHG-SN-6-20-B：env CRAWLER_SCHEDULER_ENABLED */
  readonly schedulerEnabled?: boolean
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

// CHG-SN-6-20-B：全局采集冻结开关（audit 已在 -A 补齐）
export async function setCrawlerFreeze(enabled: boolean): Promise<CrawlerSystemStatus> {
  const res = await apiClient.post<{ data: CrawlerSystemStatus }>(
    '/admin/crawler/freeze',
    { enabled },
  )
  return res.data
}

// ── 自动调度配置（CHG-SN-6-27 / audit 已在 -25-RETRO 补齐）────────

export type AutoCrawlMode = 'incremental' | 'full'
export type AutoCrawlConflictPolicy = 'skip_running' | 'queue_after_running'

export interface AutoCrawlSiteOverride {
  readonly enabled: boolean
  readonly mode: 'inherit' | AutoCrawlMode
}

export interface AutoCrawlConfig {
  readonly globalEnabled: boolean
  readonly scheduleType: 'daily'
  readonly dailyTime: string
  readonly defaultMode: AutoCrawlMode
  readonly onlyEnabledSites: boolean
  readonly conflictPolicy: AutoCrawlConflictPolicy
  readonly perSiteOverrides: Record<string, AutoCrawlSiteOverride>
}

export async function getAutoCrawlConfig(): Promise<AutoCrawlConfig> {
  const res = await apiClient.get<{ data: AutoCrawlConfig }>('/admin/crawler/auto-config')
  return res.data
}

export async function setAutoCrawlConfig(config: AutoCrawlConfig): Promise<void> {
  await apiClient.post('/admin/crawler/auto-config', config)
}

// ── 全局止血（stop-all / audit 已在 -25-RETRO 补齐）───────────────

export interface StopAllOptions {
  readonly freeze?: boolean
  readonly removeRepeatableTick?: boolean
}

export interface StopAllResult {
  readonly freezeEnabled: boolean
  readonly markedRuns: number
  readonly pendingCancelled?: number
  readonly runningSignaled?: number
}

export async function stopAllCrawler(opts: StopAllOptions = {}): Promise<StopAllResult> {
  const res = await apiClient.post<{ data: StopAllResult }>(
    '/admin/crawler/stop-all',
    { freeze: opts.freeze ?? true, removeRepeatableTick: opts.removeRepeatableTick ?? true },
  )
  return res.data
}

// ── reindex（ES 重建索引 / audit 已在 -26-RETRO 补齐）─────────────

export interface ReindexResult {
  readonly indexed?: number
  readonly duration_ms?: number
  readonly [key: string]: unknown
}

export async function triggerReindex(): Promise<ReindexResult> {
  const res = await apiClient.post<{ data: ReindexResult }>('/admin/crawler/reindex', {})
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

// ── Run Detail + tasks 子表（CHG-SN-6-17）─────────────────────────

export type CrawlerTaskStatus =
  | 'queued' | 'running' | 'paused' | 'success' | 'failed' | 'cancelled' | 'timeout'

export interface CrawlerTaskDto {
  readonly id: string
  readonly siteKey: string
  readonly mode: 'incremental' | 'full'
  readonly status: CrawlerTaskStatus
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly message: string | null
  readonly itemCount: number | null
}

export interface ListRunTasksParams {
  readonly page?: number
  readonly limit?: number
}

export interface ListRunTasksResult {
  readonly data: readonly CrawlerTaskDto[]
  readonly pagination: { readonly total: number; readonly page: number; readonly limit: number; readonly hasNext: boolean }
}

export async function getCrawlerRunById(id: string): Promise<CrawlerRun> {
  const res = await apiClient.get<{ data: CrawlerRun }>(
    `/admin/crawler/runs/${encodeURIComponent(id)}`,
  )
  return res.data
}

export async function listCrawlerRunTasks(
  id: string,
  params: ListRunTasksParams = {},
): Promise<ListRunTasksResult> {
  const qs = new URLSearchParams()
  if (params.page != null) qs.set('page', String(params.page))
  if (params.limit != null) qs.set('limit', String(params.limit))
  const q = qs.toString()
  return apiClient.get<ListRunTasksResult>(
    `/admin/crawler/runs/${encodeURIComponent(id)}/tasks${q ? `?${q}` : ''}`,
  )
}

// ── Task Detail + Logs（CHG-SN-6-18）─────────────────────────────

export interface CrawlerSiteBreakdown {
  readonly siteKey: string
  readonly videosUpserted: number
  readonly sourcesUpserted: number
  readonly sourcesKept: number
  readonly sourcesRemoved: number
  readonly errors: number
}

export interface CrawlerTaskRunContext {
  readonly crawlMode: string
  readonly keyword: string | null
  readonly targetVideoId: string | null
}

export interface CrawlerTaskDetailDto extends CrawlerTaskDto {
  readonly siteBreakdown: CrawlerSiteBreakdown
  readonly runContext: CrawlerTaskRunContext | null
}

export type CrawlerTaskLogLevel = 'info' | 'warn' | 'error'

export interface CrawlerTaskLog {
  readonly id: string
  readonly taskId: string | null
  readonly sourceSite: string | null
  readonly level: CrawlerTaskLogLevel
  readonly stage: string
  readonly message: string
  readonly details: Record<string, unknown> | null
  readonly createdAt: string
}

export async function getCrawlerTaskDetail(id: string): Promise<CrawlerTaskDetailDto> {
  const res = await apiClient.get<{ data: CrawlerTaskDetailDto }>(
    `/admin/crawler/tasks/${encodeURIComponent(id)}`,
  )
  return res.data
}

export async function listCrawlerTaskLogs(
  id: string,
  params: { limit?: number } = {},
): Promise<readonly CrawlerTaskLog[]> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  const q = qs.toString()
  const res = await apiClient.get<{ data: { logs: readonly CrawlerTaskLog[] } }>(
    `/admin/crawler/tasks/${encodeURIComponent(id)}/logs${q ? `?${q}` : ''}`,
  )
  return res.data.logs
}

// ── CHG-SN-7-REDO-01-B / ADR-122: Crawler 重做 4 新端点 ────────

export interface CrawlerSiteStat {
  readonly key: string
  readonly routeCount: number
  readonly health: number
}

export interface CrawlerKpiResponse {
  readonly totalSites: number
  readonly healthySites: number
  readonly runningSites: number
  readonly failedSites: number
  readonly batchVideoCount: number
  readonly batchVideoDelta: number
  readonly avgDurationSeconds: number
  readonly siteStats: readonly CrawlerSiteStat[]
}

export type CrawlerTimelineRange = '30m' | '1h' | '2h' | '6h'

export interface CrawlerTimelineRow {
  readonly siteKey: string
  readonly siteName: string
  readonly health: number
  readonly startPct: number
  readonly widthPct: number
  readonly durationSeconds: number
  readonly videoCount: number
  readonly status: 'ok' | 'warn' | 'danger'
  readonly last: string
}

export interface CrawlerTimelineResponse {
  readonly rangeStart: string
  readonly rangeEnd: string
  readonly ticks: readonly string[]
  readonly rows: readonly CrawlerTimelineRow[]
}

export interface CrawlerRunCreateResult {
  readonly runId: string
  readonly taskIds: readonly string[]
  readonly enqueuedSiteKeys: readonly string[]
  readonly skippedSiteKeys: readonly string[]
}

export type CrawlerRunMode = 'incremental' | 'full'

export async function getCrawlerKpi(): Promise<CrawlerKpiResponse> {
  const res = await apiClient.get<{ data: CrawlerKpiResponse }>('/admin/crawler/kpi')
  return res.data
}

export async function getCrawlerTimeline(
  params: { range?: CrawlerTimelineRange; limit?: number } = {},
): Promise<CrawlerTimelineResponse> {
  const qs = new URLSearchParams()
  if (params.range) qs.set('range', params.range)
  if (params.limit != null) qs.set('limit', String(params.limit))
  const q = qs.toString()
  const res = await apiClient.get<{ data: CrawlerTimelineResponse }>(
    `/admin/crawler/timeline${q ? `?${q}` : ''}`,
  )
  return res.data
}

export async function runCrawlerSite(
  siteKey: string,
  mode: CrawlerRunMode = 'incremental',
): Promise<CrawlerRunCreateResult> {
  const res = await apiClient.post<{ data: CrawlerRunCreateResult }>(
    `/admin/crawler/sites/${encodeURIComponent(siteKey)}/run`,
    { mode },
  )
  return res.data
}

export async function runCrawlerAll(
  mode: CrawlerRunMode = 'full',
): Promise<CrawlerRunCreateResult> {
  const res = await apiClient.post<{ data: CrawlerRunCreateResult }>(
    '/admin/crawler/run-all',
    { mode },
  )
  return res.data
}

// ── ADR-123 / CHG-SN-7-REDO-01-F：站点分类映射 GET / PUT ──────────

export async function getCrawlerSiteCategoryMapping(siteKey: string): Promise<CategoryMappingRow[]> {
  const res = await apiClient.get<{ data: CategoryMappingRow[] }>(
    `/admin/crawler/sites/${encodeURIComponent(siteKey)}/category-mapping`,
  )
  return res.data
}

export async function putCrawlerSiteCategoryMapping(
  siteKey: string,
  mappings: readonly CategoryMappingInput[],
): Promise<{ written: number }> {
  const res = await apiClient.put<{ data: { written: number } }>(
    `/admin/crawler/sites/${encodeURIComponent(siteKey)}/category-mapping`,
    { mappings },
  )
  return res.data
}
