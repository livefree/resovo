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
} from 'douban-adapter'
import type { DoubanSubjectDetails, DoubanResolvedCandidate } from 'douban-adapter'

export type { DoubanSubjectDetails, DoubanResolvedCandidate }

// ── 创建 runtime（无 cookie、无 Puppeteer、无缓存） ───────────────

function createBasicRuntime() {
  return createHostRuntime({
    fetch: globalThis.fetch.bind(globalThis),
    getDoubanConfig: async () => ({}),
    fetchWithVerification: (url: string, init?: RequestInit) =>
      globalThis.fetch(url, init),
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

// ── 公开 API ────────────────────────────────────────────────────────

/**
 * 获取豆瓣影视详情（丰富字段版本）
 * 返回 null 表示 ID 无效或抓取失败
 */
export async function getDoubanDetailRich(
  doubanId: string
): Promise<DoubanSubjectDetails | null> {
  try {
    const response = await getService().getById(doubanId)
    return response.data ?? null
  } catch {
    return null
  }
}

/**
 * 搜索豆瓣影视候选（resolver，走 search.douban.com `window.__DATA__`）。
 * 返回按 title/year/type 加权排序的候选列表；query/网络/解析失败统一降级 `[]`，
 * 由调用方决定 no_match 语义（resolver 内部 parse 失败会抛 DoubanError，此处吸收）。
 */
export async function searchDoubanRich(
  query: string,
  year?: number
): Promise<DoubanResolvedCandidate[]> {
  try {
    const result = await getResolver().searchSubjects({ query, year })
    return result.candidates
  } catch {
    return []
  }
}
