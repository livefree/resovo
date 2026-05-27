/**
 * BangumiService.ts — Bangumi 匹配 + 元数据丰富业务编排（ADR-159）
 *
 * 职责：本地 dump 召回 → 置信度评分 → 写 video_external_refs → auto 命中拉 REST 详情 + 逐集
 *       → safeUpdate(catalog, 'bangumi') + upsert catalog_episodes + 回填 videos.episode_count
 * 不含 HTTP 细节（在 lib/bangumi.ts）；不直连 SQL（经 db/queries）。
 */

import type { Pool } from 'pg'
import { MediaCatalogService } from './MediaCatalogService'
import type { CatalogUpdateData } from './MediaCatalogService'
import * as externalDataQueries from '@/api/db/queries/externalData'
import type { BangumiEntryMatch } from '@/api/db/queries/externalData'
import * as catalogEpisodeQueries from '@/api/db/queries/catalogEpisodes'
import * as videosQueries from '@/api/db/queries/videos'
import { getSubject, getEpisodes, isBangumiApiConfigured } from '@/api/lib/bangumi'
import {
  computeLocalBangumiConfidence,
  mapSubjectToCatalogFields,
  mapEpisodes,
} from './BangumiService.utils'

// ── 阈值（复用豆瓣范式）───────────────────────────────────────────
const CONFIDENCE_AUTO_MATCH = 0.85
const CONFIDENCE_CANDIDATE = 0.6

// ── 结果类型 ───────────────────────────────────────────────────────
export type BangumiEnrichResult =
  | { matched: 'auto'; bangumiSubjectId: number; confidence: number; episodes: number; degraded: boolean }
  | { matched: 'candidate'; bangumiSubjectId: number; confidence: number }
  | { matched: 'none'; reason: 'no_local_match' | 'low_confidence' }

export interface MatchAndEnrichInput {
  videoId: string
  catalogId: string
  titleNorm: string
  year: number | null
}

export class BangumiService {
  private catalogService: MediaCatalogService

  /** catalogService 可注入复用（MetadataEnrichService 传入自身实例，避免重复构造） */
  constructor(private db: Pool, catalogService?: MediaCatalogService) {
    this.catalogService = catalogService ?? new MediaCatalogService(db)
  }

  /**
   * 对单视频做 Bangumi 匹配 + 丰富（供 MetadataEnrichService.step3 与后台手动调用）。
   * 仅本地 dump 召回；auto 命中后按需拉 REST 详情（Token 缺失/失败则降级用本地 dump 字段）。
   */
  async matchAndEnrich({ videoId, catalogId, titleNorm, year }: MatchAndEnrichInput): Promise<BangumiEnrichResult> {
    const matches = await externalDataQueries.findBangumiByTitleNorm(this.db, titleNorm, year)
    if (matches.length === 0) return { matched: 'none', reason: 'no_local_match' }

    const best = matches[0]
    const { confidence, breakdown } = computeLocalBangumiConfidence(best, year)
    if (confidence < CONFIDENCE_CANDIDATE) return { matched: 'none', reason: 'low_confidence' }

    const status = confidence >= CONFIDENCE_AUTO_MATCH ? 'auto_matched' : 'candidate'
    await this.writeRef(videoId, best.bangumiId, status, confidence, breakdown)

    if (status === 'candidate') {
      return { matched: 'candidate', bangumiSubjectId: best.bangumiId, confidence }
    }

    // auto_matched → 写 catalog + 逐集
    const episodes = await this.enrichCatalog(videoId, catalogId, best)
    return {
      matched: 'auto',
      bangumiSubjectId: best.bangumiId,
      confidence,
      episodes: episodes.count,
      degraded: episodes.degraded,
    }
  }

  /**
   * 后台人工确认：直接按 bangumiId 写 catalog（bangumi 源，不锁字段，ADR-159 Y2）+ 标记 ref manual_confirmed。
   * 返回是否实际更新。
   */
  async confirmMatch(videoId: string, catalogId: string, bangumiId: number): Promise<{ updated: boolean }> {
    const entry = await externalDataQueries.findBangumiById(this.db, bangumiId)
    await externalDataQueries.upsertVideoExternalRef(this.db, {
      videoId,
      provider: 'bangumi',
      externalId: String(bangumiId),
      matchStatus: 'manual_confirmed',
      matchMethod: 'manual',
      confidence: 1,
      isPrimary: true,
      linkedBy: 'moderator',
    })
    const result = await this.enrichCatalog(videoId, catalogId, entry)
    return { updated: result.count >= 0 }
  }

  // ── 内部 ─────────────────────────────────────────────────────────

  /**
   * 写 catalog（bangumi 源）+ 逐集。优先 REST rich 详情；Token 缺失/抓取失败则降级用本地 dump entry。
   * 返回逐集写入数与是否降级。
   */
  private async enrichCatalog(
    videoId: string,
    catalogId: string,
    entry: BangumiEntryMatch | null,
  ): Promise<{ count: number; degraded: boolean }> {
    const bangumiId = entry?.bangumiId
    let fields: CatalogUpdateData | null = null
    let episodeCount = 0
    let degraded = true

    if (bangumiId != null && isBangumiApiConfigured()) {
      const subject = await getSubject(bangumiId)
      if (subject) {
        fields = mapSubjectToCatalogFields(subject)
        degraded = false
        const eps = await getEpisodes(bangumiId)
        if (eps.length > 0) {
          episodeCount = await catalogEpisodeQueries.upsertCatalogEpisodes(this.db, catalogId, mapEpisodes(eps))
        }
        const total = subject.total_episodes || subject.eps || eps.length
        if (total > 0) await videosQueries.updateEpisodeCount(this.db, videoId, total)
      }
    }

    // 降级：用本地 dump entry 拼最小字段集
    if (!fields && entry) {
      fields = { bangumiSubjectId: entry.bangumiId }
      const title = entry.titleCn || entry.titleJp
      if (title) fields.title = title
      if (entry.titleJp) fields.titleOriginal = entry.titleJp
      if (entry.summary) fields.description = entry.summary
      if (entry.rating !== null) fields.rating = entry.rating
      if (entry.coverUrl) fields.coverUrl = entry.coverUrl
    }

    if (fields) {
      await this.catalogService.safeUpdate(catalogId, fields, 'bangumi', {
        sourceRef: bangumiId != null ? String(bangumiId) : undefined,
      })
    }

    return { count: episodeCount, degraded }
  }

  private async writeRef(
    videoId: string,
    bangumiId: number,
    matchStatus: 'auto_matched' | 'candidate',
    confidence: number,
    breakdown: Record<string, number>,
  ): Promise<void> {
    try {
      await externalDataQueries.upsertVideoExternalRef(this.db, {
        videoId,
        provider: 'bangumi',
        externalId: String(bangumiId),
        matchStatus,
        matchMethod: 'title_norm',
        confidence,
        isPrimary: matchStatus === 'auto_matched',
        linkedBy: 'auto',
        notes: JSON.stringify(breakdown),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[BangumiService] writeRef failed for ${videoId}: ${msg}\n`)
    }
  }
}
