/**
 * BangumiService.ts — Bangumi 匹配 + 元数据丰富业务编排（ADR-161）
 *
 * 职责：本地 dump 召回 → 置信度评分 → 写 video_external_refs → auto 命中拉 REST 详情 + 逐集
 *       → safeUpdate(catalog, 'bangumi') + upsert catalog_episodes + 回填 videos.episode_count
 * 不含 HTTP 细节（在 lib/bangumi.ts）；不直连 SQL（经 db/queries）。
 */

import type { Pool } from 'pg'
import type { BangumiCandidate } from '@/types'
import { MediaCatalogService } from './MediaCatalogService'
import type { CatalogUpdateData } from './MediaCatalogService'
import * as externalDataQueries from '@/api/db/queries/externalData'
import type { BangumiEntryMatch } from '@/api/db/queries/externalData'
import * as catalogEpisodeQueries from '@/api/db/queries/catalogEpisodes'
import * as videosQueries from '@/api/db/queries/videos'
import { getSubject, getEpisodes, searchSubjects, isBangumiApiConfigured } from '@/api/lib/bangumi'
import { normalizeTitle } from './TitleNormalizer'
import {
  computeLocalBangumiConfidence,
  mapSubjectToCatalogFields,
  mapEpisodes,
} from './BangumiService.utils'

function parseYear(date: string | null | undefined): number | null {
  if (!date) return null
  const m = date.match(/^(\d{4})/)
  return m ? Number.parseInt(m[1], 10) : null
}

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

    // auto_matched → 写 catalog + 逐集（显式传 bangumiId 走 rich 抓取）
    const result = await this.enrichCatalog(videoId, catalogId, best.bangumiId, best)
    return {
      matched: 'auto',
      bangumiSubjectId: best.bangumiId,
      confidence,
      episodes: result.episodes,
      degraded: result.degraded,
    }
  }

  /**
   * 后台人工确认：按显式 bangumiId 走 rich 抓取写 catalog（bangumi 源，不锁字段，ADR-161 Y2）。
   * 即使该 subject 不在本地 dump，也用 bangumiId 调 REST 详情；确实没写入任何内容时返回 updated:false，
   * 并且只有写入成功才记 manual_confirmed ref（避免对不存在 subject 的"假成功"，ADR-161 P1 修订）。
   */
  async confirmMatch(videoId: string, catalogId: string, bangumiId: number): Promise<{ updated: boolean }> {
    const entry = await externalDataQueries.findBangumiById(this.db, bangumiId)
    const result = await this.enrichCatalog(videoId, catalogId, bangumiId, entry)
    if (!result.wrote) return { updated: false }
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
    return { updated: true }
  }

  /**
   * 后台人工候选搜索（ADR-161 端点 2）。
   * 本地 dump 召回（有置信度，毫秒级）为主；keyword 显式搜索时 REST 兜底（confidence=0 标识非本地召回）。
   */
  async searchCandidates(input: {
    titleNorm: string
    year: number | null
    keyword?: string
  }): Promise<BangumiCandidate[]> {
    const out = new Map<number, BangumiCandidate>()

    const localNorm = input.keyword ? normalizeTitle(input.keyword) : input.titleNorm
    const locals = await externalDataQueries.findBangumiByTitleNorm(this.db, localNorm, input.year)
    for (const e of locals) {
      const { confidence } = computeLocalBangumiConfidence(e, input.year)
      out.set(e.bangumiId, {
        bangumiSubjectId: e.bangumiId,
        nameCn: e.titleCn,
        nameJp: e.titleJp,
        year: e.year,
        rating: e.rating,
        coverUrl: e.coverUrl,
        confidence,
      })
    }

    if (input.keyword && isBangumiApiConfigured()) {
      const items = await searchSubjects(input.keyword)
      for (const it of items) {
        if (out.has(it.id)) continue
        out.set(it.id, {
          bangumiSubjectId: it.id,
          nameCn: it.name_cn?.trim() || null,
          nameJp: it.name?.trim() || null,
          year: parseYear(it.date),
          rating: it.rating?.score ?? null,
          coverUrl: it.images?.large ?? it.images?.common ?? null,
          confidence: 0,
        })
      }
    }

    return [...out.values()].sort((a, b) => b.confidence - a.confidence)
  }

  // ── 内部 ─────────────────────────────────────────────────────────

  /**
   * 写 catalog（bangumi 源）+ 逐集。优先用显式 bangumiId 调 REST rich 详情；
   * Token 缺失/抓取失败时降级用本地 dump entry（entry 为 null 则无可写内容）。
   * 返回逐集写入数、是否降级、是否实际写入（wrote=false 表示既无 rich 也无 dump 字段可写）。
   */
  private async enrichCatalog(
    videoId: string,
    catalogId: string,
    bangumiId: number,
    entry: BangumiEntryMatch | null,
  ): Promise<{ episodes: number; degraded: boolean; wrote: boolean }> {
    let fields: CatalogUpdateData | null = null
    let episodeCount = 0
    let degraded = true

    if (isBangumiApiConfigured()) {
      const subject = await getSubject(bangumiId)
      if (subject) {
        fields = mapSubjectToCatalogFields(subject)
        degraded = false
        const eps = await getEpisodes(bangumiId)
        if (eps.length > 0) {
          episodeCount = await catalogEpisodeQueries.upsertCatalogEpisodes(this.db, catalogId, mapEpisodes(eps))
        }
        // 本篇集数（ADR-161 P1）：优先 wiki eps（本篇数）；否则数 type===0 本篇；
        // 不用 total_episodes（含 SP/OP/ED 章节，会高估用户侧剧集数）
        const mainCount = subject.eps && subject.eps > 0
          ? subject.eps
          : eps.filter((e) => e.type === 0).length
        if (mainCount > 0) await videosQueries.updateEpisodeCount(this.db, videoId, mainCount)
      }
    }

    // 降级：用本地 dump entry 拼最小字段集（entry 为 null 时无可写内容）
    if (!fields && entry) {
      fields = { bangumiSubjectId: entry.bangumiId }
      const title = entry.titleCn || entry.titleJp
      if (title) fields.title = title
      if (entry.titleJp) fields.titleOriginal = entry.titleJp
      if (entry.summary) fields.description = entry.summary
      if (entry.rating !== null) fields.rating = entry.rating
      if (entry.coverUrl) fields.coverUrl = entry.coverUrl
    }

    if (!fields) return { episodes: 0, degraded, wrote: false }

    const { updated } = await this.catalogService.safeUpdate(catalogId, fields, 'bangumi', {
      sourceRef: String(bangumiId),
    })
    return { episodes: episodeCount, degraded, wrote: updated !== null }
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
