/**
 * crawlerWorker.sources.ts — 资源站配置工具 + 采集 Job 类型定义
 * 从 crawlerWorker.ts 拆出，供 worker 主流程和 route 层共用
 */

import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import type { CrawlerSource } from '@/api/services/CrawlerService'

/** 从 CRAWLER_SOURCES 环境变量解析资源站配置（降级用） */
export function parseCrawlerSources(env?: string): CrawlerSource[] {
  if (!env) return []
  try {
    return JSON.parse(env) as CrawlerSource[]
  } catch {
    return []
  }
}

/**
 * 获取启用的资源站列表：
 * 优先从 crawler_sites 表读取，若表为空则降级到 CRAWLER_SOURCES 环境变量
 */
export async function getEnabledSources(db: import('pg').Pool): Promise<CrawlerSource[]> {
  const dbSites = await crawlerSitesQueries.listEnabledCrawlerSites(db)
  if (dbSites.length > 0) {
    return dbSites.map((s) => ({
      name:   s.key,
      base:   s.apiUrl,
      format: s.format,
      ingestPolicy: {
        allow_auto_publish: s.ingestPolicy.allow_auto_publish,
        source_update: s.ingestPolicy.source_update,
      },
    }))
  }
  return parseCrawlerSources(process.env.CRAWLER_SOURCES)
}

// ── 任务类型 ──────────────────────────────────────────────────────

export type CrawlJobType = 'full-crawl' | 'incremental-crawl'

/** CRAWLER-01: 采集模式（batch=批量/定时，keyword=关键词搜索，source-refetch=单视频补源） */
export type CrawlJobMode = 'batch' | 'keyword' | 'source-refetch'

export interface CrawlJobData {
  type: CrawlJobType
  siteKey: string
  taskId: string
  runId: string
  hoursAgo?: number
  crawlMode?: CrawlJobMode
  keyword?: string
  targetVideoId?: string
  previewOnly?: boolean
  targetSiteKeys?: string[]
}

export interface CrawlJobResult {
  type: CrawlJobType
  sites: string[]
  videosUpserted: number
  sourcesUpserted: number
  errors: number
  durationMs: number
}
