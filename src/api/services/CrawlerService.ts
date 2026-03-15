/**
 * CrawlerService.ts — 苹果CMS采集服务
 * CRAWLER-02: 拉取接口、解析、字段映射、写库、ES 同步触发
 * ADR-008: 苹果CMS标准接口
 * ADR-009: 封面图存外链，不下载
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
import { parseXmlResponse, parseJsonResponse, parseVodItem } from './SourceParserService'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import * as sourcesQueries from '@/api/db/queries/sources'
import { nanoid } from 'nanoid'

// ── 资源站配置 ────────────────────────────────────────────────────

export interface CrawlerSource {
  name: string
  base: string
  format: 'xml' | 'json'
}

/** 从 CRAWLER_SOURCES 环境变量解析资源站配置 */
export function parseCrawlerSources(env?: string): CrawlerSource[] {
  if (!env) return []
  try {
    return JSON.parse(env) as CrawlerSource[]
  } catch {
    return []
  }
}

// ── 采集结果 ──────────────────────────────────────────────────────

export interface CrawlResult {
  sourceSite: string
  page: number
  videosUpserted: number
  sourcesUpserted: number
  errors: number
}

// ── CrawlerService 类 ─────────────────────────────────────────────

export class CrawlerService {
  constructor(
    private db: Pool,
    private es: ESClient,
  ) {}

  /**
   * 构建苹果CMS接口 URL
   */
  buildApiUrl(
    base: string,
    format: 'xml' | 'json',
    options: { page?: number; hoursAgo?: number; keyword?: string } = {}
  ): string {
    const fmt = format === 'xml' ? 'xml' : 'json'
    let url = `${base}/api.php/provide/vod/at/${fmt}`
    const params: string[] = []

    if (options.page && options.page > 1) {
      params.push(`pg=${options.page}`)
    }
    if (options.hoursAgo) {
      params.push(`h=${options.hoursAgo}`)
    }
    if (options.keyword) {
      params.push(`wd=${encodeURIComponent(options.keyword)}`)
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`
    }
    return url
  }

  /**
   * 拉取并解析单页数据
   */
  async fetchPage(
    source: CrawlerSource,
    options: { page?: number; hoursAgo?: number } = {}
  ): Promise<ReturnType<typeof parseVodItem>[]> {
    const url = this.buildApiUrl(source.base, source.format, options)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Resovo-Crawler/1.0' },
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`)
    }

    const body = await res.text()
    const rawItems =
      source.format === 'xml' ? parseXmlResponse(body) : parseJsonResponse(body)

    return rawItems.map((item) => parseVodItem(item))
  }

  /**
   * 将单个解析结果写入数据库，并触发 ES 索引同步
   * 去重规则：同 title+year → 只追加播放源，不覆盖元数据
   */
  async upsertVideo(
    parsed: ReturnType<typeof parseVodItem>
  ): Promise<{ videoId: string; sourcesUpserted: number }> {
    const { video, sources } = parsed

    // 1. 按 title+year 去重查询
    const existing = await this.db.query<{ id: string }>(
      `SELECT id FROM videos
       WHERE title = $1 AND year IS NOT DISTINCT FROM $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [video.title, video.year]
    )

    let videoId: string

    if (existing.rows.length > 0) {
      // 已存在：不覆盖元数据
      videoId = existing.rows[0].id
    } else {
      // 新建视频记录
      const shortId = nanoid(8)
      const inserted = await this.db.query<{ id: string }>(
        `INSERT INTO videos
           (short_id, title, title_en, cover_url, type, category, year, country,
            cast, director, writers, description, status, episode_count,
            is_published, source_count)
         VALUES
           ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
            $14, true, 0)
         RETURNING id`,
        [
          shortId,
          video.title,
          video.titleEn,
          video.coverUrl,         // ADR-009: 存外链
          video.type,
          video.category,
          video.year,
          video.country,
          video.cast,
          video.director,
          video.writers,
          video.description,
          video.status,
          sources.length > 0 ? Math.max(...sources.map((s) => s.episodeNumber ?? 1)) : 1,
        ]
      )
      videoId = inserted.rows[0].id

      // 触发 ES 索引（异步，不等待）
      void this.indexToES(videoId)
    }

    // 2. Upsert 播放源（ADR-001: sourceUrl 是第三方直链）
    const sourcesUpserted = await sourcesQueries.upsertSources(
      this.db,
      sources.map((s) => ({
        videoId,
        episodeNumber: s.episodeNumber,
        sourceUrl: s.sourceUrl,
        sourceName: s.sourceName,
        type: s.type,
      }))
    )

    // 3. 更新 source_count 冗余字段
    await this.db.query(
      `UPDATE videos SET source_count = (
         SELECT COUNT(*) FROM video_sources
         WHERE video_id = $1 AND is_active = true AND deleted_at IS NULL
       ) WHERE id = $1`,
      [videoId]
    )

    return { videoId, sourcesUpserted }
  }

  /**
   * 将视频数据同步到 Elasticsearch
   */
  private async indexToES(videoId: string): Promise<void> {
    try {
      const result = await this.db.query<{
        id: string; short_id: string; title: string; title_en: string | null
        type: string; category: string | null; year: number | null
        rating: number | null; status: string; is_published: boolean
      }>(
        'SELECT id, short_id, title, title_en, type, category, year, rating, status, is_published FROM videos WHERE id = $1',
        [videoId]
      )
      if (!result.rows[0]) return

      const row = result.rows[0]
      await this.es.index({
        index: 'resovo_videos',
        id: row.id,
        document: {
          id: row.id,
          short_id: row.short_id,
          title: row.title,
          title_en: row.title_en,
          type: row.type,
          category: row.category,
          year: row.year,
          rating: row.rating,
          status: row.status,
          is_published: row.is_published,
          updated_at: new Date().toISOString(),
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[CrawlerService] ES index failed for ${videoId}: ${message}\n`)
    }
  }

  /**
   * 增量或全量采集单个资源站
   */
  async crawl(
    source: CrawlerSource,
    options: { hoursAgo?: number } = {}
  ): Promise<CrawlResult> {
    const taskRow = await crawlerTasksQueries.createTask(this.db, {
      sourceSite: source.name,
      targetUrl: source.base,
    })

    let videosUpserted = 0
    let sourcesUpserted = 0
    let errors = 0
    let page = 1

    try {
      await crawlerTasksQueries.updateTaskStatus(this.db, taskRow.id, 'running')

      while (true) {
        const items = await this.fetchPage(source, { page, hoursAgo: options.hoursAgo })
        if (items.length === 0) break

        for (const parsed of items) {
          try {
            const { sourcesUpserted: s } = await this.upsertVideo(parsed)
            videosUpserted++
            sourcesUpserted += s
          } catch (err) {
            errors++
            const message = err instanceof Error ? err.message : String(err)
            process.stderr.write(
              `[CrawlerService] upsert failed for "${parsed.video.title}": ${message}\n`
            )
          }
        }

        page++
        // 增量模式单页即可（仅最近更新）
        if (options.hoursAgo) break
      }

      await crawlerTasksQueries.updateTaskStatus(this.db, taskRow.id, 'done', {
        videosUpserted,
        sourcesUpserted,
        errors,
        pages: page - 1,
      })
    } catch (err) {
      errors++
      await crawlerTasksQueries.updateTaskStatus(this.db, taskRow.id, 'failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return { sourceSite: source.name, page: page - 1, videosUpserted, sourcesUpserted, errors }
  }
}
