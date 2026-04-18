/**
 * CrawlerPreviewService.ts — 关键词搜索采集预览（只读，不写库）
 * CRAWLER-03: previewKeywordSearch — 对各站点执行关键词搜索，返回预览列表
 * 继承 CrawlerService 以复用 buildApiUrl / fetchPage（HTTP 层）。
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
import { CrawlerService, type CrawlerSource } from './CrawlerService'

// ── 预览结果类型 ──────────────────────────────────────────────────

export interface KeywordPreviewItem {
  title: string
  year: number | null
  type: string | null
  sourceCount: number
  /** source_url HEAD 检验结果（快速探测，800ms 超时） */
  sourceStatus: 'ok' | 'error' | 'timeout' | 'unknown'
  siteKey: string
}

export interface KeywordPreviewResult {
  siteKey: string
  items: KeywordPreviewItem[]
  error: string | null
}

// ── CrawlerPreviewService ─────────────────────────────────────────

export class CrawlerPreviewService extends CrawlerService {
  constructor(db: Pool, es: ESClient) {
    super(db, es)
  }

  /**
   * CRAWLER-03: 关键词搜索预览
   * 对 sources 中每个站点执行关键词搜索，对第一个 source_url 做 HEAD 探测，
   * 返回各站点匹配视频预览列表（不写库）。
   */
  async previewKeywordSearch(
    keyword: string,
    sources: CrawlerSource[],
    type?: string
  ): Promise<KeywordPreviewResult[]> {
    const results: KeywordPreviewResult[] = []

    for (const source of sources) {
      try {
        const items = await this.fetchPage(source, { keyword })

        const previewItems: KeywordPreviewItem[] = []
        for (const parsed of items) {
          // 可选类型过滤
          if (type && parsed.video.type !== type) continue

          const firstSource = parsed.sources[0]
          let sourceStatus: KeywordPreviewItem['sourceStatus'] = 'unknown'

          if (firstSource?.sourceUrl) {
            sourceStatus = await this.probeSourceUrl(firstSource.sourceUrl)
          }

          previewItems.push({
            title: parsed.video.title,
            year: parsed.video.year ?? null,
            type: parsed.video.type ?? null,
            sourceCount: parsed.sources.length,
            sourceStatus,
            siteKey: source.name,
          })
        }

        results.push({ siteKey: source.name, items: previewItems, error: null })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        results.push({ siteKey: source.name, items: [], error: message })
      }
    }

    return results
  }

  /** 对 source_url 发出 HEAD 请求，800ms 超时，返回探测结果 */
  private async probeSourceUrl(url: string): Promise<KeywordPreviewItem['sourceStatus']> {
    try {
      const signal = AbortSignal.timeout(800)
      const res = await fetch(url, { method: 'HEAD', signal })
      return res.ok ? 'ok' : 'error'
    } catch (err) {
      const name = err instanceof Error ? (err as Error & { name?: string }).name ?? '' : ''
      const message = err instanceof Error ? err.message : String(err)
      if (name === 'TimeoutError' || name === 'AbortError' || message.includes('abort')) return 'timeout'
      return 'error'
    }
  }
}
