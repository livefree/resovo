/**
 * doubanAdapter.ts — 豆瓣详情 Adapter 包装层
 *
 * 将 douban-adapter 包（external-adapter/douban-adapter）接入主工程。
 * 提供比旧 douban.ts 更完整的字段（23+ 字段，含 screenwriters/genres/languages 等）。
 *
 * 用法：
 *   import { getDoubanDetailRich } from '@/api/lib/doubanAdapter'
 *   const detail = await getDoubanDetailRich('12345678')
 */

import {
  createHostRuntime,
  createDoubanDetailsService,
  createDoubanResolverService,
  createDoubanSubjectCollectionService,
} from 'douban-adapter'
import type {
  DoubanSubjectDetails,
  DoubanResolvedCandidate,
  DoubanCollectionItemsResult,
} from 'douban-adapter'
import type { ProviderCapability } from '@resovo/types'
import {
  recordFetch,
  classifyFetchError,
  fetchErrorSummary,
} from '@/api/lib/external-fetch-recorder'
import type { FetchSource } from '@/api/db/queries/external-fetch-log'

export type { DoubanSubjectDetails, DoubanResolvedCandidate, DoubanCollectionItemsResult }

// ── 创建 runtime（无 cookie、无 Puppeteer、无缓存） ───────────────

/** 请求超时（ms）：豆瓣挂起时避免请求无限等待（搜索/详情两路统一兜底） */
const FETCH_TIMEOUT_MS = 10_000

/**
 * fetch 包装：调用方未自带 signal 时注入 AbortSignal.timeout 超时。
 * resolver/details 服务均不传 signal → 恢复旧 douban.ts 的超时保护并扩展到详情路径。
 */
function fetchWithTimeout(
  input: Parameters<typeof globalThis.fetch>[0],
  init?: RequestInit,
): Promise<Response> {
  if (init?.signal) return globalThis.fetch(input, init)
  return globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
}

function createBasicRuntime() {
  return createHostRuntime({
    fetch: fetchWithTimeout,
    getDoubanConfig: async () => ({}),
    fetchWithVerification: fetchWithTimeout,
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: (msg: string, meta?: Record<string, unknown>) =>
        process.stderr.write(`[DoubanAdapter] WARN ${msg} ${JSON.stringify(meta ?? {})}\n`),
      error: (msg: string, meta?: Record<string, unknown>) =>
        process.stderr.write(`[DoubanAdapter] ERROR ${msg} ${JSON.stringify(meta ?? {})}\n`),
    },
  })
}

let _service: ReturnType<typeof createDoubanDetailsService> | null = null

function getService() {
  if (!_service) {
    _service = createDoubanDetailsService(createBasicRuntime())
  }
  return _service
}

// DoubanResolverRuntime 是 DoubanDetailsRuntime 的子集（仅需 fetchWithVerification+logger），
// 故 createBasicRuntime() 同一 runtime 可同时喂详情与 resolver 服务。
let _resolver: ReturnType<typeof createDoubanResolverService> | null = null

function getResolver() {
  if (!_resolver) {
    _resolver = createDoubanResolverService(createBasicRuntime())
  }
  return _resolver
}

// subject_collection 服务 runtime 仅需 FetchPort+logger，createBasicRuntime 超集兼容。
let _collection: ReturnType<typeof createDoubanSubjectCollectionService> | null = null

function getCollectionService() {
  if (!_collection) {
    _collection = createDoubanSubjectCollectionService(createBasicRuntime())
  }
  return _collection
}

// ── 采集埋点旁路（ADR-188 D-188-4）──────────────────────────────────
//
// 三公开函数是豆瓣在线抓取的**真实 HTTP 出口**（resolver/details/collection service 内部 fetch）。
// 在此统一埋点 → 无论调用方是 enrich / collections worker / admin search 均不漏点、不重复计
// （lib/douban.searchDouban 委托 searchDoubanRich，故只在此埋、不在 lib/douban 重复埋）。
// method 恒 'scrape'（豆瓣无公共 API）；source 由调用方传（出口不知谁调）；await + 吞错纯旁路。

/**
 * 包裹一次豆瓣在线抓取：计时 + 成功/失败旁路埋点，返回值/降级语义与原函数逐字一致。
 */
async function withDoubanFetchRecord<T>(
  operation: ProviderCapability,
  target: string,
  source: FetchSource | null | undefined,
  count: (result: T) => number,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await fn()
    await recordFetch({
      provider: 'douban',
      operation,
      method: 'scrape',
      status: 'ok',
      source: source ?? null,
      target,
      itemCount: count(result),
      durationMs: Date.now() - startedAt,
    })
    return result
  } catch (err) {
    await recordFetch({
      provider: 'douban',
      operation,
      method: 'scrape',
      status: classifyFetchError(err),
      source: source ?? null,
      target,
      itemCount: 0,
      durationMs: Date.now() - startedAt,
      error: fetchErrorSummary(err),
    })
    return fallback
  }
}

// ── 公开 API ────────────────────────────────────────────────────────

/**
 * 获取豆瓣影视详情（丰富字段版本）
 * 返回 null 表示 ID 无效或抓取失败。埋点 operation='detail'（成功但无 data → ok + item_count 0）。
 */
export async function getDoubanDetailRich(
  doubanId: string,
  source?: FetchSource | null,
): Promise<DoubanSubjectDetails | null> {
  return withDoubanFetchRecord<DoubanSubjectDetails | null>(
    'detail',
    doubanId,
    source,
    (data) => (data ? 1 : 0),
    async () => (await getService().getById(doubanId)).data ?? null,
    null,
  )
}

/**
 * 搜索豆瓣影视候选（resolver，走 search.douban.com `window.__DATA__`）。
 * 返回按 title/year/type 加权排序的候选列表；query/网络/解析失败统一降级 `[]`，
 * 由调用方决定 no_match 语义（resolver 内部 parse 失败会抛 DoubanError，此处吸收）。
 * 埋点 operation='search'。
 */
export async function searchDoubanRich(
  query: string,
  year?: number,
  source?: FetchSource | null,
): Promise<DoubanResolvedCandidate[]> {
  return withDoubanFetchRecord<DoubanResolvedCandidate[]>(
    'search',
    query,
    source,
    (candidates) => candidates.length,
    async () => (await getResolver().searchSubjects({ query, year })).candidates,
    [],
  )
}

/**
 * 拉取豆瓣合集（subject_collection）单页条目（ADR-187）。
 * 返回 `{ collection, total, items }`；网络/解析失败返回 null——
 * **区分** null（抓取失败，调用方记 failed 保留旧数据）与 `items:[]`（成功但空，触发 empty_guard 判定）。
 * 埋点 operation='collection'（target=collection key；分页多页各记一行）。
 */
export async function getDoubanCollectionItems(
  collection: string,
  start = 0,
  count = 50,
  source?: FetchSource | null,
): Promise<DoubanCollectionItemsResult | null> {
  return withDoubanFetchRecord<DoubanCollectionItemsResult | null>(
    'collection',
    collection,
    source,
    (result) => (result ? result.items.length : 0),
    async () => await getCollectionService().getItems({ collection, start, count }),
    null,
  )
}
