/**
 * CrawlerRefetchService.ts — 单视频补源采集
 * CRAWLER-04: refetchSourcesForVideo — 以视频标题搜索各站点，
 *   title_normalized 相似度 >= 0.8 才写入，使用同站点全量替换策略。
 * 继承 CrawlerService 以复用 fetchPage（HTTP + 解析层）。
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
import { CrawlerService, type CrawlerSource } from './CrawlerService'
import { normalizeTitle } from './TitleNormalizer'
import * as videosQueries from '@/api/db/queries/videos'
import * as sourcesQueries from '@/api/db/queries/sources'
import { getEnabledSources } from '@/api/workers/crawlerWorker'

// ── 工具：字符 bigram Dice 相似度 ─────────────────────────────────

/**
 * 计算两个字符串的 bigram Dice 系数（0~1）。
 * 对短字符串（< 2 字符）使用精确匹配。
 */
export function titleSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0

  const bigrams = (s: string): Set<string> => {
    const result = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) result.add(s.slice(i, i + 2))
    return result
  }

  const aSet = bigrams(a)
  const bSet = bigrams(b)
  let intersection = 0
  for (const bg of aSet) {
    if (bSet.has(bg)) intersection++
  }
  return (2 * intersection) / (aSet.size + bSet.size)
}

// ── CrawlerRefetchService ─────────────────────────────────────────

export class CrawlerRefetchService extends CrawlerService {
  constructor(db: Pool, es: ESClient) {
    super(db, es)
  }

  /**
   * CRAWLER-04: 单视频补源采集
   *
   * 流程：
   *   1. 读取视频标题（findAdminVideoById）
   *   2. 获取启用站点（可按 siteKeys 过滤）
   *   3. 对每个站点以标题关键词搜索（fetchPage）
   *   4. 过滤 title_normalized 相似度 >= 0.8 的结果
   *   5. 取最佳匹配，用 replaceSourcesForSite 全量替换
   *   6. 记录未找到匹配的站点列表（notFound）
   */
  async refetchSourcesForVideo(
    videoId: string,
    siteKeys?: string[]
  ): Promise<{ sourcesAdded: number; notFound: string[] }> {
    const video = await videosQueries.findAdminVideoById(this.db, videoId)
    if (!video) throw new Error('VIDEO_NOT_FOUND')

    const titleNorm = normalizeTitle(video.title)

    let sources: CrawlerSource[] = await getEnabledSources(this.db)
    if (siteKeys && siteKeys.length > 0) {
      sources = sources.filter((s) => siteKeys.includes(s.name))
    }

    let sourcesAdded = 0
    const notFound: string[] = []

    for (const source of sources) {
      try {
        const items = await this.fetchPage(source, { keyword: video.title })

        // 按 title_normalized 相似度过滤，取得分最高者
        const scored = items
          .map((item) => ({
            item,
            score: titleSimilarity(titleNorm, normalizeTitle(item.video.title)),
          }))
          .filter((x) => x.score >= 0.8)
          .sort((a, b) => b.score - a.score)

        if (scored.length === 0) {
          notFound.push(source.name)
          continue
        }

        const best = scored[0].item
        const sourceMappings: sourcesQueries.UpsertSourceInput[] = best.sources.map((s) => ({
          videoId,
          episodeNumber: s.episodeNumber,
          sourceUrl: s.sourceUrl,
          sourceName: s.sourceName,
          type: s.type,
        }))

        if (sourceMappings.length > 0) {
          const stats = await sourcesQueries.replaceSourcesForSite(
            this.db,
            videoId,
            source.name,
            sourceMappings
          )
          sourcesAdded += stats.sourcesAdded
        }
      } catch {
        notFound.push(source.name)
      }
    }

    return { sourcesAdded, notFound }
  }
}
