/**
 * BangumiSeedService.ts — 反向建库：无源占位条目（ADR-161 决策 7）
 *
 * 职责：用 Bangumi dump 全量数据建「无源占位 media_catalog」（无 videos 行），
 *       等采集器后续按 title_norm+year+type 命中挂接填充。
 * 约束：批量场景仅走本地 dump（不打 REST API，规避 Bangumi 限流，ADR-161 决策 1）。
 *       不直连 SQL（经 db/queries）；占位 type 固定 'anime'（Y4）；默认跳过 nsfw（Y5，由 query 层过滤）。
 *
 * created/matched 计数精确性：不复用 MediaCatalogService.findOrCreate（其返回行无法区分
 * "本次插入" vs "并发/冲突命中既有行"）。本服务自行做两段去重 precheck（bangumi_id 精确 +
 * title_normalized+year+type 三元组——后者必需：媒体库 uq_catalog_title_year_type 是 *部分* 唯一
 * 索引，仅当全部外部 ID 为 NULL 时生效，带 bangumi_subject_id 的占位 INSERT 不受其约束，
 * 故须显式 SELECT 去重以免对既有采集 catalog 产生重复占位），再用 insertCatalog 的
 * `row | null` 返回值作为唯一可靠的"是否本次插入"信号（null = bangumi_subject_id 唯一冲突的并发竞态）。
 */

import type { Pool } from 'pg'
import * as externalDataQueries from '@/api/db/queries/externalData'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import type { BangumiGapQueryRow } from '@/api/db/queries/mediaCatalog'
import { normalizeMergeKey } from './TitleNormalizer'

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
  constructor(private db: Pool) {}

  /**
   * 批量建无源占位 catalog。遍历过滤后的 dump 条目，去重后插入。
   * - matched：已存在（bangumi_id 命中 / 三元组命中既有 catalog / INSERT 唯一冲突的并发竞态）。
   * - created：本次 INSERT 实际写入（insertCatalog 返回非 null）。
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

      // ① bangumi_id 精确去重
      const byBangumi = await catalogQueries.findCatalogByBangumiId(this.db, entry.bangumiId)
      if (byBangumi) {
        matched++
        continue
      }

      // ② 三元组去重（部分唯一索引不覆盖带 bangumi_id 的 INSERT，须显式 SELECT 防重复占位）
      const titleNormalized = normalizeMergeKey(title)
      const byNorm = await catalogQueries.findCatalogByNormalizedKey(this.db, titleNormalized, entry.year, 'anime')
      if (byNorm) {
        matched++
        continue
      }

      // ③ 插入；row=本次写入 / null=bangumi_id 唯一冲突的并发竞态（既有行，计 matched）
      const inserted = await catalogQueries.insertCatalog(this.db, {
        title,
        titleNormalized,
        titleOriginal: entry.titleJp ?? undefined,
        type: 'anime',
        year: entry.year,
        bangumiSubjectId: entry.bangumiId,
        metadataSource: 'bangumi',
        description: entry.summary ?? undefined,
        coverUrl: entry.coverUrl ?? undefined,
        rating: entry.rating ?? undefined,
      })
      if (inserted) created++
      else matched++
    }

    return { scanned: entries.length, created, matched }
  }

  /** 缺口清单分页（ADR-161 端点 5）。 */
  async listGaps(opts: { page: number; limit: number }): Promise<ListGapsResult> {
    const offset = (opts.page - 1) * opts.limit
    const [rows, total] = await Promise.all([
      catalogQueries.listBangumiGaps(this.db, { limit: opts.limit, offset }),
      catalogQueries.countBangumiGaps(this.db),
    ])
    return { rows, total }
  }
}
