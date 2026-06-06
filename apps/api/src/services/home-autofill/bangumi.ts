/**
 * bangumi.ts — Bangumi 候选生成集成（ADR-183 D-183-4.2 / D-183-7.1）
 *
 * hot_anime 候选：**排序权威 = compareBangumiCandidates（rank ASC 主序，缺失
 * 排后组内 rating DESC）**——非 score 序（D-183-4.2 rank 裁定，与 douban 加权
 * 序的根本差异）。score 字段仅作解释展示值：rating/10 − 惩罚（同豆瓣常量），
 * 不参与排序。nsfw 硬过滤在 queries SQL 层（不入池，区别于 filtered 解释保留）。
 * 缺口建库复用 ADR-161 决策 7 BangumiSeedService——治理层只读透出。
 * 消费方 = homeAutofillWorker（CHG-HOME-AUTOFILL-REFRESH 卡接线）。
 */

import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { AutofillCandidate, ContentGap } from '@resovo/types'
import {
  listBangumiCandidateSourceRows,
  listBangumiGapSourceRows,
  type BangumiCandidateSourceRow,
  type BangumiGapSourceRow,
} from '@/api/db/queries/home-autofill-bangumi'
import {
  CANDIDATE_POOL_LIMIT,
  GAP_TOP_N,
  GAP_SCAN_WINDOW,
  PENALTY_MISSING_IMAGE,
  PENALTY_UNSTABLE_SOURCE,
} from './policy'
import { compareBangumiCandidates } from './score'
import { evaluateCandidateFilters } from './filters'

/** 源不稳定惩罚信号（douban 同口径：批量检验存在死源） */
function isUnstableSource(sourceCheckStatus: string): boolean {
  return sourceCheckStatus === 'partial' || sourceCheckStatus === 'all_dead'
}

/** 解释展示分（非排序依据）：rating/10 − 惩罚同豆瓣常量，下钳 0 */
function bangumiDisplayScore(
  rating: number | null,
  missingImage: boolean,
  unstableSource: boolean,
): number {
  let score = rating != null && rating > 0 ? Math.min(rating, 10) / 10 : 0
  if (missingImage) score -= PENALTY_MISSING_IMAGE
  if (unstableSource) score -= PENALTY_UNSTABLE_SOURCE
  return Math.max(0, score)
}

/**
 * 源行 → 候选（纯函数，导出供单测）。
 * rank ASC 主序排序（缺失排后）；AutofillCandidate.rank 仅未过滤条目占名次
 * （1 起），filtered 条目 rank=0 哨兵。brandLocaleVisible / hasImageFallback
 * 口径同 douban（D-182-3 首版全局 / 渲染级兜底非数据级信号）。
 */
export function buildBangumiCandidates(rows: readonly BangumiCandidateSourceRow[]): AutofillCandidate[] {
  const ordered = [...rows].sort((a, b) =>
    compareBangumiCandidates(
      { rank: a.bangumiRank, rating: a.bangumiRating },
      { rank: b.bangumiRank, rating: b.bangumiRating },
    ))

  let rank = 0
  return ordered.map((row) => {
    const filter = evaluateCandidateFilters({
      isPublished: row.isPublished,
      visibleOnFrontend: row.visibilityStatus === 'public',
      isAdult: row.contentRating === 'adult' || row.siteIsAdult,
      playableSourceCount: row.activeSourceCount,
      hasImage: row.coverUrl != null && row.coverUrl !== '',
      hasImageFallback: false,
      brandLocaleVisible: true,
    })
    if (!filter.filtered) rank += 1
    return {
      id: randomUUID(),
      videoId: row.videoId,
      videoSummary: {
        title: row.title,
        slug: row.slug,
        coverUrl: row.coverUrl,
        type: row.type,
        year: row.year,
        rating: row.catalogRating,
        sourceCount: row.activeSourceCount,
      },
      score: bangumiDisplayScore(
        row.bangumiRating,
        !row.coverUrl,
        isUnstableSource(row.sourceCheckStatus),
      ),
      rank: filter.filtered ? 0 : rank,
      origin: 'bangumi',
      filtered: filter.filtered,
      ...(filter.filterReason ? { filterReason: filter.filterReason } : {}),
    }
  })
}

/**
 * 缺口源行 → top-N ContentGap（纯函数，导出供单测）。
 * rank ASC 主序（queries 已按主序预截，此处稳定截断）；ContentGap.rank 携
 * bangumi 原生 rank（douban 缺口为 null 的对照差异）。
 */
export function buildBangumiGaps(rows: readonly BangumiGapSourceRow[], topN: number): ContentGap[] {
  const ordered = [...rows].sort((a, b) =>
    compareBangumiCandidates(
      { rank: a.bangumiRank, rating: numOrNull(a.bangumiRating) },
      { rank: b.bangumiRank, rating: numOrNull(b.bangumiRating) },
    ))

  return ordered.slice(0, topN).map((row) => ({
    provider: 'bangumi',
    externalId: String(row.bangumiId),
    title: row.title,
    coverUrl: row.coverUrl,
    score: bangumiDisplayScore(numOrNull(row.bangumiRating), !row.coverUrl, false),
    rank: row.bangumiRank,
    mediaTypeHint: 'anime',
  }))
}

function numOrNull(v: string | number | null): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Bangumi hot_anime 候选生成编排（worker 消费，CHG-HOME-AUTOFILL-REFRESH 接线）。
 * 候选与缺口同时序产出（同一次重算入同一快照，D-183-7.3）。
 */
export async function generateBangumiSectionCandidates(
  db: Pool,
): Promise<{ candidates: AutofillCandidate[]; gaps: ContentGap[] }> {
  const [sourceRows, gapRows] = await Promise.all([
    listBangumiCandidateSourceRows(db, CANDIDATE_POOL_LIMIT),
    listBangumiGapSourceRows(db, GAP_SCAN_WINDOW),
  ])
  return {
    candidates: buildBangumiCandidates(sourceRows),
    gaps: buildBangumiGaps(gapRows, GAP_TOP_N),
  }
}
