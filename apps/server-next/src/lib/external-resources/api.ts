/**
 * external-resources/api.ts — 外部资源治理页取数层（ADR-188 §端点契约）
 *
 * 对应后端 5 端点（providers / :provider/overview / :provider/activity /
 * :provider/collections / :provider/search）。本卡（UI-A）实装 providers /
 * overview / activity；collections / search 见 UI-B（同文件追加）。
 *
 * 仅经 apiClient（ADR-003 不得直 fetch）。类型镜像后端响应（response shape 非
 * @resovo/types 共享形态，故在 UI 层声明；ProviderKey/ExternalProvider 复用共享类型）。
 */
import { apiClient } from '@/lib/api-client'
import type { ExternalProvider, ProviderKey } from '@resovo/types'

// ── 数据规模 / provider 摘要 ────────────────────────────────────────

export interface DataScale {
  readonly collectionItems: number
  readonly doubanEntries: number
}

/** providers 端点单项：registry 声明 + active provider 数据规模（planned 为 null）。 */
export interface ProviderSummary extends ExternalProvider {
  readonly dataScale: DataScale | null
}

// ── 概览（overview）────────────────────────────────────────────────

export interface FetchAggregateBucket {
  readonly key: string
  readonly total: number
  readonly ok: number
  readonly fail: number
  readonly timeout: number
}

export interface FetchAggregate {
  readonly total: number
  readonly ok: number
  readonly fail: number
  readonly timeout: number
  readonly avgDurationMs: number | null
  readonly byOperation: FetchAggregateBucket[]
  readonly byMethod: FetchAggregateBucket[]
}

export interface MatchBucket {
  readonly key: string
  readonly count: number
}

export interface EnrichStats {
  readonly total: number
  readonly byStatus: MatchBucket[]
  readonly byMethod: MatchBucket[]
}

export interface CollectionFreshness {
  readonly collection: string
  readonly lastAttemptAt: string | null
  readonly lastSuccessAt: string | null
  readonly lastStatus: string | null
  readonly lastError: string | null
  readonly itemCount: number
}

export interface OverviewData {
  readonly fetchStats: FetchAggregate
  readonly enrichStats: EnrichStats
  readonly collectionFreshness: CollectionFreshness[]
  readonly dataScale: DataScale
}

// ── 采集流水（activity）────────────────────────────────────────────

export interface FetchLogRow {
  readonly id: string
  readonly provider: string
  readonly operation: string
  readonly method: string
  readonly status: string
  readonly source: string | null
  readonly target: string | null
  readonly itemCount: number
  readonly durationMs: number | null
  readonly error: string | null
  readonly createdAt: string
}

export interface ActivityPage {
  readonly rows: FetchLogRow[]
  readonly total: number
}

export interface ActivityQuery {
  readonly operation?: string
  readonly method?: string
  readonly status?: string
  readonly since?: string
  readonly limit?: number
  readonly page?: number
}

// ── 取数函数 ────────────────────────────────────────────────────────

export async function fetchProviders(): Promise<ProviderSummary[]> {
  const res = await apiClient.get<{ data: ProviderSummary[] }>('/admin/external-resources/providers')
  return res.data
}

/** planned provider 返回 data:null（route 据 status:'planned' 降级）。 */
export async function fetchOverview(provider: ProviderKey, since?: string): Promise<OverviewData | null> {
  const params = new URLSearchParams()
  if (since) params.set('since', since)
  const qs = params.toString()
  const res = await apiClient.get<{ data: OverviewData | null }>(
    `/admin/external-resources/${provider}/overview${qs ? `?${qs}` : ''}`,
  )
  return res.data
}

/** planned provider 返回 null；active 返回 { rows, total }。 */
export async function fetchActivity(provider: ProviderKey, query: ActivityQuery): Promise<ActivityPage | null> {
  const params = new URLSearchParams()
  if (query.operation) params.set('operation', query.operation)
  if (query.method) params.set('method', query.method)
  if (query.status) params.set('status', query.status)
  if (query.since) params.set('since', query.since)
  if (query.limit) params.set('limit', String(query.limit))
  if (query.page) params.set('page', String(query.page))
  const qs = params.toString()
  const res = await apiClient.get<{ data: FetchLogRow[] | null; total?: number }>(
    `/admin/external-resources/${provider}/activity${qs ? `?${qs}` : ''}`,
  )
  return res.data ? { rows: res.data, total: res.total ?? 0 } : null
}

// ── 热门资源（collections，UI-B）──────────────────────────────────

export interface CollectionSummaryItem {
  readonly collection: string
  readonly domain: string
  readonly category: string
  readonly count: number
}

export interface CollectionItem {
  readonly collection: string
  readonly domain: string
  readonly category: string
  readonly doubanId: string
  readonly rank: number
  readonly title: string
  readonly originalTitle: string | null
  readonly year: number | null
  readonly ratingValue: number | null
  readonly coverUrl: string | null
}

export interface CollectionsResult {
  readonly items: CollectionItem[]
  readonly total: number
  readonly summary: CollectionSummaryItem[]
}

export interface CollectionsQuery {
  readonly collection?: string
  readonly limit?: number
  readonly page?: number
}

/** planned provider 返回 null。summary 为全合集分类计数（不随 collection 过滤变化）。 */
export async function fetchCollections(provider: ProviderKey, query: CollectionsQuery): Promise<CollectionsResult | null> {
  const params = new URLSearchParams()
  if (query.collection) params.set('collection', query.collection)
  if (query.limit) params.set('limit', String(query.limit))
  if (query.page) params.set('page', String(query.page))
  const qs = params.toString()
  const res = await apiClient.get<{ data: CollectionItem[] | null; total?: number; summary?: CollectionSummaryItem[] }>(
    `/admin/external-resources/${provider}/collections${qs ? `?${qs}` : ''}`,
  )
  return res.data ? { items: res.data, total: res.total ?? 0, summary: res.summary ?? [] } : null
}

// ── 统一搜索（search，UI-B）───────────────────────────────────────

export interface SearchHit {
  readonly source: 'offline' | 'online'
  readonly doubanId: string
  readonly title: string
  readonly year: number | null
  readonly rating: number | null
}

export interface SearchResult {
  readonly rows: SearchHit[]
  readonly total: number
  /** live 限流降级标记（'busy'：已有在线搜索进行中，本次仅返回 dump） */
  readonly liveError?: string
}

export interface SearchQuery {
  readonly q: string
  readonly live?: boolean
  readonly limit?: number
  readonly page?: number
}

/** planned provider 返回 null。q 必填；live=true 经 ?live=1 开在线实时补充。 */
export async function searchResources(provider: ProviderKey, query: SearchQuery): Promise<SearchResult | null> {
  const params = new URLSearchParams()
  params.set('q', query.q)
  if (query.live) params.set('live', '1')
  if (query.limit) params.set('limit', String(query.limit))
  if (query.page) params.set('page', String(query.page))
  const res = await apiClient.get<{ data: SearchHit[] | null; total?: number; liveError?: string }>(
    `/admin/external-resources/${provider}/search?${params.toString()}`,
  )
  if (!res.data) return null
  return { rows: res.data, total: res.total ?? 0, ...(res.liveError ? { liveError: res.liveError } : {}) }
}

// ── 展示标签映射（operation / method / status / source）─────────────
// registry 真源在 packages/types；此处为 UI 中文展示文案（回答用户「抓的是基础信息/
// 评论/热播/时间表」「离线/在线/API」「成功/失败」三类诉求）。

export const OPERATION_LABELS: Readonly<Record<string, string>> = {
  detail: '视频基础信息',
  search: '搜索',
  collection: '热播/榜单',
  comments: '评论',
  schedule: '播放时间表',
  celebrity: '人物',
}

export const METHOD_LABELS: Readonly<Record<string, string>> = {
  offline: '离线 dump',
  scrape: '页面抓取',
  api: 'API',
}

export const STATUS_LABELS: Readonly<Record<string, string>> = {
  ok: '成功',
  fail: '失败',
  timeout: '超时',
}

export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  enrich_worker: '富集 worker',
  collections_worker: '合集 worker',
  admin_search: '后台搜索',
}

/** 标签查表（缺失回退原 key，对增量 operation/method 值天然兼容）。 */
export function labelOf(map: Readonly<Record<string, string>>, key: string | null): string {
  if (!key) return '—'
  return map[key] ?? key
}
