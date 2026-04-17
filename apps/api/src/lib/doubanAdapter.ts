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
} from 'douban-adapter'
import type { DoubanSubjectDetails } from 'douban-adapter'

export type { DoubanSubjectDetails }

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
