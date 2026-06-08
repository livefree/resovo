/**
 * bangumi.ts — Bangumi.tv v0 REST API 客户端（ADR-161 / ADR-189）
 *
 * 约束（对标 lib/douban.ts 降级哲学）：
 * - Bearer Token 鉴权（config.BANGUMI_API_TOKEN）；Token 缺失时仍可访问公开数据，
 *   但失败/超时一律返回 null/[]，由调用方降级（不抛，**searchSubjectsStrict 例外故意抛**）
 * - Bangumi 要求描述性 User-Agent（config.BANGUMI_USER_AGENT）
 * - 仅按需调用（auto 命中 / 后台手动 / collections worker）；批量场景走本地 dump 索引，避免限流
 *
 * 采集埋点（ADR-189 D-189-6 / arch M1）：每个 HTTP 出口旁路 recordFetch（method='api'，
 * provider='bangumi'，operation 见各函数）。recorder 惰性 import postgres → 本模块保持无 DB 可 import；
 * await 旁路在 return 前不改降级返回语义（null/[]/throw）。source 由调用方传。
 */

import {
  recordFetch,
  classifyFetchError,
  fetchErrorSummary,
} from '@/api/lib/external-fetch-recorder'
import type { FetchSource } from '@/api/db/queries/external-fetch-log'

// 直接读 process.env（与 lib/queue.ts 同模式，避免引入 config 单例的启动期 fail-fast）。
const API_BASE = 'https://api.bgm.tv'

/**
 * ADR-168 D-168-5：凭证可注入配置。来源优先级 = cfg 字段 > process.env > 默认。
 */
export interface BangumiClientConfig {
  token?: string
  userAgent?: string
  timeoutMs?: number
}

function apiToken(cfg?: BangumiClientConfig): string | undefined {
  return cfg?.token || process.env.BANGUMI_API_TOKEN || undefined
}
function timeoutMs(cfg?: BangumiClientConfig): number {
  const raw = cfg?.timeoutMs ?? Number(process.env.BANGUMI_API_TIMEOUT_MS)
  return Number.isFinite(raw) && (raw as number) > 0 ? (raw as number) : 8000
}
function userAgent(cfg?: BangumiClientConfig): string {
  return cfg?.userAgent || process.env.BANGUMI_USER_AGENT || 'resovo/1.0 (+https://github.com/resovo)'
}

// ── 类型（v0 schema 子集，仅取本项目消费字段）─────────────────────

export interface BangumiImages {
  large?: string
  common?: string
  medium?: string
  small?: string
  grid?: string
}

export interface BangumiRating {
  rank: number
  total: number
  score: number
}

export interface BangumiTag {
  name: string
  count: number
}

/** infobox 项：value 可能是字符串，或 { k?, v }[] 列表 */
export interface BangumiInfoboxItem {
  key: string
  value: string | Array<{ k?: string; v: string }>
}

export interface BangumiSubject {
  id: number
  type: number
  name: string
  name_cn: string
  summary: string
  nsfw: boolean
  date: string | null
  platform: string
  images: BangumiImages | null
  infobox: BangumiInfoboxItem[]
  rating: BangumiRating | null
  tags: BangumiTag[]
  total_episodes: number
  eps: number
}

export interface BangumiEpisode {
  id: number
  type: number // 0 本篇 / 1 SP / 2 OP / 3 ED
  name: string
  name_cn: string
  sort: number
  ep: number | null
  airdate: string
  duration: string
  duration_seconds: number | null
  desc: string
}

/** 角色下的配音演员/声优（CV）（/v0/subjects/{id}/characters 的 actors[] 元素） */
export interface BangumiCharacterActor {
  id: number
  name: string
  type: number          // 1 个人 / 2 公司 / 3 组合
  images: BangumiImages | null
}

/** 作品角色（/v0/subjects/{id}/characters 数组元素；无分页，一次返回全部） */
export interface BangumiCharacter {
  id: number
  name: string
  type: number          // 1 角色 / 2 机体 / 3 舰船 / 4 组织
  images: BangumiImages | null
  relation: string      // 主角 / 配角 / 客串 / 闲角
  summary: string
  actors: BangumiCharacterActor[]
}

/** 搜索结果条目（POST /v0/search/subjects 的 data 元素，字段较 subject 精简） */
export interface BangumiSearchItem {
  id: number
  name: string
  name_cn: string
  date: string | null
  images: BangumiImages | null
  rating: BangumiRating | null
}

/** 每日放送某一天（GET /calendar 数组元素，ADR-189 D-189-5） */
export interface BangumiCalendarItem {
  id: number
  name: string
  name_cn: string
  air_date?: string | null
  air_weekday?: number
  images: BangumiImages | null
  rating: BangumiRating | null
}

export interface BangumiCalendarDay {
  weekday: { id: number; en: string; cn: string; ja: string }
  items: BangumiCalendarItem[]
}

/** search 排序维度（ADR-189 D-189-5；POST /v0/search/subjects sort，禁 any 收窄）。 */
export type BangumiSearchSortKey = 'match' | 'heat' | 'rank' | 'score'

/** search 结构化过滤（仅本项目消费字段，禁 any）。 */
export interface BangumiSearchFilter {
  type?: number[]
  air_date?: string[]
  rank?: string[]
  nsfw?: boolean
}

// ── HTTP 封装 ─────────────────────────────────────────────────────

/** HTTP 非 2xx 错误（带 status，供 404=ok-empty 与 5xx=fail 区分埋点）。 */
class BangumiHttpError extends Error {
  constructor(readonly status: number, path: string) {
    super(`bangumi GET ${path}: HTTP ${status}`)
    this.name = 'BangumiHttpError'
  }
}

function buildHeaders(cfg?: BangumiClientConfig, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': userAgent(cfg),
    Accept: 'application/json',
    ...extra,
  }
  const token = apiToken(cfg)
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/**
 * GET 原子（**抛错版**，ADR-189 D-189-6）：非 2xx 抛 BangumiHttpError、网络/超时抛原错误。
 * 公开函数各自 try/catch 记埋点 + 降级返回（保留 null/[] 对外语义）；抛错使埋点能区分 ok/fail/timeout。
 */
async function bgmGet<T>(path: string, cfg?: BangumiClientConfig): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(cfg),
    signal: AbortSignal.timeout(timeoutMs(cfg)),
  })
  if (!res.ok) throw new BangumiHttpError(res.status, path)
  return (await res.json()) as T
}

/** 404 视作「成功但无数据」（valid negative），其余错误按 timeout/fail 分类。 */
function statusForGetError(err: unknown): 'ok' | 'fail' | 'timeout' {
  if (err instanceof BangumiHttpError && err.status === 404) return 'ok'
  return classifyFetchError(err)
}

// ── 公开 API ──────────────────────────────────────────────────────

/** GET /v0/subjects/{id} — 单条作品 rich 详情；失败/404 返回 null（埋点 detail/api）。 */
export async function getSubject(
  id: number,
  cfg?: BangumiClientConfig,
  source?: FetchSource | null,
): Promise<BangumiSubject | null> {
  const startedAt = Date.now()
  try {
    const value = await bgmGet<BangumiSubject>(`/v0/subjects/${id}`, cfg)
    await recordFetch({
      provider: 'bangumi', operation: 'detail', method: 'api', status: 'ok',
      source: source ?? null, target: String(id), itemCount: value ? 1 : 0, durationMs: Date.now() - startedAt,
    })
    return value
  } catch (err) {
    const status = statusForGetError(err)
    await recordFetch({
      provider: 'bangumi', operation: 'detail', method: 'api', status,
      source: source ?? null, target: String(id), itemCount: 0, durationMs: Date.now() - startedAt,
      error: status === 'ok' ? undefined : fetchErrorSummary(err),
    })
    return null
  }
}

/**
 * GET /v0/episodes — 拉取某作品全部本篇逐集（分页，单页 100，上限 50 页防无界，ADR-161 A4）。
 * 失败/无数据返回（可能部分）[]；埋点 detail/api（一次操作一行，itemCount=累计）。
 */
export async function getEpisodes(
  subjectId: number,
  cfg?: BangumiClientConfig,
  source?: FetchSource | null,
): Promise<BangumiEpisode[]> {
  const PAGE = 100
  const MAX_PAGES = 50
  const startedAt = Date.now()
  const all: BangumiEpisode[] = []
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE
      const resp = await bgmGet<{ data: BangumiEpisode[]; total: number }>(
        `/v0/episodes?subject_id=${subjectId}&limit=${PAGE}&offset=${offset}`,
        cfg,
      )
      if (!resp || !Array.isArray(resp.data) || resp.data.length === 0) break
      all.push(...resp.data)
      if (all.length >= resp.total) break
    }
    await recordFetch({
      provider: 'bangumi', operation: 'detail', method: 'api', status: 'ok',
      source: source ?? null, target: String(subjectId), itemCount: all.length, durationMs: Date.now() - startedAt,
    })
    return all
  } catch (err) {
    const status = statusForGetError(err)
    await recordFetch({
      provider: 'bangumi', operation: 'detail', method: 'api', status,
      source: source ?? null, target: String(subjectId), itemCount: all.length, durationMs: Date.now() - startedAt,
      error: status === 'ok' ? undefined : fetchErrorSummary(err),
    })
    return all // 保留 ADR-161 既有「break 返回已得部分」语义
  }
}

/**
 * GET /v0/subjects/{id}/characters — 拉取某作品全部角色 + 各自 CV（无分页，一次返回数组）。
 * 区分「抓取失败(null)」与「成功返回空([])」（供调用方判定是否全量替换）；埋点 celebrity/api。
 */
export async function getCharacters(
  subjectId: number,
  cfg?: BangumiClientConfig,
  source?: FetchSource | null,
): Promise<BangumiCharacter[] | null> {
  const startedAt = Date.now()
  try {
    const resp = await bgmGet<BangumiCharacter[]>(`/v0/subjects/${subjectId}/characters`, cfg)
    const value = Array.isArray(resp) ? resp : null
    await recordFetch({
      provider: 'bangumi', operation: 'celebrity', method: 'api',
      status: value === null ? 'fail' : 'ok',
      source: source ?? null, target: String(subjectId), itemCount: value?.length ?? 0, durationMs: Date.now() - startedAt,
    })
    return value
  } catch (err) {
    const status = statusForGetError(err)
    await recordFetch({
      provider: 'bangumi', operation: 'celebrity', method: 'api', status,
      source: source ?? null, target: String(subjectId), itemCount: 0, durationMs: Date.now() - startedAt,
      error: status === 'ok' ? undefined : fetchErrorSummary(err),
    })
    return null
  }
}

/**
 * POST /v0/search/subjects — 关键词搜索动画（type=2）候选。**严格版**：失败**抛出**（不吞）。
 * 用于自动富集匹配路径——调用方需区分「真无结果（[]）」与「瞬时失败（throw）」。埋点 search/api（成功/失败均记，失败后 re-throw）。
 */
export async function searchSubjectsStrict(
  keyword: string,
  limit = 10,
  cfg?: BangumiClientConfig,
  source?: FetchSource | null,
): Promise<BangumiSearchItem[]> {
  const startedAt = Date.now()
  try {
    const res = await fetch(`${API_BASE}/v0/search/subjects?limit=${limit}`, {
      method: 'POST',
      headers: buildHeaders(cfg, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ keyword, filter: { type: [2] } }),
      signal: AbortSignal.timeout(timeoutMs(cfg)),
    })
    if (!res.ok) throw new Error(`bangumi searchSubjects failed: HTTP ${res.status}`)
    const data = (await res.json()) as { data?: BangumiSearchItem[] }
    const items = Array.isArray(data.data) ? data.data : []
    await recordFetch({
      provider: 'bangumi', operation: 'search', method: 'api', status: 'ok',
      source: source ?? null, target: keyword, itemCount: items.length, durationMs: Date.now() - startedAt,
    })
    return items
  } catch (err) {
    await recordFetch({
      provider: 'bangumi', operation: 'search', method: 'api', status: classifyFetchError(err),
      source: source ?? null, target: keyword, itemCount: 0, durationMs: Date.now() - startedAt,
      error: fetchErrorSummary(err),
    })
    throw err // 严格版 re-throw（埋点不改抛出语义）
  }
}

/**
 * POST /v0/search/subjects — **宽容版**：失败返回 []（不重复埋点，strict 已记）。
 * 用于手动后台候选搜索——API 故障时优雅降级为「无候选」，不阻断 UI。
 */
export async function searchSubjects(
  keyword: string,
  limit = 10,
  cfg?: BangumiClientConfig,
  source?: FetchSource | null,
): Promise<BangumiSearchItem[]> {
  try {
    return await searchSubjectsStrict(keyword, limit, cfg, source)
  } catch {
    return []
  }
}

/**
 * GET /calendar — 每日放送（按星期分组，ADR-189 D-189-5）。
 * 返回 7 天数组；**抓取失败返回 null**（worker empty_guard 区分真空 vs 失败，arch H3）。埋点 schedule/api。
 */
export async function getCalendar(
  cfg?: BangumiClientConfig,
  source?: FetchSource | null,
): Promise<BangumiCalendarDay[] | null> {
  const startedAt = Date.now()
  try {
    const data = await bgmGet<BangumiCalendarDay[]>(`/calendar`, cfg)
    const value = Array.isArray(data) ? data : null
    const itemCount = value ? value.reduce((n, d) => n + (Array.isArray(d.items) ? d.items.length : 0), 0) : 0
    await recordFetch({
      provider: 'bangumi', operation: 'schedule', method: 'api',
      status: value === null ? 'fail' : 'ok',
      source: source ?? null, target: 'calendar', itemCount, durationMs: Date.now() - startedAt,
    })
    return value
  } catch (err) {
    const status = statusForGetError(err)
    await recordFetch({
      provider: 'bangumi', operation: 'schedule', method: 'api', status,
      source: source ?? null, target: 'calendar', itemCount: 0, durationMs: Date.now() - startedAt,
      error: status === 'ok' ? undefined : fetchErrorSummary(err),
    })
    return null
  }
}

/**
 * POST /v0/search/subjects（**排序版**，ADR-189 D-189-5）：热门(sort=heat)/排行(sort=rank) 派生合集。
 * 返回候选；**抓取失败返回 null**（worker empty_guard 区分真空 vs 失败，arch H3）。埋点 collection/api。
 */
export async function searchSubjectsSorted(
  opts: { sort: BangumiSearchSortKey; filter?: BangumiSearchFilter; limit?: number; offset?: number },
  cfg?: BangumiClientConfig,
  source?: FetchSource | null,
): Promise<BangumiSearchItem[] | null> {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0
  const filter: BangumiSearchFilter = { type: [2], ...opts.filter }
  const startedAt = Date.now()
  try {
    const res = await fetch(`${API_BASE}/v0/search/subjects?limit=${limit}&offset=${offset}`, {
      method: 'POST',
      headers: buildHeaders(cfg, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ sort: opts.sort, filter }),
      signal: AbortSignal.timeout(timeoutMs(cfg)),
    })
    if (!res.ok) throw new Error(`bangumi searchSubjectsSorted failed: HTTP ${res.status}`)
    const data = (await res.json()) as { data?: BangumiSearchItem[] }
    const items = Array.isArray(data.data) ? data.data : []
    await recordFetch({
      provider: 'bangumi', operation: 'collection', method: 'api', status: 'ok',
      source: source ?? null, target: opts.sort, itemCount: items.length, durationMs: Date.now() - startedAt,
    })
    return items
  } catch (err) {
    await recordFetch({
      provider: 'bangumi', operation: 'collection', method: 'api', status: classifyFetchError(err),
      source: source ?? null, target: opts.sort, itemCount: 0, durationMs: Date.now() - startedAt,
      error: fetchErrorSummary(err),
    })
    return null
  }
}

/** Token 是否已配置（调用方据此决定走 REST 详情还是仅本地 dump 降级）。 */
export function isBangumiApiConfigured(cfg?: BangumiClientConfig): boolean {
  return Boolean(apiToken(cfg))
}
