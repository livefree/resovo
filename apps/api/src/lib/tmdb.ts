/**
 * tmdb.ts — TMDb v3 REST API 客户端（ADR-173 → ADR-201 §TMDB 接入 / META-38）
 *
 * 能力（ADR-201 §TMDB 元数据范围 / decisions.md 22832-22846）：
 *   - 连接测试（testConnection，凭证位 META-37 就绪）
 *   - Search：movie / tv（searchMovie / searchTv）
 *   - Detail：movie / tv + append_to_response（getMovieDetail / getTvDetail）
 *   - Configuration：image base URL / languages / countries（getConfiguration）
 *   只读元数据 provider——**不接播放源**、不做账号/session（ADR-201 §不做）。
 *
 * 鉴权双路（ADR-201 D-201-7）：read_access_token（v4 Bearer，写 Authorization header，首选）
 *   / api_key（v3，写 query ?api_key=，兼容）。Bearer 优先；皆缺 → 无法请求。
 *
 * 限速 / 429（ADR-201 22830）：进程内最小间隔节流（throttle）+ 429 退避重试（尊重 Retry-After，
 *   指数退避兜底）；429 视为 provider 暂时不可用，不标凭证无效。
 *
 * 采集埋点（对标 bangumi.ts / ADR-188 D-188-4）：每个数据出口旁路 recordFetch（provider='tmdb'、
 *   method='api'）；recorder 惰性 import postgres → 本模块保持无 DB 可 import；source 由调用方传。
 */

import {
  recordFetch,
  classifyFetchError,
  fetchErrorSummary,
} from '@/api/lib/external-fetch-recorder'
import type { FetchSource } from '@/api/db/queries/external-fetch-log'
import type {
  TmdbAppendKey,
  TmdbConfiguration,
  TmdbMovieDetail,
  TmdbMovieSearchResponse,
  TmdbPagedResponse,
  TmdbSeasonDetail,
  TmdbTvDetail,
  TmdbTvSearchResponse,
} from '@/api/lib/tmdb.types'

export interface TmdbClientConfig {
  /** v4 API Read Access Token，写 Authorization: Bearer（首选）。 */
  readAccessToken?: string
  /** v3 API Key，写 query ?api_key=（兼容）。 */
  apiKey?: string
  baseUrl?: string
  language?: string
  timeoutMs?: number
  /** 进程内请求最小间隔（节流；默认 DEFAULT_MIN_INTERVAL_MS，测试可设 0 跳过）。 */
  minRequestIntervalMs?: number
  /** 429 退避重试最大次数（默认 DEFAULT_MAX_RETRIES）。 */
  maxRetries?: number
}

/** 认证方式（ADR-201 22811，由保存字段派生）：Bearer 优先 > api_key > none。 */
export type TmdbAuthMethod = 'bearer' | 'api_key' | 'none'

export interface TmdbTestResult {
  ok: boolean
  latencyMs: number
  error?: string
  authStatus?: 'valid' | 'invalid' | 'not_required'
  /** 本次测试实际采用的认证方式（供测试断言 / 未来 UI 透传，ADR-201 22817 区分 Bearer/API Key）。 */
  authMethod?: TmdbAuthMethod
}

const DEFAULT_BASE = 'https://api.themoviedb.org/3'
const DEFAULT_TIMEOUT_MS = 8000
/** 保守自我限速 ~50 req/s（TMDb 现无硬限速，节流避免 429）。 */
const DEFAULT_MIN_INTERVAL_MS = 20
const DEFAULT_MAX_RETRIES = 3
/** 429 退避上限（避免 Retry-After 异常值导致长阻塞）。 */
const MAX_BACKOFF_MS = 10_000

/** 由配置派生认证方式（Bearer 优先 > api_key > none，ADR-201 22811）。 */
export function resolveTmdbAuthMethod(cfg?: TmdbClientConfig): TmdbAuthMethod {
  if (cfg?.readAccessToken) return 'bearer'
  if (cfg?.apiKey) return 'api_key'
  return 'none'
}

/**
 * 把鉴权注入 url（api_key query）或 headers（Bearer）并返回采用的认证方式。
 * Bearer 优先；none 时不注入任何凭证（调用方据返回值决定是否发请求）。
 * testConnection 与 tmdbGet 共用此单一鉴权真源（复用，避免双源漂移）。
 */
function applyAuth(cfg: TmdbClientConfig | undefined, url: URL, headers: Record<string, string>): TmdbAuthMethod {
  const method = resolveTmdbAuthMethod(cfg)
  if (method === 'bearer') headers.Authorization = `Bearer ${cfg!.readAccessToken}`
  else if (method === 'api_key') url.searchParams.set('api_key', cfg!.apiKey ?? '')
  return method
}

function summarizeError(err: unknown): string {
  if (err instanceof Error) return err.name === 'TimeoutError' ? '请求超时' : err.message
  return String(err)
}

/**
 * 连接测试（ADR-201 §连接测试）：GET {baseUrl}/authentication。
 * Bearer 首选（Authorization: Bearer <read_access_token>）；否则 api_key（query ?api_key=）。
 * 200=valid / 401=invalid token / 429=provider 暂时不可用（warn，不标 invalid）/ 其他非 2xx 不断言。
 * read_access_token 与 api_key 皆缺 → 无法测试（ok=false，不发请求）。
 */
export async function testConnection(cfg?: TmdbClientConfig): Promise<TmdbTestResult> {
  const url = new URL(`${cfg?.baseUrl || DEFAULT_BASE}/authentication`)
  const headers: Record<string, string> = { Accept: 'application/json' }
  const authMethod = applyAuth(cfg, url, headers)
  if (authMethod === 'none') {
    return { ok: false, latencyMs: 0, error: '未配置 API Read Access Token 或 API Key', authMethod }
  }

  const startedAt = Date.now()
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(cfg?.timeoutMs ?? DEFAULT_TIMEOUT_MS) })
    const latencyMs = Date.now() - startedAt
    if (res.ok) return { ok: true, latencyMs, authStatus: 'valid', authMethod }
    if (res.status === 401) return { ok: false, latencyMs, authStatus: 'invalid', error: '凭证无效（401 未授权）', authMethod }
    if (res.status === 429) return { ok: false, latencyMs, error: 'TMDb 限流（429），稍后重试', authMethod }
    return { ok: false, latencyMs, error: `HTTP ${res.status}`, authMethod }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - startedAt, error: summarizeError(err), authMethod }
  }
}

// ── HTTP core（限速 / 429 退避 / 鉴权）─────────────────────────────────────────

/** HTTP 非 2xx 错误（带 status，供 404=ok-empty 与其余 fail 区分埋点）。 */
export class TmdbHttpError extends Error {
  constructor(readonly status: number, path: string) {
    super(`tmdb GET ${path}: HTTP ${status}`)
    this.name = 'TmdbHttpError'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 进程内串行节流：保证相邻请求间隔 ≥ minInterval（并发安全的 promise 链）。
let throttleChain: Promise<void> = Promise.resolve()
let lastRequestAt = 0
function throttle(minIntervalMs: number): Promise<void> {
  if (minIntervalMs <= 0) return Promise.resolve()
  const next = throttleChain.then(async () => {
    const wait = lastRequestAt + minIntervalMs - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
  })
  throttleChain = next.catch(() => undefined)
  return next
}

/** 429 退避时长：优先 Retry-After header（秒），否则指数退避；皆封顶 MAX_BACKOFF_MS。 */
function retryAfterMs(res: Response, attempt: number): number {
  const header = res.headers.get('retry-after')
  if (header) {
    const secs = Number(header)
    if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, MAX_BACKOFF_MS)
  }
  return Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS)
}

type TmdbQueryParams = Record<string, string | number | boolean | undefined>

/**
 * GET 原子（**抛错版**）：非 2xx 抛 TmdbHttpError、网络/超时抛原错误。
 * 节流 + Bearer/api_key 鉴权 + 超时 + 429 退避重试（≤ maxRetries）。
 * 公开函数各自 try/catch 记埋点 + 降级（detail 返 null / search re-throw）。
 */
async function tmdbGet<T>(path: string, params: TmdbQueryParams, cfg?: TmdbClientConfig): Promise<T> {
  const url = new URL(`${cfg?.baseUrl || DEFAULT_BASE}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  const headers: Record<string, string> = { Accept: 'application/json' }
  const authMethod = applyAuth(cfg, url, headers)
  if (authMethod === 'none') throw new Error('TMDb 未配置 read_access_token 或 api_key')

  const maxRetries = cfg?.maxRetries ?? DEFAULT_MAX_RETRIES
  const minInterval = cfg?.minRequestIntervalMs ?? DEFAULT_MIN_INTERVAL_MS

  for (let attempt = 0; ; attempt++) {
    await throttle(minInterval)
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(cfg?.timeoutMs ?? DEFAULT_TIMEOUT_MS) })
    if (res.ok) return (await res.json()) as T
    if (res.status === 429 && attempt < maxRetries) {
      await sleep(retryAfterMs(res, attempt))
      continue
    }
    throw new TmdbHttpError(res.status, path)
  }
}

/** 404 视作「成功但无数据」（valid negative），其余按 timeout/fail 分类。 */
function statusForGetError(err: unknown): 'ok' | 'fail' | 'timeout' {
  if (err instanceof TmdbHttpError && err.status === 404) return 'ok'
  return classifyFetchError(err)
}

/** 旁路埋点 helper（provider/method 固定，operation 限本 client 实际用到的两类）。 */
async function recordTmdbFetch(
  operation: 'search' | 'detail',
  status: 'ok' | 'fail' | 'timeout',
  source: FetchSource | null,
  target: string,
  itemCount: number,
  durationMs: number,
  error?: string,
): Promise<void> {
  await recordFetch({ provider: 'tmdb', operation, method: 'api', status, source, target, itemCount, durationMs, error })
}

// ── 公开 API ──────────────────────────────────────────────────────────────────

export interface TmdbSearchOptions {
  /** 页码（1-based，TMDb 默认 1）。 */
  page?: number
  /** 语言（如 zh-CN）；省略走 cfg.language 或 TMDb 默认。 */
  language?: string
  /** 是否含成人内容（默认不传，TMDb 默认 false）。 */
  includeAdult?: boolean
  /** movie → primary_release_year；tv → first_air_date_year。 */
  year?: number
}

export interface TmdbDetailOptions {
  language?: string
  /** append_to_response 键集合（external_ids/images/videos/credits/...，ADR-201 22838）。 */
  append?: readonly TmdbAppendKey[]
}

/** GET /search/movie — 电影关键词搜索；**严格版**：失败抛出（调用方区分「真无结果」与「瞬时失败」）。 */
export async function searchMovie(
  query: string, opts?: TmdbSearchOptions, cfg?: TmdbClientConfig, source?: FetchSource | null,
): Promise<TmdbMovieSearchResponse> {
  return runSearch<TmdbMovieSearchResponse>('movie', query, opts, cfg, source)
}

/** GET /search/tv — 剧集关键词搜索；**严格版**：失败抛出。 */
export async function searchTv(
  query: string, opts?: TmdbSearchOptions, cfg?: TmdbClientConfig, source?: FetchSource | null,
): Promise<TmdbTvSearchResponse> {
  return runSearch<TmdbTvSearchResponse>('tv', query, opts, cfg, source)
}

async function runSearch<R extends TmdbPagedResponse<unknown>>(
  kind: 'movie' | 'tv', query: string, opts: TmdbSearchOptions | undefined,
  cfg: TmdbClientConfig | undefined, source: FetchSource | null | undefined,
): Promise<R> {
  const startedAt = Date.now()
  const yearKey = kind === 'movie' ? 'primary_release_year' : 'first_air_date_year'
  try {
    const value = await tmdbGet<R>(`/search/${kind}`, {
      query,
      language: opts?.language ?? cfg?.language,
      page: opts?.page,
      include_adult: opts?.includeAdult,
      [yearKey]: opts?.year,
    }, cfg)
    await recordTmdbFetch('search', 'ok', source ?? null, query, value.results.length, Date.now() - startedAt)
    return value
  } catch (err) {
    await recordTmdbFetch('search', classifyFetchError(err), source ?? null, query, 0, Date.now() - startedAt, fetchErrorSummary(err))
    throw err
  }
}

/** GET /movie/{id}（+append_to_response）— 失败/404 返回 null（valid negative，对齐 bangumi.getSubject）。 */
export async function getMovieDetail(
  id: number, opts?: TmdbDetailOptions, cfg?: TmdbClientConfig, source?: FetchSource | null,
): Promise<TmdbMovieDetail | null> {
  return getDetail<TmdbMovieDetail>('movie', id, opts, cfg, source)
}

/** GET /tv/{id}（+append_to_response）— 失败/404 返回 null。 */
export async function getTvDetail(
  id: number, opts?: TmdbDetailOptions, cfg?: TmdbClientConfig, source?: FetchSource | null,
): Promise<TmdbTvDetail | null> {
  return getDetail<TmdbTvDetail>('tv', id, opts, cfg, source)
}

/**
 * GET /tv/{id}/season/{n}（+append_to_response）— 季详情（逐集 + 季海报，ADR-207 D-207-3）。
 * 失败/404 返回 null（valid negative）；调用方据 null 决定降级——季 REST 失败时仍可保已确定的
 * season exact ref，仅跳逐集/季海报（D-207-10）。埋点 target=`{id}/season/{n}` 便于按季区分采集记录。
 */
export async function getTvSeasonDetail(
  seriesId: number, seasonNumber: number, opts?: TmdbDetailOptions, cfg?: TmdbClientConfig, source?: FetchSource | null,
): Promise<TmdbSeasonDetail | null> {
  return getDetailAt<TmdbSeasonDetail>(
    `/tv/${seriesId}/season/${seasonNumber}`, `${seriesId}/season/${seasonNumber}`, opts, cfg, source,
  )
}

/** kind detail 便捷封装（path=`/{kind}/{id}`、target=id），委托 getDetailAt 单一降级+埋点真源。 */
async function getDetail<R>(
  kind: 'movie' | 'tv', id: number, opts: TmdbDetailOptions | undefined,
  cfg: TmdbClientConfig | undefined, source: FetchSource | null | undefined,
): Promise<R | null> {
  return getDetailAt<R>(`/${kind}/${id}`, String(id), opts, cfg, source)
}

/**
 * GET {path}（+append_to_response）核心：失败/404→null（valid negative，对齐 bangumi.getSubject）。
 * getMovieDetail/getTvDetail/getTvSeasonDetail 共用此单一降级+埋点真源（DRY）。
 */
async function getDetailAt<R>(
  path: string, target: string, opts: TmdbDetailOptions | undefined,
  cfg: TmdbClientConfig | undefined, source: FetchSource | null | undefined,
): Promise<R | null> {
  const startedAt = Date.now()
  try {
    const value = await tmdbGet<R>(path, {
      language: opts?.language ?? cfg?.language,
      append_to_response: opts?.append?.length ? opts.append.join(',') : undefined,
    }, cfg)
    await recordTmdbFetch('detail', 'ok', source ?? null, target, 1, Date.now() - startedAt)
    return value
  } catch (err) {
    const status = statusForGetError(err)
    await recordTmdbFetch('detail', status, source ?? null, target, 0, Date.now() - startedAt, status === 'ok' ? undefined : fetchErrorSummary(err))
    return null
  }
}

/** GET /configuration — image base URL / sizes（ADR-201 22839）；失败返回 null。 */
export async function getConfiguration(
  cfg?: TmdbClientConfig, source?: FetchSource | null,
): Promise<TmdbConfiguration | null> {
  const startedAt = Date.now()
  try {
    const value = await tmdbGet<TmdbConfiguration>('/configuration', {}, cfg)
    await recordTmdbFetch('detail', 'ok', source ?? null, 'configuration', 1, Date.now() - startedAt)
    return value
  } catch (err) {
    await recordTmdbFetch('detail', classifyFetchError(err), source ?? null, 'configuration', 0, Date.now() - startedAt, fetchErrorSummary(err))
    return null
  }
}

/** image base URL 稳定回退（TMDB 文档长期稳定值；configuration 不可用时使用，META-43）。 */
export const TMDB_IMAGE_BASE_FALLBACK = 'https://image.tmdb.org/t/p/'
let cachedImageBaseUrl: string | null = null

/**
 * configuration.images.secure_base_url（不含 size token，形如 `https://image.tmdb.org/t/p/`）。
 * 进程级缓存——首调拉 /configuration，失败回退稳定默认；后续命中缓存零网络（META-43）。
 * 构造完整图片 URL = `${base}${size}${file_path}`（file_path 以 `/` 开头）。
 */
export async function getImageBaseUrl(cfg?: TmdbClientConfig, source?: FetchSource | null): Promise<string> {
  if (cachedImageBaseUrl) return cachedImageBaseUrl
  const config = await getConfiguration(cfg, source)
  cachedImageBaseUrl = config?.images.secure_base_url || TMDB_IMAGE_BASE_FALLBACK
  return cachedImageBaseUrl
}

/** 测试用：重置 image base 缓存（仅供单测隔离，生产路径不调用）。 */
export function __resetImageBaseCacheForTest(): void {
  cachedImageBaseUrl = null
}
