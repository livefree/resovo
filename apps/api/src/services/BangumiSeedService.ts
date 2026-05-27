/**
 * BangumiSeedService.ts — 反向建库：无源占位条目（ADR-159 决策 7）
 *
 * 职责：用 Bangumi dump 全量数据建「无源占位 media_catalog」（无 videos 行），
 *       等采集器后续按 title_norm+year+type 命中挂接填充。
 * 约束：批量场景仅走本地 dump（不打 REST API，规避 Bangumi 限流，ADR-159 决策 1）。
 *       不直连 SQL（经 db/queries）；占位 type 固定 'anime'（Y4）；默认跳过 nsfw（Y5，由 query 层过滤）。
 */

import type { Pool } from 'pg'
import { MediaCatalogService } from './MediaCatalogService'
import * as externalDataQueries from '@/api/db/queries/externalData'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import type { BangumiGapQueryRow } from '@/api/db/queries/mediaCatalog'
import { normalizeTitle } from './TitleNormalizer'

export interface SeedPlaceholdersInput {
  minRank?: number | null
  year?: number | null
  limit: number
}

export interface SeedResult {
  scanned: number
  created: number
  matched: number
}

export interface ListGapsResult {
  rows: BangumiGapQueryRow[]
  total: number
}

export class BangumiSeedService {
  private catalogService: MediaCatalogService

  constructor(private db: Pool, catalogService?: MediaCatalogService) {
    this.catalogService = catalogService ?? new MediaCatalogService(db)
  }

  /**
   * 批量建无源占位 catalog。遍历过滤后的 dump 条目，对每条 findOrCreate。
   * 计数语义：
   * - matched：已存在（先按 bangumi_id 命中，或 findOrCreate 经 normalizedKey 命中既有 catalog 未 link bangumi_id，D-159-1）。
   * - created：新建占位。
   */
  async seedPlaceholders(input: SeedPlaceholdersInput): Promise<SeedResult> {
    const entries = await externalDataQueries.listBangumiEntriesForSeed(this.db, {
      minRank: input.minRank ?? null,
      year: input.year ?? null,
      limit: input.limit,
    })

    let created = 0
    let matched = 0

    for (const entry of entries) {
      const title = entry.titleCn || entry.titleJp
      if (!title) continue // 无标题无法建占位

      // 先按 bangumi_id 精确判存（避免把已 link 的条目误计为 created）
      const existing = await catalogQueries.findCatalogByBangumiId(this.db, entry.bangumiId)
      if (existing) {
        matched++
        continue
      }

      const row = await this.catalogService.findOrCreate({
        title,
        titleNormalized: normalizeTitle(title),
        titleOriginal: entry.titleJp ?? undefined,
        type: 'anime',
        year: entry.year,
        bangumiSubjectId: entry.bangumiId,
        metadataSource: 'bangumi',
        description: entry.summary ?? undefined,
        coverUrl: entry.coverUrl ?? undefined,
        rating: entry.rating ?? undefined,
      })

      // 新建占位的 bangumi_subject_id 必等于 entry；否则系经 normalizedKey 命中既有 catalog
      // （未 link bangumi_id，D-159-1 已知失配），计为 matched。
      if (row.bangumiSubjectId === entry.bangumiId) created++
      else matched++
    }

    return { scanned: entries.length, created, matched }
  }

  /** 缺口清单分页（ADR-159 端点 5）。 */
  async listGaps(opts: { page: number; limit: number }): Promise<ListGapsResult> {
    const offset = (opts.page - 1) * opts.limit
    const [rows, total] = await Promise.all([
      catalogQueries.listBangumiGaps(this.db, { limit: opts.limit, offset }),
      catalogQueries.countBangumiGaps(this.db),
    ])
    return { rows, total }
  }
}
