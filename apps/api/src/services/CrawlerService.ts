/**
 * CrawlerService.ts — 苹果CMS采集服务
 * CRAWLER-02: 拉取接口、解析、字段映射、写库、ES 同步触发
 * ADR-008: 苹果CMS标准接口
 * ADR-009: 封面图存外链，不下载
 * CHG-401: ES 同步改用 VideoIndexSyncService
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
import { parseXmlResponse, parseJsonResponse, parseVodItem } from './SourceParserService'
import { isPinyinTitle } from './PinyinDetector'
import { normalizeMergeKey } from './TitleNormalizer'
import { buildStandardVideoTitle } from './TitleIdentityParser'
import { resolveSourceLanguages } from './SourceLanguageResolver'
import { MediaCatalogService } from './MediaCatalogService'
import { VideoIndexSyncService } from './VideoIndexSyncService'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import * as sourcesQueries from '@/api/db/queries/sources'
import * as videosQueries from '@/api/db/queries/videos'
import { recordTitleObservation } from '@/api/db/queries/titleObservations'
import { buildTitleObservation } from './titleObservation.builder'
import { runIngestShadowScoring } from './identity/ingestShadow'
import { baseLogger } from '@/api/lib/logger'
import { generateShortId } from '@/api/lib/short-id'
import { config } from '@/api/lib/config'
import { enrichmentQueue, imageHealthQueue } from '@/api/lib/queue'

// ── 常量 ──────────────────────────────────────────────────────────

/**
 * Fix-2A (R3): 增量/关键词模式截断告警阈值。
 * 若首页返回条数 >= 此值，说明站点活跃且很可能有后续页，
 * 但当前仅取首页 → emit 'crawl.page.truncated' warn。
 */
const CRAWL_PAGE_MIN_FOR_TRUNCATION_WARN = 10

// CHG-VIR-10：ingest shadow 结构化日志（形态 C / D-105a-16），logging-rules §4 child 范式
const ingestShadowLog = baseLogger.child({ module: 'ingest-shadow' })

// ── 资源站配置 ────────────────────────────────────────────────────

export interface CrawlerSource {
  name: string
  base: string
  format: 'xml' | 'json'
  /** CHG-203: 站点级采集策略，决定入库时的 review/visibility 状态 */
  ingestPolicy?: {
    allow_auto_publish: boolean
    /** CRAWLER-02: 'replace'（默认全量替换）| 'append_only'（仅追加，保留旧源） */
    source_update?: 'replace' | 'append_only'
  }
}

// 注：parseCrawlerSources / getEnabledSources 已迁移至 crawlerWorker.ts（CRAWLER-01）

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
  private readonly indexSync: VideoIndexSyncService

  constructor(
    protected db: Pool,
    private es: ESClient,
  ) {
    this.indexSync = new VideoIndexSyncService(db, es)
  }

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

  /** 通用 HTTP 取文本，可选外部 AbortSignal（与内置 30s 超时合并） */
  protected async fetchText(url: string, signal?: AbortSignal): Promise<string> {
    const timeoutSignal = AbortSignal.timeout(30_000)
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Resovo-Crawler/1.0' },
      signal: combinedSignal,
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
    options: { page?: number; hoursAgo?: number; keyword?: string; signal?: AbortSignal } = {}
  ): Promise<ReturnType<typeof parseVodItem>[]> {
    const { signal, ...fetchOptions } = options
    // Step 1: 获取列表，拿到 vod_id 列表
    const listUrl = this.buildApiUrl(source.base, source.format, fetchOptions)
    const listBody = await this.fetchText(listUrl, signal)
    const listItems =
      source.format === 'xml' ? parseXmlResponse(listBody) : parseJsonResponse(listBody)

    if (listItems.length === 0) return []

    // Step 2: 批量获取详情（含 vod_play_url）
    const ids = listItems.map((item) => String(item.vod_id)).join(',')
    const detailUrl = this.buildApiUrl(source.base, source.format, { ids })
    const detailBody = await this.fetchText(detailUrl, signal)
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
   * 新六步流程（CHG-366，三层架构）：
   *   Step 1 — TitleNormalizer 生成 title_normalized
   *   Step 2 — MediaCatalogService.findOrCreate：5 步匹配，找到或创建 media_catalog 条目
   *   Step 3 — 若 catalog 已有视频实例，复用该视频 ID，推进 episode_count
   *   Step 4 — 若无对应视频，创建新 videos 行并绑定 catalog_id
   *   Step 5 — 将 title/titleEn 写入 video_aliases 和 media_catalog_aliases
   *   Step 6 — upsert 播放源，触发 ES 索引
   */
  async upsertVideo(
    parsed: ReturnType<typeof parseVodItem>,
    ingestPolicy?: CrawlerSource['ingestPolicy'],
    siteKey?: string,
    emit?: (level: 'info' | 'warn' | 'error', stage: string, message: string, details?: Record<string, unknown>) => Promise<void>,
  ): Promise<{ videoId: string; sourcesUpserted: number; sourcesKept: number; sourcesRemoved: number }> {
    const { video, sources } = parsed
    const incomingMaxEpisode = sources.length > 0
      ? Math.max(...sources.map((s) => s.episodeNumber ?? 1))
      : 1

    // Step 1: 标题标准化。季由 season_number 承载；剧场版等发布形态保留进归并标题。
    const standardTitle = buildStandardVideoTitle(video.title)
    const titleNormalized = normalizeMergeKey(standardTitle.identityTitle)

    // Step 2: 找到或创建 media_catalog 条目（爬虫来源，最低优先级）
    // CHG-VIR-10：withMatch 变体额外透出 matchedStep（仅供 ingest shadow 对比，绑定语义零变更）
    // CHG-VIR-11-D 拼音门禁（catalog 写入边界）：苹果CMS `vod_en`（英文名）约定填中文标题全拼
    // （slug，如 "tabiqiannanyouzhire"）。拼音冒充英文官方名会污染 catalog.title_en → knownNames
    // 标 official/en/conf=1.0 → 误导 TMDB tier-1 搜索 + 误拉分。仅在写 catalog 字段处过滤（真英文
    // 如 "The Avengers" 保留）；原始 video.titleEn 仍进 Step 5 video_aliases 兜底跨站召回不丢。
    const catalogTitleEn = video.titleEn && !isPinyinTitle(video.titleEn) ? video.titleEn : null
    const catalogService = new MediaCatalogService(this.db)
    const { catalog, matchedStep } = await catalogService.findOrCreateWithMatch({
      title: standardTitle.displayTitle,
      titleEn: catalogTitleEn,
      seasonNumber: standardTitle.seasonNumber,
      titleNormalized,
      type: video.type,
      year: video.year ?? null,
      country: video.country ?? null,
      description: video.description ?? null,
      coverUrl: video.coverUrl ?? null,
      genres: video.genre ? [video.genre] : [],
      director: video.director ?? [],
      cast: video.cast ?? [],
      writers: video.writers ?? [],
      status: video.status ?? 'completed',
      metadataSource: 'crawler',
    })

    // Step 3: 查找是否已有视频实例关联到此 catalog
    const existingVideoResult = await this.db.query<{ id: string }>(
      `SELECT id FROM videos WHERE catalog_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [catalog.id]
    )
    const existingVideo = existingVideoResult.rows[0]

    let videoId: string

    if (existingVideo) {
      // 已有视频：推进 episode_count（只增不减）
      videoId = existingVideo.id
      await videosQueries.bumpEpisodeCountIfHigher(this.db, videoId, incomingMaxEpisode)
      // crawler 优先级最低（1），不覆盖 catalog 元数据
    } else {
      // Step 4: 新建 videos 实例
      const shortId = generateShortId()
      const autoPublish = ingestPolicy
        ? ingestPolicy.allow_auto_publish
        : config.AUTO_PUBLISH_CRAWLED === 'true'
      const inserted = await videosQueries.insertCrawledVideo(this.db, {
        catalogId: catalog.id,
        shortId,
        title: standardTitle.displayTitle,
        type: video.type,
        sourceCategory: video.category ?? null,
        contentRating: video.contentRating ?? 'general',
        episodeCount: incomingMaxEpisode,
        isPublished: autoPublish,
        reviewStatus: autoPublish ? 'approved' : 'pending_review',
        visibilityStatus: autoPublish ? 'public' : 'internal',
        siteKey,
      })
      videoId = inserted.id

      // CHORE-09: 新建 video 时若有封面，立即入队 health-check + blurhash-extract
      // 防止 poster_status 永久留在 pending_review（Migration 048 默认值）
      if (video.coverUrl) {
        const url = video.coverUrl
        void imageHealthQueue.add('health-check', {
          type: 'health-check',
          catalogId: catalog.id,
          videoId,
          kind: 'poster',
          url,
        }).catch((err: unknown) => {
          process.stderr.write(
            `[CrawlerService] health-check enqueue failed for ${videoId}: ${err instanceof Error ? err.message : String(err)}\n`,
          )
        })
        void imageHealthQueue.add('blurhash-extract', {
          type: 'blurhash-extract',
          catalogId: catalog.id,
          videoId,
          kind: 'poster',
          url,
        }).catch((err: unknown) => {
          process.stderr.write(
            `[CrawlerService] blurhash-extract enqueue failed for ${videoId}: ${err instanceof Error ? err.message : String(err)}\n`,
          )
        })
      }
    }

    // Step 5: 写入别名（video_aliases 保持不变，供爬虫归并参考）
    const aliases = Array.from(
      new Set([standardTitle.displayTitle, video.title, video.titleEn].filter((v): v is string => Boolean(v))),
    )
    await videosQueries.upsertVideoAliases(this.db, videoId, aliases)

    // Phase 1b (CHG-VIR-6 / SEQ-20260602-03): shadow 写入 title_observations（去重聚合）。
    // 容错 fire-and-forget（设计 §1b 复核 F3）：纯观测、不参与归并决策，写失败不阻断采集入库主流程。
    void recordTitleObservation(
      this.db,
      buildTitleObservation(videoId, video.title, siteKey ?? null),
    ).catch((err: unknown) => {
      process.stderr.write(
        `[CrawlerService] title observation shadow failed for ${videoId}: ${err instanceof Error ? err.message : String(err)}\n`,
      )
    })

    // Phase 3 (CHG-VIR-10 / ADR-105a D-105a-16): ingest 旁路 shadow scoring。
    // 只写 shadow（identity_candidate trigger_source='ingest' + 结构化日志），不改 catalog_id
    // 绑定（R9 + D-105a-12）。fire-and-forget 容错同上：失败不阻断采集入库主流程。
    void runIngestShadowScoring(this.db, ingestShadowLog, {
      videoId,
      catalogId: catalog.id,
      matchedStep,
      title: video.title,
    }).catch((err: unknown) => {
      process.stderr.write(
        `[CrawlerService] ingest shadow scoring failed for ${videoId}: ${err instanceof Error ? err.message : String(err)}\n`,
      )
    })

    // Step 6: 写入播放源
    // CRAWLER-02: 默认全量替换策略（同站点全量替换）；ingest_policy.source_update='append_only' 退回旧策略
    // ADR-199 D-199-3: 语言双维度五级推断链逐行求值（行级线路名 token > vod 级
    // vod_lang/标题 facets > 地区先验）；同 vod 各行仅 sourceName 信号可产生行间差异
    const titleLanguageFacets = {
      audioLanguage: standardTitle.audioLanguage,
      subtitleMarker: standardTitle.subtitleMarker,
      subtitleLanguages: standardTitle.subtitleLanguages,
    }
    const sourceMappings = sources.map((s) => {
      const lang = resolveSourceLanguages({
        sourceName: s.sourceName,
        vodLang: video.vodLang,
        titleFacets: titleLanguageFacets,
        country: video.country,
      })
      return {
        videoId,
        episodeNumber: s.episodeNumber,
        sourceUrl: s.sourceUrl,
        sourceName: s.sourceName,
        type: s.type,
        sourceSiteKey: siteKey ?? null,
        audioLanguage: lang.audioLanguage,
        audioLanguageSource: lang.audioLanguageSource,
        subtitleLanguages: lang.subtitleLanguages,
        subtitleLanguageSource: lang.subtitleLanguageSource,
      }
    })

    const useAppendOnly = ingestPolicy?.source_update === 'append_only'
    let sourcesAdded = 0
    let sourcesKept = 0
    let sourcesRemoved = 0

    if (useAppendOnly || !siteKey) {
      // 旧策略：仅追加，不移除旧源
      const count = await sourcesQueries.upsertSources(this.db, sourceMappings)
      sourcesAdded = count
    } else if (sourceMappings.length === 0) {
      // Fix-1 (R1): 解析后无可用播放源 → 跳过 replace，防误删现有源
      // 上游接口偶发返回空 vod_play_url 时，视为"本次未携带源信息"而非"该站无源"
      await emit?.('warn', 'crawl.upsert.empty_sources', '解析后无可用播放源，跳过 replace 防止误删现有源', {
        videoId,
        siteKey,
        title: parsed.video.title,
      })
    } else {
      // 全量替换策略：同站点内容全量替换
      const stats = await sourcesQueries.replaceSourcesForSite(this.db, videoId, siteKey, sourceMappings)
      sourcesAdded = stats.sourcesAdded
      sourcesKept = stats.sourcesKept
      sourcesRemoved = stats.sourcesRemoved
    }

    void this.indexSync.syncVideo(videoId)
    // 入库完成后延迟 5 分钟触发元数据丰富（等待来源写库稳定）
    void enrichmentQueue.add(
      { videoId, catalogId: catalog.id, title: standardTitle.displayTitle, year: video.year ?? null, type: video.type },
      { delay: 300_000, jobId: `enrich-${videoId}` }
    ).catch((err: unknown) => {
      process.stderr.write(
        `[CrawlerService] enrichment enqueue failed for ${videoId}: ${err instanceof Error ? err.message : String(err)}\n`
      )
    })
    return { videoId, sourcesUpserted: sourcesAdded, sourcesKept, sourcesRemoved }
  }

  /**
   * 重新索引所有视频（修复 ES 文档字段缺失时使用）
   * CHG-401: 委托给 VideoIndexSyncService.syncVideo
   */
  async reindexAll(): Promise<{ indexed: number; errors: number }> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM videos WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10000`
    )
    let indexed = 0
    let errors = 0
    for (const row of result.rows) {
      try {
        await this.indexSync.syncVideo(row.id)
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
    options: {
      hoursAgo?: number
      /** CRAWLER-01: 关键词搜索采集，传入 keyword 时调用 buildApiUrl({ keyword }) */
      keyword?: string
      taskType?: 'full-crawl' | 'incremental-crawl'
      taskId?: string
      signal?: AbortSignal
      shouldStop?: () => false | 'cancel' | 'timeout' | 'pause' | Promise<false | 'cancel' | 'timeout' | 'pause'>
      onLog?: (
        input: {
          level?: 'info' | 'warn' | 'error'
          stage: string
          message: string
          details?: Record<string, unknown>
        }
      ) => void | Promise<void>
    } = {}
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
    let loggedUpsertErrors = 0
    const emit = async (
      level: 'info' | 'warn' | 'error',
      stage: string,
      message: string,
      details?: Record<string, unknown>,
    ) => {
      if (!options.onLog) return
      await options.onLog({ level, stage, message, details })
    }

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
      await emit('info', 'crawl.start', '开始采集', {
        source: source.name,
        type: options.taskType ?? (options.hoursAgo ? 'incremental-crawl' : 'full-crawl'),
        hoursAgo: options.hoursAgo ?? null,
        keyword: options.keyword ?? null,
      })
      await crawlerTasksQueries.updateTaskStatus(this.db, taskId, 'running')

      while (true) {
        const stopReasonBeforePage = options.shouldStop ? await options.shouldStop() : false
        if (stopReasonBeforePage === 'cancel') throw new Error('TASK_CANCELLED')
        if (stopReasonBeforePage === 'timeout') throw new Error('TASK_TIMEOUT')
        if (stopReasonBeforePage === 'pause') throw new Error('TASK_PAUSED')
        if (stopReasonBeforePage) {
          throw new Error('TASK_CANCELLED')
        }
        await emit('info', 'crawl.page.fetch.start', '开始拉取分页', { page })
        const items = await this.fetchPage(source, { page, hoursAgo: options.hoursAgo, keyword: options.keyword, signal: options.signal })
        await emit('info', 'crawl.page.fetch.done', '分页拉取完成', { page, items: items.length })
        if (items.length === 0) break

        for (const parsed of items) {
          const stopReasonBeforeItem = options.shouldStop ? await options.shouldStop() : false
          if (stopReasonBeforeItem === 'cancel') throw new Error('TASK_CANCELLED')
          if (stopReasonBeforeItem === 'timeout') throw new Error('TASK_TIMEOUT')
          if (stopReasonBeforeItem === 'pause') throw new Error('TASK_PAUSED')
          if (stopReasonBeforeItem) {
            throw new Error('TASK_CANCELLED')
          }

          // Fix-3 (R2): 前置过滤空 title — 避免 DB NOT NULL 报错堆积
          if (!parsed.video.title) {
            errors++
            processed++
            if (loggedUpsertErrors < 20) {
              loggedUpsertErrors++
              await emit('warn', 'crawl.skip.empty_title', '空 title 视频，跳过入库', {
                page,
                sourceVodId: parsed.video.sourceVodId,
              })
            }
            await pushProgress()
            continue
          }

          try {
            const { sourcesUpserted: s } = await this.upsertVideo(parsed, source.ingestPolicy, source.name, emit)
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
            if (loggedUpsertErrors < 20) {
              loggedUpsertErrors++
              await emit('warn', 'crawl.upsert.failed', '视频入库失败', {
                page,
                title: parsed.video.title,
                error: message,
              })
            }
            await pushProgress()
          }
        }

        page++
        await pushProgress()
        // 增量模式和关键词模式均只取第一页
        if (options.hoursAgo || options.keyword) {
          // Fix-2A (R3): 首页满载时 emit 截断告警，提示可能有后续页未采
          if (items.length >= CRAWL_PAGE_MIN_FOR_TRUNCATION_WARN) {
            await emit('warn', 'crawl.page.truncated', '本页已满，增量/关键词模式仅采首页，可能漏数据', {
              page: page - 1,
              items: items.length,
              mode: options.hoursAgo ? 'incremental' : 'keyword',
            })
          }
          break
        }
      }

      await crawlerTasksQueries.updateTaskStatus(this.db, taskId, 'done', {
        videosUpserted,
        sourcesUpserted,
        errors,
        pages: page - 1,
      })
      await emit('info', 'crawl.done', '采集完成', {
        videosUpserted,
        sourcesUpserted,
        errors,
        pages: page - 1,
        durationMs: Date.now() - startAt,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('TASK_CANCELLED')) {
        await emit('warn', 'crawl.cancelled', '采集已取消', { page, processed })
        throw err
      }
      if (message.includes('TASK_TIMEOUT')) {
        await emit('warn', 'crawl.timeout', '采集已超时', { page, processed })
        throw err
      }
      if (message.includes('TASK_PAUSED')) {
        await emit('info', 'crawl.paused', '采集已暂停，等待恢复', { page, processed })
        throw err
      }
      errors++
      await crawlerTasksQueries.updateTaskStatus(this.db, taskId, 'failed', {
        error: message,
      })
      await emit('error', 'crawl.failed', '采集失败', {
        error: message,
        page,
        processed,
      })
    }

    return { sourceSite: source.name, page: page - 1, videosUpserted, sourcesUpserted, errors }
  }

}
