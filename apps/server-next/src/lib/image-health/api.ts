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

/**
 * 单口径（已发布 / 全部）4 类图片 ok 计数 + 视频分母（对齐后端 ImageCoverageScope）。
 * 覆盖率 = `<kind>Ok / videoCount`，由 KPI 卡片现算（不预存浮点）。
 */
export interface ImageCoverageScope {
  readonly videoCount: number
  readonly posterOk: number
  readonly backdropOk: number
  readonly logoOk: number
  readonly bannerOk: number
}

export interface ImageHealthStats {
  /** 已发布视频范围（is_published = true） */
  readonly published: ImageCoverageScope
  /** 全部视频范围（含未发布） */
  readonly all: ImageCoverageScope
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
  // ADR-209 D-209-4 BLOCK-3：行内 catalogId，供治理抽屉调 candidates/apply-candidate
  readonly catalogId: string
  readonly title: string
  readonly posterStatus: 'missing' | 'broken' | 'pending_review' | string
  // CHG-SN-6-RETRO-3-B / ultrareview P2-7：列扩展
  readonly posterUrl: string | null
  readonly posterSource: string | null
  readonly lastSeenBrokenAt: string | null
  readonly brokenDomain: string | null
  readonly occurrenceCount: number
  // ADR-209 D-209-4：最近未解决 poster 事件类型（供 Lightbox 精确破损原因）
  readonly eventType: string | null
  // IMGH-P2-3A：最近未解决 poster 事件 id（供治理抽屉「标记已解决」精确 resolve 展示中的事件）
  readonly eventId: string | null
  // ADR-209 D-209-4 BLOCK-4：跨源候选聚合（候选数列单查询取得，避 N+1/死列）
  readonly candidateCount: number
  readonly hasHighConfidenceCandidate: boolean
}

// ADR-211：问题图片可视化治理板数据源（对齐后端 imageHealth.scan.ts ProblemImageRow camelCase DTO）。
// supersede ADR-210 破损样本区（problem-images 是 recent-broken-samples 超集：4 类 + 状态∪真坏事件口径）。
export type ProblemImageKind = 'poster' | 'backdrop' | 'logo' | 'banner_backdrop'
export type ProblemImageScope = 'published' | 'all'
/**
 * problemReason：UI 分色 + 后端默认排序优先级（client_error 在前，ADR-213 D-213-7）。
 * 方案 C dissolve：`broken_event`→`client_error`（浏览器自过期信号）；新增 `unknown`（stale-ok 兜底面）。
 * 与后端 imageHealth.scan.ts ProblemReason 值域逐字对齐。
 */
export type ProblemReason =
  | 'client_error'
  | 'broken'
  | 'low_quality'
  | 'pending_review'
  | 'unknown'
  | 'other'

export interface ProblemImageRow {
  readonly videoId: string
  readonly catalogId: string
  readonly title: string
  readonly isPublished: boolean
  readonly kind: ProblemImageKind
  /** <kind>_url，后端口径已含 IS NOT NULL + btrim<>'' 守卫 → 恒非空非空白（无「无图卡」） */
  readonly imageUrl: string
  readonly status: string
  readonly problemReason: ProblemReason
  /** poster_source（仅 poster 有意义；secondary 恒 null → UI 隐藏空字段） */
  readonly source: string | null
  readonly eventType: string | null
  readonly brokenDomain: string | null
  readonly occurrenceCount: number
  readonly lastSeenBrokenAt: string | null
}

/** 4 类问题图片计数（tab badge + 当前 kind 的 total），一次返回避 4 次请求（ADR-211 D-211-4）。 */
export interface ProblemImageCounts {
  readonly poster: number
  readonly backdrop: number
  readonly logo: number
  readonly banner_backdrop: number
}

export interface ListProblemImagesParams {
  readonly kind?: ProblemImageKind
  readonly scope?: ProblemImageScope
  readonly offset?: number
  readonly limit?: number
}

export interface ListProblemImagesResult {
  readonly data: readonly ProblemImageRow[]
  /** 当前 kind+scope 命中总数（= counts[kind]） */
  readonly total: number
  readonly counts: ProblemImageCounts
}

export interface ListMissingVideosParams {
  readonly page?: number
  readonly limit?: number
  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单扩 4 子查询派生字段
  readonly sortField?:
    | 'created_at' | 'title' | 'poster_status'
    | 'poster_source' | 'broken_domain' | 'occurrence_count' | 'last_seen_broken_at'
  readonly sortDir?: 'asc' | 'desc'
  // ADR-209 D-209-1：服务端筛选（brokenDomain options 复用 getTopBrokenDomains）
  readonly search?: string
  readonly posterStatus?: 'missing' | 'broken' | 'pending_review'
  readonly posterSource?: 'manual' | 'tmdb' | 'bangumi' | 'douban' | 'crawler'
  readonly eventType?:
    | 'client_load_error' | 'empty_src' | 'fetch_404' | 'fetch_5xx'
    | 'timeout' | 'decode_fail' | 'dimension_too_small' | 'aspect_mismatch'
  readonly brokenDomain?: string
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

// ADR-208 D-208-3：应用候选补图
export interface ApplyImageCandidateInput {
  readonly catalogId: string
  readonly videoId: string
  readonly field: ImageCandidateField
  readonly source: string
  /** 与候选 sourceRef 一致校验（不符 → 409 CANDIDATE_STALE，提示刷新） */
  readonly sourceRef: string | null
}

export interface ApplyImageCandidateResult {
  readonly applied: boolean
  /** 写回后状态——恒为 pending_review（待新一轮健康巡检确认） */
  readonly status: string
}

/**
 * 应用候选补图（ADR-208 D-208-3）：经 safeUpdate 优先级闸门写回 media_catalog + 入队巡检 + 审计。
 * 失败语义：422 INVALID_SOURCE/INVALID_CANDIDATE_VALUE｜404 CANDIDATE_NOT_FOUND/CATALOG_NOT_FOUND｜
 * 409 CANDIDATE_STALE（候选过期）/ FIELD_LOCKED_OR_LOWER_PRIORITY（被锁/优先级不足，含 skippedFields）。
 */
export async function applyImageCandidate(
  input: ApplyImageCandidateInput,
): Promise<ApplyImageCandidateResult> {
  const result = await apiClient.post<{ data: ApplyImageCandidateResult }>(
    '/admin/image-health/apply-candidate',
    input,
  )
  return result.data
}

// ADR-209 D-209-2：批量解决破损事件
export interface ResolveEventResult {
  readonly resolvedCount: number
}

/**
 * 批量标记破损事件已解决（ADR-209 D-209-2）。
 * resolvedCount=0（事件不存在/已解决）幂等不报错。
 */
export async function resolveImageEvents(
  eventIds: readonly string[],
  note?: string,
): Promise<ResolveEventResult> {
  const result = await apiClient.post<{ data: ResolveEventResult }>(
    '/admin/image-health/resolve-event',
    { eventIds, note },
  )
  return result.data
}

// ADR-209 D-209-3：对选中视频精确重扫封面（scoped，禁全局副作用）
export interface RescanSelectedResult {
  readonly updatedCount: number
  /** 实际入队的待巡检行数；updatedCount < videoIds 数 → 部分行无可重扫 URL（纯 missing） */
  readonly enqueuedCount: number
}

/**
 * 对选中视频精确重扫封面（ADR-209 D-209-3）：scoped 重置 + 仅入队选中行。
 * 纯 missing（无 cover_url）行被守卫跳过、不计 updatedCount（UI 据此反馈"N 行无可重扫 URL"）。
 */
export async function rescanSelectedVideos(
  videoIds: readonly string[],
): Promise<RescanSelectedResult> {
  const result = await apiClient.post<{ data: RescanSelectedResult }>(
    '/admin/image-health/rescan-selected',
    { videoIds },
  )
  return result.data
}

export async function getTopBrokenDomains(limit = 20): Promise<readonly BrokenDomainRow[]> {
  const result = await apiClient.get<{ data: readonly BrokenDomainRow[] }>(
    `/admin/image-health/broken-domains?limit=${limit}`,
  )
  return result.data
}

/**
 * 问题图片可视化治理板数据源（ADR-211）：按 kind/scope 返回「有非空 URL 但可能失效」的图，
 * 供运营看真实缩略图人眼分诊。返回 { data, total, counts }——counts 一次给 4 类 tab badge。
 * supersede ADR-210 recent-broken-samples（problem-images 是其超集）。
 */
export async function getProblemImages(
  params: ListProblemImagesParams = {},
): Promise<ListProblemImagesResult> {
  const qs = new URLSearchParams()
  if (params.kind)            qs.set('kind', params.kind)
  if (params.scope)           qs.set('scope', params.scope)
  if (params.offset != null)  qs.set('offset', String(params.offset))
  if (params.limit != null)   qs.set('limit', String(params.limit))
  const q = qs.toString()
  return apiClient.get<ListProblemImagesResult>(
    `/admin/image-health/problem-images${q ? `?${q}` : ''}`,
  )
}

export async function listMissingVideos(
  params: ListMissingVideosParams = {},
): Promise<ListMissingVideosResult> {
  const qs = new URLSearchParams()
  if (params.page != null)      qs.set('page', String(params.page))
  if (params.limit != null)     qs.set('limit', String(params.limit))
  if (params.sortField)         qs.set('sortField', params.sortField)
  if (params.sortDir)           qs.set('sortDir', params.sortDir)
  // ADR-209 D-209-1：服务端筛选入参
  if (params.search)            qs.set('search', params.search)
  if (params.posterStatus)      qs.set('posterStatus', params.posterStatus)
  if (params.posterSource)      qs.set('posterSource', params.posterSource)
  if (params.eventType)         qs.set('eventType', params.eventType)
  if (params.brokenDomain)      qs.set('brokenDomain', params.brokenDomain)
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
