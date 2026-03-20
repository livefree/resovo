/**
 * CrawlerService.ts — 苹果CMS采集服务
 * CRAWLER-02: 拉取接口、解析、字段映射、写库、ES 同步触发
 * ADR-008: 苹果CMS标准接口
 * ADR-009: 封面图存外链，不下载
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
import { parseXmlResponse, parseJsonResponse, parseVodItem } from './SourceParserService'
import { normalizeTitle } from './TitleNormalizer'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import * as sourcesQueries from '@/api/db/queries/sources'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import * as videosQueries from '@/api/db/queries/videos'
import { nanoid } from 'nanoid'
import { config } from '@/api/lib/config'

// ── 资源站配置 ────────────────────────────────────────────────────

export interface CrawlerSource {
  name: string
  base: string
  format: 'xml' | 'json'
}

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
export async function getEnabledSources(db: Pool): Promise<CrawlerSource[]> {
  const dbSites = await crawlerSitesQueries.listEnabledCrawlerSites(db)
  if (dbSites.length > 0) {
    return dbSites.map((s) => ({
      name:   s.key,
      base:   s.apiUrl,
      format: s.format,
    }))
  }
  return parseCrawlerSources(process.env.CRAWLER_SOURCES)
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
    options: { page?: number; hoursAgo?: number; keyword?: string; ids?: string } = {}
  ): string {
    const fmt = format === 'xml' ? 'xml' : 'json'
    // 数据库中存储的可能是完整 API 路径（如 /api.php/provide/vod），需先剥离再重建
    const cleanBase = base.replace(/\/api\.php\b.*$/, '').replace(/\/$/, '')
    let url = `${cleanBase}/api.php/provide/vod/at/${fmt}`
    const params: string[] = []

    if (options.ids) {
      params.push(`ac=detail`)
      params.push(`ids=${options.ids}`)
    } else {
      if (options.page && options.page > 1) {
        params.push(`pg=${options.page}`)
      }
      if (options.hoursAgo) {
        params.push(`h=${options.hoursAgo}`)
      }
      if (options.keyword) {
        params.push(`wd=${encodeURIComponent(options.keyword)}`)
      }
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`
    }
    return url
  }

  /** 通用 HTTP 取文本 */
  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Resovo-Crawler/1.0' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
    return res.text()
  }

  /**
   * 拉取并解析单页数据
   * 苹果CMS listing 接口不含 vod_play_url，需二次调用 ac=detail 获取播放源
   */
  async fetchPage(
    source: CrawlerSource,
    options: { page?: number; hoursAgo?: number } = {}
  ): Promise<ReturnType<typeof parseVodItem>[]> {
    // Step 1: 获取列表，拿到 vod_id 列表
    const listUrl = this.buildApiUrl(source.base, source.format, options)
    const listBody = await this.fetchText(listUrl)
    const listItems =
      source.format === 'xml' ? parseXmlResponse(listBody) : parseJsonResponse(listBody)

    if (listItems.length === 0) return []

    // Step 2: 批量获取详情（含 vod_play_url）
    const ids = listItems.map((item) => String(item.vod_id)).join(',')
    const detailUrl = this.buildApiUrl(source.base, source.format, { ids })
    const detailBody = await this.fetchText(detailUrl)
    const detailItems =
      source.format === 'xml' ? parseXmlResponse(detailBody) : parseJsonResponse(detailBody)

    // 优先使用详情数据，回退到列表数据（保持兼容性）
    const detailMap = new Map(detailItems.map((item) => [String(item.vod_id), item]))
    return listItems.map((listItem) => {
      const detail = detailMap.get(String(listItem.vod_id)) ?? listItem
      return parseVodItem(detail)
    })
  }

  /**
   * 将单个解析结果写入数据库，并触发 ES 索引同步。
   *
   * 归并策略（CHG-38）：
   *   规则 A — match_key = (title_normalized, year, type)；type 不同不合并
   *   规则 B — TitleNormalizer 生成 title_normalized
   *   规则 C — 将 title / titleEn 写入 video_aliases（INSERT IGNORE）
   *   规则 D — metadata_source 优先级 tmdb(4) > douban(3) > manual(2) > crawler(1)；低优先级不覆盖高优先级元数据
   *   规则 E — sources ON CONFLICT DO NOTHING（不覆盖已有播放源）
   */
  async upsertVideo(
    parsed: ReturnType<typeof parseVodItem>
  ): Promise<{ videoId: string; sourcesUpserted: number }> {
    const { video, sources } = parsed

    // 规则 B: 标准化标题
    const titleNormalized = normalizeTitle(video.title)
    const incomingPriority = videosQueries.METADATA_SOURCE_PRIORITY['crawler']

    // 规则 A: 按 (title_normalized, year, type) 查找已有视频
    const existing = await videosQueries.findVideoByNormalizedKey(
      this.db,
      titleNormalized,
      video.year,
      video.type
    )

    let videoId: string
    let isNew = false

    if (existing) {
      // 已存在：规则 D — 低优先级（crawler）不覆盖高优先级元数据
      videoId = existing.id
      const existingPriority = videosQueries.METADATA_SOURCE_PRIORITY[existing.metadataSource] ?? 0
      // crawler 采集优先级最低，不做元数据覆盖；若未来有 tmdb/douban 来源可在此扩展
      void existingPriority // 当前仅 crawler 来源，始终跳过覆盖
    } else {
      // 新建视频记录（含 title_normalized + metadata_source）
      isNew = true
      const shortId = nanoid(8)
      const autoPublish = config.AUTO_PUBLISH_CRAWLED === 'true'
      const episodeCount = sources.length > 0
        ? Math.max(...sources.map((s) => s.episodeNumber ?? 1))
        : 1
      const inserted = await videosQueries.insertCrawledVideo(this.db, {
        shortId,
        title: video.title,
        titleNormalized,
        titleEn: video.titleEn,
        coverUrl: video.coverUrl,   // ADR-009: 存外链
        type: video.type,
        category: video.category,
        year: video.year,
        country: video.country,
        cast: video.cast,
        director: video.director,
        writers: video.writers,
        description: video.description,
        status: video.status,
        episodeCount,
        isPublished: autoPublish,
        metadataSource: 'crawler',
      })
      videoId = inserted.id
    }

    // 规则 C: 写入别名（title + titleEn，INSERT IGNORE）
    const aliases: string[] = [video.title]
    if (video.titleEn) aliases.push(video.titleEn)
    await videosQueries.upsertVideoAliases(this.db, videoId, aliases)

    // 规则 E: Upsert 播放源（ON CONFLICT DO NOTHING）
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

    // 新建视频才触发 ES 索引（异步，不等待）
    if (isNew) void this.indexToES(videoId)

    // 规则 D 参考：当前来源始终为 crawler（priority=1），未来可传入 incomingPriority
    void incomingPriority

    return { videoId, sourcesUpserted }
  }

  /**
   * 将视频数据同步到 Elasticsearch
   */
  private async indexToES(videoId: string): Promise<void> {
    try {
      const result = await this.db.query<{
        id: string; short_id: string; slug: string | null
        title: string; title_en: string | null; cover_url: string | null
        type: string; category: string | null; year: number | null
        country: string | null; episode_count: number
        rating: number | null; status: string; is_published: boolean
      }>(
        `SELECT id, short_id, slug, title, title_en, cover_url,
                type, category, year, country, episode_count,
                rating, status, is_published
         FROM videos WHERE id = $1`,
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
          slug: row.slug,
          title: row.title,
          title_en: row.title_en,
          cover_url: row.cover_url,
          type: row.type,
          category: row.category,
          year: row.year,
          country: row.country,
          episode_count: row.episode_count,
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
   * 重新索引所有已发布视频（修复 ES 文档字段缺失时使用）
   */
  async reindexAll(): Promise<{ indexed: number; errors: number }> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM videos WHERE deleted_at IS NULL ORDER BY created_at DESC`
    )
    let indexed = 0
    let errors = 0
    for (const row of result.rows) {
      try {
        await this.indexToES(row.id)
        indexed++
      } catch {
        errors++
      }
    }
    return { indexed, errors }
  }

  /**
   * 增量或全量采集单个资源站
   */
  async crawl(
    source: CrawlerSource,
    options: { hoursAgo?: number; taskType?: 'full-crawl' | 'incremental-crawl'; taskId?: string } = {}
  ): Promise<CrawlResult> {
    const taskId =
      options.taskId ??
      (
        await crawlerTasksQueries.createTask(this.db, {
          type: options.taskType ?? (options.hoursAgo ? 'incremental-crawl' : 'full-crawl'),
          sourceSite: source.name,
          targetUrl: source.base,
        })
      ).id

    let videosUpserted = 0
    let sourcesUpserted = 0
    let errors = 0
    let page = 1
    let processed = 0
    let lastProgressAt = 0

    const pushProgress = async () => {
      const now = Date.now()
      if (now - lastProgressAt < 2000 && processed % 20 !== 0) return
      lastProgressAt = now
      await crawlerTasksQueries.updateTaskProgress(this.db, taskId, {
        videosUpserted,
        sourcesUpserted,
        errors,
        pages: Math.max(page - 1, 0),
        durationMs: Math.max(now - startAt, 0),
      })
    }
    const startAt = Date.now()

    try {
      await crawlerTasksQueries.updateTaskStatus(this.db, taskId, 'running')

      while (true) {
        const items = await this.fetchPage(source, { page, hoursAgo: options.hoursAgo })
        if (items.length === 0) break

        for (const parsed of items) {
          try {
            const { sourcesUpserted: s } = await this.upsertVideo(parsed)
            videosUpserted++
            sourcesUpserted += s
            processed++
            await pushProgress()
          } catch (err) {
            errors++
            processed++
            const message = err instanceof Error ? err.message : String(err)
            process.stderr.write(
              `[CrawlerService] upsert failed for "${parsed.video.title}": ${message}\n`
            )
            await pushProgress()
          }
        }

        page++
        await pushProgress()
        // 增量模式单页即可（仅最近更新）
        if (options.hoursAgo) break
      }

      await crawlerTasksQueries.updateTaskStatus(this.db, taskId, 'done', {
        videosUpserted,
        sourcesUpserted,
        errors,
        pages: page - 1,
      })
    } catch (err) {
      errors++
      await crawlerTasksQueries.updateTaskStatus(this.db, taskId, 'failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return { sourceSite: source.name, page: page - 1, videosUpserted, sourcesUpserted, errors }
  }
}
