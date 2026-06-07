/**
 * home-curation/api.ts — Home Curation 聚合门面 API 客户端封装
 * （CHG-HOME-CANVAS-A / ADR-182）
 *
 * 消费端点：apps/api/src/routes/admin/home.ts（ADR-182 #1/#2/#3/#6）。
 * preview 跳缓存（后端语义），客户端不做本地缓存。
 */

import { apiClient } from '@/lib/api-client'
import type {
  AutofillCandidate,
  AutofillCandidatesResult,
  ContentGap,
  HomeConfigDraft,
  HomeDraftStaleness,
  HomePageConfig,
  HomePreview,
  HomePreviewQuery,
  HomePublishVersion,
  HomePublishVersionSummary,
  HomeSectionKey,
  HomeSectionSettings,
  HomeSectionSummary,
} from './types'

export async function getHomePreview(query: HomePreviewQuery = {}): Promise<HomePreview> {
  const params = new URLSearchParams()
  if (query.brandSlug) params.set('brand_slug', query.brandSlug)
  if (query.locale)    params.set('locale', query.locale)
  if (query.at)        params.set('at', query.at)
  if (query.device)    params.set('device', query.device)
  if (query.draft)     params.set('draft', 'true')
  const qs = params.toString()
  const result = await apiClient.get<{ data: HomePreview }>(`/admin/home/preview${qs ? `?${qs}` : ''}`)
  return result.data
}

// ── 发布治理（ADR-185 #1–#4 / CHG-HOME-DRAFT-PUBLISH-B 消费）──────────────

export interface HomeDraftResult {
  readonly draft: HomeConfigDraft | null
  /** 陈旧双信号（无草稿 null；additive 顶层字段，D-185-2.2 编辑器提示） */
  readonly staleness: HomeDraftStaleness | null
}

export async function getHomeDraft(): Promise<HomeDraftResult> {
  const result = await apiClient.get<{ data: HomeConfigDraft | null; staleness: HomeDraftStaleness | null }>(
    '/admin/home/draft',
  )
  return { draft: result.data, staleness: result.staleness ?? null }
}

/** PUT 整页整体替换（D-185-3.1；不计 audit——编辑态噪音） */
export async function saveHomeDraft(config: HomePageConfig): Promise<HomeConfigDraft> {
  const result = await apiClient.put<{ data: HomeConfigDraft }>('/admin/home/draft', { config })
  return result.data
}

export async function discardHomeDraft(): Promise<{ deleted: boolean }> {
  const result = await apiClient.delete<{ data: { deleted: boolean } }>('/admin/home/draft')
  return result.data
}

/**
 * 发布（D-185-3.2）：无草稿 422 / 草稿陈旧·重校验失败·并发竞态 409 STATE_CONFLICT
 * （audit home_page.publish 在后端落；缓存失效钩子归 CHG-HOME-CACHE-INVALIDATE）。
 */
export async function publishHomeDraft(note?: string): Promise<{ versionNo: number }> {
  const result = await apiClient.post<{ data: { versionNo: number } }>(
    '/admin/home/publish',
    note ? { note } : {},
  )
  return result.data
}

// ── 版本历史（ADR-185 #5–#7 / CHG-HOME-AUDIT-ROLLBACK 消费）────────────────

export interface HomeVersionListResult {
  readonly rows: HomePublishVersionSummary[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

/** 端点 #5：轻量行分页（不含 config 载荷，D-185-3.3） */
export async function listHomeVersions(params: { page?: number; limit?: number } = {}): Promise<HomeVersionListResult> {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  const q = qs.toString()
  const result = await apiClient.get<{ data: HomePublishVersionSummary[]; total: number; page: number; limit: number }>(
    `/admin/home/versions${q ? `?${q}` : ''}`,
  )
  return { rows: result.data, total: result.total, page: result.page, limit: result.limit }
}

/** 端点 #6：详情含全量 config（消费端 diff 数据源，D-185-4.2） */
export async function getHomeVersion(versionNo: number): Promise<HomePublishVersion> {
  const result = await apiClient.get<{ data: HomePublishVersion }>(`/admin/home/versions/${versionNo}`)
  return result.data
}

/**
 * 端点 #7：版本回滚（恢复三表 + roll-forward 新版本；audit home_page.rollback
 * 在后端落）。版本数 < 2 时 422；目标不存在 404。
 */
export async function rollbackHomeVersion(versionNo: number, note?: string): Promise<{ versionNo: number }> {
  const result = await apiClient.post<{ data: { versionNo: number } }>(
    `/admin/home/versions/${versionNo}/rollback`,
    note ? { note } : {},
  )
  return result.data
}

export async function listHomeSections(): Promise<HomeSectionSummary[]> {
  const result = await apiClient.get<{ data: HomeSectionSummary[] }>('/admin/home/sections')
  return result.data
}

export async function updateHomeSectionSettings(
  section: HomeSectionKey,
  body: Partial<Pick<HomeSectionSettings, 'autofillMode' | 'refreshIntervalMinutes' | 'displayCount' | 'allowDuplicates' | 'pinnedLimit' | 'settings'>>,
): Promise<HomeSectionSettings> {
  const result = await apiClient.patch<{ data: HomeSectionSettings }>(
    `/admin/home/sections/${section}/settings`,
    body,
  )
  return result.data
}

/**
 * 端点 #6：区块内排序门面（CHG-HOME-CARD-DND-B / D-182-4 #6）。
 * 画布唯一排序路径——banner section 经此获得审计覆盖（home_section.reorder）；
 * id 必须属于该 section 真源（banner→home_banners / 其余→home_modules），否则 422。
 */
export async function reorderHomeSection(
  section: HomeSectionKey,
  items: ReadonlyArray<{ id: string; ordering: number }>,
): Promise<{ updated: number }> {
  const result = await apiClient.post<{ data: { updated: number } }>(
    `/admin/home/sections/${section}/reorder`,
    { items },
  )
  return result.data
}

/**
 * 端点 #4：候选快照只读消费（CHG-HOME-AUTOFILL-UI / D-182-4.4）。
 * snapshotAt null = 快照未生成（200 非 404）；includeFiltered 同时解锁
 * filtered 条目解释展示与 gaps 缺口（D-183-7.3 additive）。
 */
export async function getAutofillCandidates(
  section: HomeSectionKey,
  opts: { includeFiltered?: boolean } = {},
): Promise<AutofillCandidatesResult> {
  const qs = opts.includeFiltered ? '?include_filtered=true' : ''
  const result = await apiClient.get<{
    data: AutofillCandidate[]
    snapshotAt: string | null
    policyVersion: string | null
    gaps?: ContentGap[]
  }>(`/admin/home/sections/${section}/autofill-candidates${qs}`)
  return {
    candidates: result.data,
    snapshotAt: result.snapshotAt,
    policyVersion: result.policyVersion,
    ...(result.gaps !== undefined ? { gaps: result.gaps } : {}),
  }
}

/**
 * 端点 #5：选中候选转 pinned（D-182-4.5 全有或全无——任一失效整体 409 零写入；
 * banner 422 指引横幅编辑器；audit home_section.apply_autofill 在后端落）。
 */
export async function applyAutofillCandidates(
  section: HomeSectionKey,
  candidateIds: readonly string[],
): Promise<{ applied: number }> {
  const result = await apiClient.post<{ data: { applied: number } }>(
    `/admin/home/sections/${section}/apply-autofill`,
    { candidateIds },
  )
  return result.data
}

/**
 * 端点 #7：手动触发候选重算入队（202 异步；进行中重复触发 429 RATE_LIMITED；
 * manual_only 422。audit home_section.refresh_candidates 在后端落）。
 */
export async function refreshSectionCandidates(
  section: HomeSectionKey,
): Promise<{ enqueued: boolean }> {
  const result = await apiClient.post<{ data: { enqueued: boolean } }>(
    `/admin/home/sections/${section}/refresh-candidates`,
  )
  return result.data
}
