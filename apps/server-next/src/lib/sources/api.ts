/**
 * sources/api.ts — /admin/sources 视图 API 客户端封装（CHG-SN-5-11）
 */

import { apiClient } from '@/lib/api-client'
import type { DualSignalDisplayState, SourceHealthEvent } from '@resovo/types'
import type {
  VideoGroupListResult,
  VideoGroupListParams,
  VideoGroupStats,
  LineMatrixRow,
  SourceLineAlias,
  SourceLineRow,
  SourceRouteBySite,
  SourceLineRowData,
} from './types'

/**
 * HOTFIX-PATCH-2B（2026-05-25）：DataTable distinctFetcher 实现 / ADR-150 EP-2 通用 distinct 端点首次消费
 *
 * 调 GET /admin/_dt/distinct?table=X&col=Y&q=Z&limit=50 → DistinctOption[]
 * sources 表白名单 3 列：site_key / probe_status / render_status（distinct-whitelist.ts）
 *
 * HOTFIX-PATCH-2B follow-up（2026-05-25）：signal 透传 fetch RequestInit（防 search 快速切换 stale）
 * Opus PATCH-2B 评审 D6 预批准 / DataTableAutoFilter useEffect AbortController 创建 + cleanup abort
 */
export async function fetchDistinct(
  table: string,
  field: string,
  q?: string,
  signal?: AbortSignal,
): Promise<readonly { readonly value: string; readonly label?: string; readonly count?: number }[]> {
  const qs = new URLSearchParams({ table, col: field, limit: '50' })
  if (q) qs.set('q', q)
  const result = await apiClient.get<{ data: readonly { readonly value: string; readonly label?: string; readonly count?: number }[] }>(
    `/admin/_dt/distinct?${qs.toString()}`,
    signal ? { signal } : undefined,
  )
  return result.data
}

export async function listVideoGroups(params: VideoGroupListParams = {}): Promise<VideoGroupListResult> {
  const qs = new URLSearchParams()
  if (params.page != null)    qs.set('page', String(params.page))
  if (params.limit != null)   qs.set('limit', String(params.limit))
  if (params.keyword)         qs.set('keyword', params.keyword)
  // HOTFIX-PATCH-2B（2026-05-25）：siteKey 数组 csv join（multi-select enum）
  if (params.siteKey && params.siteKey.length > 0)  qs.set('siteKey', params.siteKey.join(','))
  // CHG-VSR-5-B：quickFilters KPI 卡快捷筛选 csv join（has_abnormal/needs_source/pending_probe/low_quality，不传 'all'）
  if (params.quickFilters && params.quickFilters.length > 0)  qs.set('quickFilters', params.quickFilters.join(','))
  // CHG-VSR-5-B：lowQuality 质量列 boolean（仅 true 发送 / 后端 queryBool z.enum 'true'-'false'）
  if (params.lowQuality === true)  qs.set('lowQuality', 'true')
  // HOTFIX-PATCH-2A §1-BUG-1（2026-05-25）：sortField / sortDir URL 透传（4df39524 漏改回填）
  if (params.sortField)       qs.set('sortField', params.sortField)
  if (params.sortDir)         qs.set('sortDir', params.sortDir)
  // HOTFIX-PATCH-2A §2-EXT（2026-05-25）：probeStatus + renderStatus 多选 csv join + updatedAt 日期范围
  if (params.probeStatus && params.probeStatus.length > 0)  qs.set('probeStatus', params.probeStatus.join(','))
  if (params.renderStatus && params.renderStatus.length > 0) qs.set('renderStatus', params.renderStatus.join(','))
  if (params.updatedAtFrom)   qs.set('updatedAtFrom', params.updatedAtFrom)
  if (params.updatedAtTo)     qs.set('updatedAtTo', params.updatedAtTo)
  // CHG-VSR-5-A：lastChecked 日期范围（最近检测列 date-range filter / CHG-VSR-3 后端 HAVING MAX(last_probed_at)）
  if (params.lastCheckedFrom) qs.set('lastCheckedFrom', params.lastCheckedFrom)
  if (params.lastCheckedTo)   qs.set('lastCheckedTo', params.lastCheckedTo)
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

/**
 * CHG-SN-9-LINES-VIEW-UNIFY（Wave 3 验收期补丁 / 2026-05-28）：全线路视图
 * 返回 video_sources 派生的所有 (siteKey, sourceName) 复合键，含 unassigned 行。
 * 管理面板用此 fetch 替代 listLineAliases / unassigned 行 UI 显示 "未分配别名"。
 */
export async function listAllSourceLines(): Promise<SourceLineRow[]> {
  const result = await apiClient.get<{ data: SourceLineRow[] }>('/admin/source-line-aliases/all')
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
 * CHG-368-B-B / ADR-164 §端点契约：扩字段 upsert（含 codename + priority）
 *   body 含 codename / priority 任一时走扩字段路径（后端双签名派发）
 */
export async function upsertLineAliasWithFields(
  siteKey: string,
  sourceName: string,
  input: { displayName: string; codename?: string | null; priority?: number },
): Promise<SourceLineAlias> {
  const result = await apiClient.put<{ data: SourceLineAlias }>(
    `/admin/source-line-aliases/${encodeURIComponent(siteKey)}/${encodeURIComponent(sourceName)}`,
    input,
  )
  return result.data
}

/**
 * CHG-368-B-B / ADR-164 §端点契约：手动退役别名（autoRetired=false）
 *   404：行不存在 / 409：已退役 / 200：成功
 */
export async function retireLineAlias(
  siteKey: string,
  sourceName: string,
  reason?: string,
): Promise<SourceLineAlias> {
  const result = await apiClient.post<{ data: SourceLineAlias }>(
    `/admin/source-line-aliases/${encodeURIComponent(siteKey)}/${encodeURIComponent(sourceName)}/retire`,
    reason ? { reason } : {},
  )
  return result.data
}

/**
 * CHG-368-B-B / ADR-164 §端点契约：单字段更新 priority（高频运营操作）
 *   404：行不存在 / 422：priority 越界 / 200：成功
 */
export async function updateLineAliasPriority(
  siteKey: string,
  sourceName: string,
  priority: number,
): Promise<SourceLineAlias> {
  const result = await apiClient.put<{ data: SourceLineAlias }>(
    `/admin/source-line-aliases/${encodeURIComponent(siteKey)}/${encodeURIComponent(sourceName)}/priority`,
    { priority },
  )
  return result.data
}

/**
 * CHG-368-B-B / ADR-164 §端点契约 + D-164-10：codename 字库可用性查询
 *   返回 { available, occupied, cooling } 三段（admin UI 下拉源数据）
 */
export async function getCodenamePool(): Promise<{
  readonly available: readonly string[]
  readonly occupied: readonly string[]
  readonly cooling: readonly string[]
}> {
  const result = await apiClient.get<{ data: { available: string[]; occupied: string[]; cooling: string[] } }>(
    '/admin/source-line-aliases/codename-pool',
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

// ════════════════════════════════════════════════════════════════════════════
// CHG-VSR-PRE-2（R1 方案 B）：视频级播放源操作（单一真源）
//
// 从 `lib/moderation/api` 移入，统一供 `useSourceLinesController` + 三消费方使用；
// `lib/moderation/api` re-export 这些符号保后兼容（blast radius 已核实：仅 LinesPanel 消费）。
// 端点不变（与原 moderation/api 逐一对齐），故无后端回归。
// ════════════════════════════════════════════════════════════════════════════

export interface LineHealthPage {
  readonly data: readonly SourceHealthEvent[]
  readonly pagination: {
    readonly total: number
    readonly page: number
    readonly limit: number
    readonly hasNext: boolean
  }
}

// ── 单源 inline 诊断结果（CHG-356 AMENDMENT：同步快探 + UPDATE DB）─────
export interface SingleSourceProbeResult {
  readonly sourceId: string
  readonly newProbeStatus: 'ok' | 'dead'
  readonly latencyMs: number | null
  readonly queued: false
}
export interface SingleSourceRenderCheckResult {
  readonly sourceId: string
  readonly newRenderStatus: 'ok' | 'dead'
  readonly queued: false
}

// ── 视频级 batch 探测/试播（CHG-357 / ADR-158 AMENDMENT 2）────────
export interface BatchProbeResultItem {
  readonly sourceId: string
  readonly newProbeStatus: 'ok' | 'dead'
  readonly latencyMs: number | null
  readonly error?: string
}
export interface BatchProbeResult {
  readonly videoId: string
  readonly results: ReadonlyArray<BatchProbeResultItem>
  readonly summary: { readonly total: number; readonly ok: number; readonly dead: number; readonly failed: number }
}
export interface BatchRenderCheckResultItem {
  readonly sourceId: string
  readonly newRenderStatus: 'ok' | 'dead'
  readonly error?: string
}
export interface BatchRenderCheckResult {
  readonly videoId: string
  readonly results: ReadonlyArray<BatchRenderCheckResultItem>
  readonly summary: { readonly total: number; readonly ok: number; readonly dead: number; readonly failed: number }
}

/**
 * 拉取视频全部播放源（含禁用源）。
 * 待校准点①：显式 `active=all`，确保禁用源行不丢（后端 `/admin/sources` 默认亦为 'all'）。
 *
 * CHG-VSR-6 FIX（Codex stop-time review）：后端 `/admin/sources` `limit` zod 上限 = 100
 * （content.ts `SourceListSchema`），单页仅取前 100 行 → 长剧集 × 多线路（源行 > 100）会
 * **静默截断**，与函数"全部"语义及 CHG-VSR-6"任意集数不截断"验收冲突。改为按 `total`
 * 分页循环拉全量（`limit` 维持后端 cap 100），三消费方（审核台 / 编辑抽屉 / 线路展开区）共享修复。
 */
export async function fetchVideoSources(videoId: string): Promise<SourceLineRowData[]> {
  const PAGE_SIZE = 100 // 后端 /admin/sources limit zod 上限（content.ts SourceListSchema）
  const all: SourceLineRowData[] = []
  let page = 1
  for (;;) {
    const params = new URLSearchParams({ videoId, active: 'all', limit: String(PAGE_SIZE), page: String(page) })
    const res = await apiClient.get<{ data: SourceLineRowData[]; total: number; page: number; limit: number }>(
      `/admin/sources?${params}`,
    )
    all.push(...res.data)
    // 终止：空页（防御 total 不一致/越界，避免死循环）或已收齐全集
    if (res.data.length === 0 || all.length >= res.total) break
    page += 1
  }
  return all
}

export async function toggleSource(
  videoId: string,
  sourceId: string,
  isActive: boolean,
  /** CHG-SN-5-PRE-01-C：行级乐观锁；不匹配抛 409 REVIEW_RACE。*/
  expectedUpdatedAt?: string,
): Promise<{ id: string; is_active: boolean; updated_at: string }> {
  const res = await apiClient.patch<{ data: { id: string; is_active: boolean; updated_at: string } }>(
    `/admin/videos/${videoId}/sources/${sourceId}`,
    { isActive, ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) },
  )
  return res.data
}

export async function disableDeadSources(videoId: string): Promise<{ disabled: number }> {
  const res = await apiClient.post<{ data: { disabled: number } }>(
    `/admin/videos/${videoId}/sources/disable-dead`,
    {},
  )
  return res.data
}

export async function refetchSources(videoId: string, siteKeys?: readonly string[]): Promise<void> {
  await apiClient.post<unknown>(
    `/admin/videos/${videoId}/refetch-sources`,
    siteKeys && siteKeys.length > 0 ? { siteKeys: [...siteKeys] } : {},
  )
}

export async function probeOneSource(sourceId: string): Promise<SingleSourceProbeResult> {
  const res = await apiClient.post<{ data: SingleSourceProbeResult }>(
    `/admin/sources/${encodeURIComponent(sourceId)}/probe`,
    {},
  )
  return res.data
}

export async function renderCheckOneSource(sourceId: string): Promise<SingleSourceRenderCheckResult> {
  const res = await apiClient.post<{ data: SingleSourceRenderCheckResult }>(
    `/admin/sources/${encodeURIComponent(sourceId)}/render-check`,
    {},
  )
  return res.data
}

export async function batchProbeVideo(videoId: string): Promise<BatchProbeResult> {
  const res = await apiClient.post<{ data: BatchProbeResult }>(
    `/admin/videos/${encodeURIComponent(videoId)}/sources/batch-probe`,
    {},
  )
  return res.data
}

export async function batchRenderCheckVideo(videoId: string): Promise<BatchRenderCheckResult> {
  const res = await apiClient.post<{ data: BatchRenderCheckResult }>(
    `/admin/videos/${encodeURIComponent(videoId)}/sources/batch-render-check`,
    {},
  )
  return res.data
}

export async function fetchLineHealth(
  videoId: string,
  sourceId: string,
  page = 1,
): Promise<LineHealthPage> {
  return apiClient.get<LineHealthPage>(
    `/admin/moderation/${videoId}/line-health/${sourceId}?page=${page}&limit=20`,
  )
}

export function toDisplayState(status: string): DualSignalDisplayState {
  if (status === 'ok' || status === 'partial' || status === 'dead' || status === 'pending') {
    return status
  }
  return 'unknown'
}
