/**
 * douban.ts — 豆瓣搜索客户端（非官方）
 * CHG-23: 管理员手动触发的元数据同步
 * CHG-DOUBAN-SEARCH-RESOLVER-WIRE: 失效端点 subject_suggest 切到 douban-adapter resolver
 *
 * 约束：
 * - 无官方 API：搜索经 douban-adapter resolver（search.douban.com `window.__DATA__`），
 *   详情经 doubanAdapter.getDoubanDetailRich（m.douban.com mobile-api），均不引入 cheerio/puppeteer
 * - 搜索失败时返回 []，由调用方决定 no_match 语义
 * - 公开签名/返回类型 SuggestItem[] 保持不变，下游消费方（DoubanService /
 *   DoubanService.utils.pickBestCandidate / MetadataEnrichService）零改动
 */

import { searchDoubanRich } from '@/api/lib/doubanAdapter'
import type { DoubanResolvedCandidate } from '@/api/lib/doubanAdapter'
import type { FetchSource } from '@/api/db/queries/external-fetch-log'

// ── 礼貌抓取 ──────────────────────────────────────────────────────

/** 随机延迟 200~500ms（礼貌抓取） */
function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 200 + Math.random() * 300))
}

// ── 搜索 ──────────────────────────────────────────────────────────

export interface SuggestItem {
  id: string
  title: string
  year: string
  sub_title: string
}

/**
 * resolver 候选 → SuggestItem（纯映射，导出供单测）。
 * year/sub_title 缺失按空串（保持旧 subject_suggest 契约：字段恒为 string）。
 */
export function mapResolvedToSuggest(candidate: DoubanResolvedCandidate): SuggestItem {
  return {
    id: candidate.id,
    title: candidate.title,
    year: candidate.year ?? '',
    sub_title: candidate.originalTitle ?? '',
  }
}

/**
 * 搜索豆瓣影视，返回候选列表。
 * 经 douban-adapter resolver：始终按 title 搜索，year 进入候选排序加权
 * （旧实现的"去年份重搜"回退不再需要——resolver 已统一处理 year 排序）。
 */
export async function searchDouban(
  title: string,
  year?: number,
  // 采集埋点归因（ADR-188 D-188-4）：透传给 searchDoubanRich（唯一 HTTP 出口埋点处），
  // 本函数仅委托不重复埋点（防双计）。
  source?: FetchSource | null,
): Promise<SuggestItem[]> {
  try {
    await delay()
    const candidates = await searchDoubanRich(title, year, source)
    return candidates.map(mapResolvedToSuggest)
  } catch {
    // 网络错误/超时统一降级为空结果，由上层决定 no_match 语义
    return []
  }
}
